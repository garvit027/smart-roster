import type { AppState, Roster } from '../types';
import { monthDays, WEEKDAY_SHORT, weekdayOf } from './date';

function escape(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function rosterToCSV(state: AppState, roster: Roster): string {
  const dates = monthDays(roster.month);
  const brandName = (id?: string) => state.brands.find((b) => b.id === id)?.name ?? '';
  const processName = (id?: string) => state.processes.find((p) => p.id === id)?.code ?? '';
  const podName = (id: string) => state.pods.find((p) => p.id === id)?.name ?? '';

  const perDayHeader = ['Employee', 'Pod', ...dates.map((d) => `${d} (${WEEKDAY_SHORT[weekdayOf(d)]})`)];
  const perDayRows = state.employees.map((employee) => {
    const cells = roster.cells[employee.id] ?? {};
    return [
      employee.name,
      podName(employee.podId),
      ...dates.map((date) => {
        const cell = cells[date];
        if (!cell) return '';
        if (cell.state === 'WORKING') return `${brandName(cell.brandId)} / ${processName(cell.processId)}${cell.manual ? '*' : ''}`;
        if (cell.state === 'LEAVE') return 'LEAVE';
        if (cell.state === 'UNAVAILABLE') return 'UNAVAILABLE';
        return 'OFF';
      }),
    ];
  });

  return [perDayHeader, ...perDayRows].map((row) => row.map(escape).join(',')).join('\n');
}

export function downloadCSV(filename: string, content: string): void {
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
