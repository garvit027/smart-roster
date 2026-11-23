import type {
  Allocation,
  AppState,
  AvailabilityOverride,
  Conflict,
  CoverageCell,
  Employee,
  Holiday,
  Leave,
  ManualAssignment,
  Roster,
  RosterCell,
  Weekday,
} from '../types';
import { activeLeave, isAllocationWorkingDay } from './calendar';
import { monthDays, WEEKDAY_LONG, weekdayOf } from '../utils/date';

export interface GenerateInput extends AppState {
  month: string;
}

interface Availability {
  available: boolean;
  reason: string;
}

/** An AVAILABLE override is an explicit manager decision and outranks an approved leave. */
export function employeeAvailability(
  employeeId: string,
  date: string,
  leaves: Leave[],
  overrides: AvailabilityOverride[]
): Availability {
  const override = overrides.find((o) => o.employeeId === employeeId && o.date === date);
  if (override?.type === 'UNAVAILABLE') {
    return { available: false, reason: override.reason || 'Marked unavailable' };
  }
  if (override?.type === 'AVAILABLE') {
    return { available: true, reason: 'Manager availability override' };
  }
  const leave = activeLeave(employeeId, date, leaves);
  if (leave) {
    return { available: false, reason: `${leave.type.replace('_', ' ').toLowerCase()}: ${leave.reason}` };
  }
  return { available: true, reason: 'Available' };
}

function scoreCandidate(
  employee: Employee,
  date: string,
  workCount: Record<string, number>,
  consecutive: Record<string, number>
): number {
  const weekday = weekdayOf(date) as Weekday;
  let score = 100;
  if (employee.preferredOffDays.includes(weekday)) score -= 60;
  if (consecutive[employee.id] >= employee.maxConsecutiveDays) score -= 100;
  else if (consecutive[employee.id] >= employee.maxConsecutiveDays - 1) score -= 40;
  score -= (workCount[employee.id] ?? 0) * 0.6;
  score += employee.skills.length * 0.5;
  // Deterministic tie-break so the same inputs always produce the same roster.
  score -= (employee.id.charCodeAt(employee.id.length - 1) % 7) * 0.01;
  return score;
}

function emptyCoverage(ruleLabel: string): CoverageCell {
  return { status: 'NOT_REQUIRED', required: 0, scheduled: [], ruleLabel, isHoliday: false, isSunday: false };
}

/**
 * Builds the roster matrix. Deliberately deterministic: no randomness, so a
 * manager can reproduce and explain any cell. Allocation order per day is
 * "most constrained first", which reduces avoidable coverage gaps.
 */
export function buildRoster(input: GenerateInput): Roster {
  const {
    month,
    employees,
    allocations,
    leaves,
    holidays,
    overrides,
    manualAssignments,
  } = input;
  const dates = monthDays(month);
  const cells: Roster['cells'] = {};
  const coverage: Roster['coverage'] = {};
  const workCount: Record<string, number> = {};
  const consecutive: Record<string, number> = {};

  employees.forEach((e) => {
    cells[e.id] = {};
    workCount[e.id] = 0;
    consecutive[e.id] = 0;
  });
  allocations.forEach((a) => {
    coverage[a.id] = {};
    dates.forEach((date) => {
      coverage[a.id][date] = emptyCoverage(a.rule.label);
    });
  });

  for (const date of dates) {
    const availability: Record<string, Availability> = {};
    employees.forEach((e) => {
      availability[e.id] = employeeAvailability(e.id, date, leaves, overrides);
    });

    const dayInfo = allocations.map((a) => ({
      allocation: a,
      ...isAllocationWorkingDay(a, date, holidays),
      eligibleCount: a.employeeIds.filter((id) => availability[id]?.available).length,
    }));

    const ordered = dayInfo
      .filter((d) => d.required)
      .sort(
        (a, b) =>
          a.eligibleCount - b.eligibleCount ||
          b.allocation.minCoverage - a.allocation.minCoverage ||
          a.allocation.id.localeCompare(b.allocation.id)
      );

    // One person may cover several processes for the SAME brand in a day
    // (single-resource brands), but never two different brands on the same day.
    const brandByEmployee: Record<string, string> = {};
    const workedToday = new Set<string>();

    for (const { allocation } of ordered) {
      coverage[allocation.id][date] = {
        status: 'SHORTFALL',
        required: allocation.minCoverage,
        scheduled: [],
        ruleLabel: allocation.rule.label,
        isHoliday: dayInfo.find((d) => d.allocation.id === allocation.id)?.isHoliday ?? false,
        isSunday: dayInfo.find((d) => d.allocation.id === allocation.id)?.isSunday ?? false,
      };

      const candidates = allocation.employeeIds
        .filter((id) => availability[id]?.available && (!brandByEmployee[id] || brandByEmployee[id] === allocation.brandId))
        .map((id) => employees.find((e) => e.id === id))
        .filter((e): e is Employee => Boolean(e))
        .sort(
          (a, b) =>
            scoreCandidate(b, date, workCount, consecutive) -
            scoreCandidate(a, date, workCount, consecutive)
        );

      const chosen = candidates.slice(0, allocation.minCoverage);
      chosen.forEach((employee) => {
        const existing = cells[employee.id][date];
        cells[employee.id][date] = existing?.state === 'WORKING'
          ? {
              ...existing,
              allocationIds: [...(existing.allocationIds ?? [existing.allocationId!]), allocation.id],
            }
          : {
              state: 'WORKING',
              allocationId: allocation.id,
              allocationIds: [allocation.id],
              brandId: allocation.brandId,
              processId: allocation.processId,
            };
        brandByEmployee[employee.id] = allocation.brandId;
        if (!workedToday.has(employee.id)) {
          workedToday.add(employee.id);
          workCount[employee.id] += 1;
          consecutive[employee.id] += 1;
        }
        coverage[allocation.id][date].scheduled.push(employee.id);
      });
      if (chosen.length >= allocation.minCoverage) coverage[allocation.id][date].status = 'OK';
    }

    employees.forEach((employee) => {
      if (cells[employee.id][date]) return;
      const av = availability[employee.id];
      if (!av.available) {
        const isLeave = Boolean(activeLeave(employee.id, date, leaves));
        cells[employee.id][date] = {
          state: isLeave && av.reason.toLowerCase().includes('leave') ? 'LEAVE' : 'UNAVAILABLE',
          reason: av.reason,
        };
      } else {
        cells[employee.id][date] = { state: 'OFF' };
      }
      consecutive[employee.id] = 0;
    });
  }

  applyManualAssignments(cells, coverage, manualAssignments, dates, allocations);
  recomputeCoverage(cells, coverage, allocations, dates, holidays);

  return { month, generatedAt: new Date().toISOString(), cells, coverage, conflicts: [] };
}

function applyManualAssignments(
  cells: Roster['cells'],
  coverage: Roster['coverage'],
  manual: ManualAssignment[],
  dates: string[],
  allocations: Allocation[]
): void {
  for (const m of manual) {
    if (!dates.includes(m.date) || !coverage[m.allocationId] || !cells[m.employeeId]) continue;
    if (m.action === 'ADD') {
      const current = cells[m.employeeId][m.date];
      const ids = current?.allocationIds ?? (current?.allocationId ? [current.allocationId] : []);
      if (ids.includes(m.allocationId)) continue;
      cells[m.employeeId][m.date] = {
        state: 'WORKING',
        allocationId: current?.state === 'WORKING' ? current.allocationId : m.allocationId,
        allocationIds: [...ids, m.allocationId],
        brandId: allocations.find((a) => a.id === m.allocationId)?.brandId,
        processId: current?.state === 'WORKING' ? current.processId : allocations.find((a) => a.id === m.allocationId)?.processId,
        manual: true,
        note: m.note,
      };
    } else {
      const current = cells[m.employeeId][m.date];
      if (current?.allocationIds?.includes(m.allocationId) || current?.allocationId === m.allocationId) {
        const remaining = (current.allocationIds ?? [current.allocationId!]).filter((id) => id !== m.allocationId);
        if (remaining.length === 0) {
          cells[m.employeeId][m.date] = { state: 'OFF', manual: true, note: m.note };
        } else {
          cells[m.employeeId][m.date] = { ...current, allocationId: remaining[0], allocationIds: remaining };
        }
      }
    }
  }
}

function recomputeCoverage(
  cells: Roster['cells'],
  coverage: Roster['coverage'],
  allocations: Allocation[],
  dates: string[],
  holidays: Holiday[]
): void {
  for (const allocation of allocations) {
    for (const date of dates) {
      const info = isAllocationWorkingDay(allocation, date, holidays);
      const scheduled = Object.entries(cells)
        .filter(([, byDate]) => {
          const cell = byDate[date];
          return cell?.state === 'WORKING' && (cell.allocationIds?.includes(allocation.id) ?? cell.allocationId === allocation.id);
        })
        .map(([employeeId]) => employeeId);
      coverage[allocation.id][date] = {
        status: !info.required ? 'NOT_REQUIRED' : scheduled.length >= allocation.minCoverage ? 'OK' : 'SHORTFALL',
        required: allocation.minCoverage,
        scheduled,
        ruleLabel: allocation.rule.label,
        isHoliday: info.isHoliday,
        isSunday: info.isSunday,
      };
    }
  }
}

export function generateRoster(input: GenerateInput): Roster {
  const roster = buildRoster(input);
  roster.conflicts = validateRoster(roster, input);
  return roster;
}

/** Re-runs every constraint check against an existing roster (used after manual edits). */
export function validateRoster(roster: Roster, input: GenerateInput): Conflict[] {
  const { month, employees, allocations, leaves, overrides } = input;
  const dates = monthDays(month);
  const conflicts: Conflict[] = [];
  const byId = new Map(employees.map((e) => [e.id, e]));

  for (const allocation of allocations) {
    if (allocation.employeeIds.length === 0) {
      conflicts.push({
        id: `no-eligible-${allocation.id}`,
        kind: 'NO_ELIGIBLE_EMPLOYEES',
        severity: 'CRITICAL',
        date: month,
        allocationId: allocation.id,
        brandId: allocation.brandId,
        processId: allocation.processId,
        title: 'No employees assigned to allocation',
        detail: `${allocation.rule.label} allocation has an empty eligible-employee list.`,
        mandatory: true,
      });
    }
    for (const date of dates) {
      const cell = roster.coverage[allocation.id]?.[date];
      if (!cell || cell.status !== 'SHORTFALL') continue;
      const unavailable = allocation.employeeIds
        .map((id) => {
          const av = employeeAvailability(id, date, leaves, overrides);
          return av.available ? null : `${byId.get(id)?.name ?? id} (${av.reason})`;
        })
        .filter(Boolean);
      const assignedElsewhere = allocation.employeeIds.filter((id) => {
        const c = roster.cells[id]?.[date];
        return c?.state === 'WORKING' && c.brandId !== allocation.brandId;
      });
      const bits = [
        `${cell.scheduled.length} of ${cell.required} required employees scheduled`,
        unavailable.length ? `unavailable: ${unavailable.join(', ')}` : '',
        assignedElsewhere.length
          ? `covering another brand: ${assignedElsewhere.map((id) => byId.get(id)?.name ?? id).join(', ')}`
          : '',
      ].filter(Boolean);
      conflicts.push({
        id: `shortfall-${allocation.id}-${date}`,
        kind: 'COVERAGE_SHORTFALL',
        severity: 'CRITICAL',
        date,
        allocationId: allocation.id,
        brandId: allocation.brandId,
        processId: allocation.processId,
        title: 'Coverage shortfall',
        detail: bits.join(' · '),
        mandatory: true,
      });
    }
  }

  for (const [employeeId, byDate] of Object.entries(roster.cells)) {
    const employee = byId.get(employeeId);
    if (!employee) continue;
    let preferredOffWorked = 0;
    let longestRun = 0;
    let run = 0;
    const brandsByDate: Record<string, string> = {};

    for (const date of dates) {
      const cell = byDate[date];
      if (!cell) continue;
      if (cell.state === 'WORKING') {
        run += 1;
        longestRun = Math.max(longestRun, run);
        if (cell.brandId) {
          if (brandsByDate[date] && brandsByDate[date] !== cell.brandId) {
            conflicts.push({
              id: `double-${employeeId}-${date}`,
              kind: 'DOUBLE_ASSIGNMENT',
              severity: 'CRITICAL',
              date,
              employeeId,
              allocationId: cell.allocationId,
              brandId: cell.brandId,
              title: 'Employee booked on two brands in one day',
              detail: `${employee.name} is assigned to ${brandsByDate[date]} and ${cell.brandId} on ${date}.`,
              mandatory: true,
            });
          }
          brandsByDate[date] = cell.brandId;
        }
        if (employee.preferredOffDays.includes(weekdayOf(date) as Weekday)) preferredOffWorked += 1;
        if (activeLeave(employeeId, date, leaves)) {
          conflicts.push({
            id: `leave-${employeeId}-${date}`,
            kind: 'LEAVE_VIOLATION',
            severity: 'CRITICAL',
            date,
            employeeId,
            allocationId: cell.allocationId,
            title: 'Employee scheduled while on approved leave',
            detail: `${employee.name} is marked WORKING on ${date} despite an approved leave.`,
            mandatory: true,
          });
        }
        const ov = overrides.find((o) => o.employeeId === employeeId && o.date === date);
        if (ov?.type === 'UNAVAILABLE') {
          conflicts.push({
            id: `override-${employeeId}-${date}`,
            kind: 'OVERRIDE_VIOLATION',
            severity: 'CRITICAL',
            date,
            employeeId,
            allocationId: cell.allocationId,
            title: 'Unavailable employee scheduled',
            detail: `${employee.name} is marked WORKING on ${date} after being marked unavailable (${ov.reason}).`,
            mandatory: true,
          });
        }
      } else {
        run = 0;
      }
    }

    if (preferredOffWorked > 0) {
      conflicts.push({
        id: `pref-${employeeId}-${month}`,
        kind: 'OFF_DAY_PREFERENCE',
        severity: 'INFO',
        date: month,
        employeeId,
        title: 'Preferred off day not honoured',
        detail: `${employee.name} worked ${preferredOffWorked} preferred off day${preferredOffWorked === 1 ? '' : 's'} (${employee.preferredOffDays.map((d) => WEEKDAY_LONG[d]).join(', ')}). Mandatory client coverage took priority.`,
        mandatory: false,
      });
    }
    if (longestRun > employee.maxConsecutiveDays) {
      conflicts.push({
        id: `consecutive-${employeeId}-${month}`,
        kind: 'CONSECUTIVE_DAYS',
        severity: 'WARNING',
        date: month,
        employeeId,
        title: 'Consecutive-days cap exceeded',
        detail: `${employee.name} worked ${longestRun} consecutive days (cap: ${employee.maxConsecutiveDays}) because of mandatory coverage.`,
        mandatory: false,
      });
    }
  }

  const order = { CRITICAL: 0, WARNING: 1, INFO: 2 };
  return conflicts.sort((a, b) => order[a.severity] - order[b.severity] || a.date.localeCompare(b.date));
}
