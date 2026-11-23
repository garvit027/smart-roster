import type { Conflict, Employee, Roster, Weekday } from '../types';
import { employeeAvailability } from './scheduler';
import { monthDays, weekdayOf } from '../utils/date';

export interface BackupRecommendation {
  employeeId: string;
  name: string;
  source: 'SAME_ALLOCATION' | 'SAME_PROCESS' | 'CROSS_TRAINED';
  detail: string;
  score: number;
}

/** Ranks available people who could close a coverage gap, without regenerating everything. */
export function recommendBackups(
  conflict: Conflict,
  input: {
    employees: Employee[];
    allocations: import('../types').Allocation[];
    brands: import('../types').Brand[];
    roster: Roster | null;
    leaves: import('../types').Leave[];
    overrides: import('../types').AvailabilityOverride[];
  }
): BackupRecommendation[] {
  if (!conflict.allocationId || !conflict.date?.includes('-') || conflict.date.length !== 10) return [];
  const { employees, allocations, roster, leaves, overrides } = input;
  const allocation = allocations.find((a) => a.id === conflict.allocationId);
  if (!allocation) return [];

  // Someone already working a different process for the SAME brand can still
  // cover this gap; someone booked on another brand cannot.
  const isWorkingElsewhere = (employeeId: string) => {
    const cell = roster?.cells[employeeId]?.[conflict.date];
    return cell?.state === 'WORKING' && cell.brandId !== allocation.brandId;
  };

  const month = conflict.date.slice(0, 7);
  const dates = monthDays(month);
  const monthWork = (employeeId: string) =>
    dates.filter((d) => roster?.cells[employeeId]?.[d]?.state === 'WORKING').length;

  const recommendations = new Map<string, BackupRecommendation>();

  const consider = (employee: Employee, source: BackupRecommendation['source'], detail: string, bonus: number) => {
    if (isWorkingElsewhere(employee.id)) return;
    const av = employeeAvailability(employee.id, conflict.date, leaves, overrides);
    if (!av.available) return;
    const weekday = weekdayOf(conflict.date) as Weekday;
    const score =
      bonus +
      (employee.skills.includes(allocation.processId) ? 20 : 0) +
      (employee.preferredOffDays.includes(weekday) ? -8 : 0) -
      monthWork(employee.id) * 0.4;
    const existing = recommendations.get(employee.id);
    if (!existing || score > existing.score) {
      recommendations.set(employee.id, { employeeId: employee.id, name: employee.name, source, detail, score });
    }
  };

  allocation.employeeIds
    .map((id) => employees.find((e) => e.id === id))
    .filter((e): e is Employee => Boolean(e))
    .forEach((e) => consider(e, 'SAME_ALLOCATION', 'Already assigned to this brand-process, currently off', 40));

  allocations
    .filter((a) => a.id !== allocation.id && a.processId === allocation.processId)
    .flatMap((a) => a.employeeIds)
    .map((id) => employees.find((e) => e.id === id))
    .filter((e): e is Employee => Boolean(e))
    .forEach((e) => consider(e, 'SAME_PROCESS', 'Handles the same process for another brand', 25));

  employees
    .filter((e) => e.skills.includes(allocation.processId))
    .forEach((e) => consider(e, 'CROSS_TRAINED', 'Cross-trained on this process', 5));

  return [...recommendations.values()].sort((a, b) => b.score - a.score).slice(0, 5);
}

export function resolutionHint(conflict: Conflict, input: { brands: import('../types').Brand[]; employees: Employee[]; allocations: import('../types').Allocation[] }): string {
  if (conflict.kind !== 'COVERAGE_SHORTFALL' && conflict.kind !== 'NO_ELIGIBLE_EMPLOYEES') return '';
  const allocation = input.allocations.find((a) => a.id === conflict.allocationId);
  if (!allocation) return '';
  const brand = input.brands.find((b) => b.id === allocation.brandId);
  const handlers = allocation.employeeIds.length;
  if (handlers === 1) {
    return `${brand?.name ?? 'This brand'} is single-resource. There is no internal backup — cross-train a pod colleague, approve a comp-off swap, or ask the client for a coverage exception on this date.`;
  }
  return `${brand?.name ?? 'This brand'} has ${handlers} assigned employees. Reassign one from a non-critical allocation, or add a cross-trained colleague from the same pod.`;
}
