import type { Allocation, Holiday, Leave, Weekday } from '../types';
import { weekdayOf } from '../utils/date';

export function isPublicHoliday(date: string, holidays: Holiday[]): Holiday | undefined {
  return holidays.find((h) => h.date === date);
}

export function isAllocationWorkingDay(
  allocation: Allocation,
  date: string,
  holidays: Holiday[]
): { required: boolean; isHoliday: boolean; isSunday: boolean; reason: string } {
  const weekday = weekdayOf(date) as Weekday;
  const holiday = isPublicHoliday(date, holidays);
  const isSunday = weekday === 0;
  const inWeekdays = allocation.rule.workingDays.includes(weekday);
  const blockedByHoliday = Boolean(holiday) && !allocation.rule.worksOnHolidays;
  const excepted = allocation.exceptionDates?.includes(date) ?? false;
  const required = inWeekdays && !blockedByHoliday && !excepted;

  let reason = 'Operating day';
  if (excepted) reason = 'Client exception date';
  else if (blockedByHoliday) reason = `Public holiday: ${holiday?.name}`;
  else if (!inWeekdays && isSunday) reason = 'Sunday off for this process';
  else if (!inWeekdays) reason = 'Weekly off for this process';

  return { required, isHoliday: Boolean(holiday), isSunday, reason };
}

export function activeLeave(employeeId: string, date: string, leaves: Leave[]): Leave | undefined {
  return leaves.find(
    (l) => l.employeeId === employeeId && date >= l.startDate && date <= l.endDate
  );
}
