/** 0 = Sunday, 1 = Monday, ... 6 = Saturday */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Process {
  id: string;
  name: string;
  code: string;
  color: string;
}

export interface Pod {
  id: string;
  name: string;
  leadEmployeeId: string;
  color: string;
}

export interface Brand {
  id: string;
  name: string;
  code: string;
  color: string;
  category: 'D2C' | 'Marketplace' | 'Retail';
}

/**
 * Operating calendar for one brand-process pair.
 * `workingDays` lists the weekdays on which the process operates.
 * `worksOnHolidays` decides whether listed public holidays are still working days.
 */
export interface WorkingRule {
  id: string;
  label: string;
  workingDays: Weekday[];
  worksOnHolidays: boolean;
}

/** Presets exposed in the UI, also used by the seed dataset. */
export type WorkingRulePreset = 'ALLS_DAYS' | 'DAILY_NO_HOLIDAYS' | 'MON_SAT' | 'MON_FRI';

export const WORKING_RULE_PRESETS: Record<WorkingRulePreset, Omit<WorkingRule, 'id'>> = {
  ALLS_DAYS: {
    label: '365 days (incl. Sundays & holidays)',
    workingDays: [0, 1, 2, 3, 4, 5, 6],
    worksOnHolidays: true,
  },
  DAILY_NO_HOLIDAYS: {
    label: 'Daily, public holidays off',
    workingDays: [0, 1, 2, 3, 4, 5, 6],
    worksOnHolidays: false,
  },
  MON_SAT: {
    label: 'Mon–Sat, Sundays & holidays off',
    workingDays: [1, 2, 3, 4, 5, 6],
    worksOnHolidays: false,
  },
  MON_FRI: {
    label: 'Mon–Fri, weekends & holidays off',
    workingDays: [1, 2, 3, 4, 5],
    worksOnHolidays: false,
  },
};

/**
 * A resource allocation: "for brand X / process Y, these employees are eligible,
 * and at least `minCoverage` of them must work on every operating day."
 */
export interface Allocation {
  id: string;
  brandId: string;
  processId: string;
  employeeIds: string[];
  minCoverage: number;
  rule: WorkingRule;
  /** Days when this allocation does not need coverage (e.g. campaign-specific). */
  exceptionDates?: string[];
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  podId: string;
  /** Preferred weekly off weekdays. A preference, never a hard constraint. */
  preferredOffDays: Weekday[];
  /** Safety cap for consecutive working days. A preference. */
  maxConsecutiveDays: number;
  /** Processes the employee is trained on (used for backup recommendations). */
  skills: string[];
  joiningDate: string;
}

export type LeaveType = 'PLANNED' | 'COMP_OFF' | 'SICK';

export interface Leave {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  type: LeaveType;
  reason: string;
}

export interface Holiday {
  date: string;
  name: string;
}

export type OverrideType = 'UNAVAILABLE' | 'AVAILABLE';

/** A point-in-time availability change used by the change simulator and manual edits. */
export interface AvailabilityOverride {
  id: string;
  employeeId: string;
  date: string;
  type: OverrideType;
  reason: string;
}

/** A manager's manual change to a generated roster. */
export interface ManualAssignment {
  id: string;
  date: string;
  allocationId: string;
  employeeId: string;
  action: 'ADD' | 'REMOVE';
  note?: string;
}

export type CellState = 'WORKING' | 'OFF' | 'LEAVE' | 'UNAVAILABLE';

export interface RosterCell {
  state: CellState;
  /** Primary assignment, used for display. */
  allocationId?: string;
  /** All processes this person covers that day (same brand). */
  allocationIds?: string[];
  brandId?: string;
  processId?: string;
  manual?: boolean;
  reason?: string;
  note?: string;
}

export type CoverageStatus = 'OK' | 'SHORTFALL' | 'NOT_REQUIRED';

export interface CoverageCell {
  status: CoverageStatus;
  required: number;
  scheduled: string[];
  ruleLabel: string;
  isHoliday: boolean;
  isSunday: boolean;
}

export type ConflictSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type ConflictKind =
  | 'COVERAGE_SHORTFALL'
  | 'DOUBLE_ASSIGNMENT'
  | 'LEAVE_VIOLATION'
  | 'OFF_DAY_PREFERENCE'
  | 'CONSECUTIVE_DAYS'
  | 'OVERRIDE_VIOLATION'
  | 'NO_ELIGIBLE_EMPLOYEES';

export interface Conflict {
  id: string;
  kind: ConflictKind;
  severity: ConflictSeverity;
  date: string;
  allocationId?: string;
  brandId?: string;
  processId?: string;
  employeeId?: string;
  title: string;
  detail: string;
  /** Mandatory conflicts must be resolved before publishing; preferences are advisory. */
  mandatory: boolean;
}

export interface Roster {
  month: string;
  generatedAt: string;
  cells: Record<string, Record<string, RosterCell>>;
  coverage: Record<string, Record<string, CoverageCell>>;
  conflicts: Conflict[];
}

export interface AppState {
  employees: Employee[];
  brands: Brand[];
  processes: Process[];
  pods: Pod[];
  allocations: Allocation[];
  leaves: Leave[];
  holidays: Holiday[];
  overrides: AvailabilityOverride[];
  manualAssignments: ManualAssignment[];
  roster: Roster | null;
  /** Snapshot kept for the change simulator's before/after comparison. */
  baselineRoster: Roster | null;
  /** Overrides as they were when the baseline roster was generated. */
  baselineOverrides: AvailabilityOverride[];
  rosterMonth: string;
}
