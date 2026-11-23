import { useMemo, useState } from 'react';
import { Search, X, Check, UserMinus, CalendarClock } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { Card, EmptyState, Field, Modal, Pill, SectionHeader, Tabs } from './ui';
import { monthDays, WEEKDAY_SHORT, weekdayOf, dayLabel, monthLabel } from '../utils/date';
import type { Employee, RosterCell } from '../types';

type View = 'company' | 'pod' | 'brand' | 'process' | 'employee';

export default function RosterViews() {
  const { state } = useApp();
  const [view, setView] = useState<View>('company');
  const [podId, setPodId] = useState(state.pods[0]?.id ?? '');
  const [brandId, setBrandId] = useState(state.brands[0]?.id ?? '');
  const [processId, setProcessId] = useState(state.processes[0]?.id ?? '');
  const [employeeId, setEmployeeId] = useState(state.employees[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ employee: Employee; date: string; cell: RosterCell } | null>(null);

  const dates = useMemo(() => monthDays(state.rosterMonth), [state.rosterMonth]);
  const roster = state.roster;

  if (!roster) return <EmptyState icon={<CalendarClock />} title="No roster yet" text="Generate a roster for the selected month to see these views." />;

  const matches = (e: Employee) => e.name.toLowerCase().includes(query.toLowerCase()) || e.id.includes(query.toLowerCase());
  const processColor = (id?: string) => state.processes.find((p) => p.id === id)?.color ?? '#94a3b8';

  let employees: Employee[] = [];
  if (view === 'company') employees = state.employees.filter(matches);
  if (view === 'pod') employees = state.employees.filter((e) => e.podId === podId && matches(e));
  if (view === 'employee') employees = state.employees.filter((e) => e.id === employeeId);

  return (
    <div className="page-stack">
      <Tabs
        active={view}
        onChange={setView}
        tabs={[
          { id: 'company', label: 'Company-wide' },
          { id: 'pod', label: 'Pod-wise' },
          { id: 'brand', label: 'Brand-wise' },
          { id: 'process', label: 'Process-wise' },
          { id: 'employee', label: 'Employee-wise' },
        ]}
      />

      <div className="filter-bar">
        {view === 'pod' && (
          <Field label="Pod">
            <select value={podId} onChange={(e) => setPodId(e.target.value)}>
              {state.pods.map((p) => <option key={p.id} value={p.id}>{p.name} · {state.employees.find((e) => e.id === p.leadEmployeeId)?.name}</option>)}
            </select>
          </Field>
        )}
        {view === 'brand' && (
          <Field label="Brand">
            <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              {state.brands.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}
            </select>
          </Field>
        )}
        {view === 'process' && (
          <Field label="Process">
            <select value={processId} onChange={(e) => setProcessId(e.target.value)}>
              {state.processes.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
            </select>
          </Field>
        )}
        {view === 'employee' && (
          <Field label="Employee">
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              {state.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </Field>
        )}
        {(view === 'company' || view === 'pod') && (
          <Field label="Search employee">
            <div className="input-icon"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or ID" /></div>
          </Field>
        )}
        <div className="filter-spacer" />
        <div className="view-note"><Pill tone="blue">{monthLabel(state.rosterMonth)}</Pill> Click a working cell to edit it</div>
      </div>

      {(view === 'company' || view === 'pod' || view === 'employee') && (
        <Card className="matrix-card">
          <SectionHeader
            title={view === 'company' ? 'All employees' : view === 'pod' ? `${state.pods.find((p) => p.id === podId)?.name} schedule` : 'Individual schedule'}
            subtitle={`${employees.length} employee${employees.length === 1 ? '' : 's'} · ${dates.length} days`}
          />
          {employees.length === 0 ? (
            <EmptyState icon={<Search />} title="No employees match" text="Try a different search or filter." />
          ) : (
            <EmployeeMatrix employees={employees} dates={dates} state={state} onCellClick={(employee, date, cell) => setSelected({ employee, date, cell })} />
          )}
        </Card>
      )}

      {view === 'brand' && <BrandView brandId={brandId} dates={dates} />}
      {view === 'process' && <ProcessView processId={processId} dates={dates} />}

      {view === 'employee' && <EmployeeSummary employeeId={employeeId} dates={dates} />}

      {selected && (
        <CellEditor
          selection={selected}
          onClose={() => setSelected(null)}
          processColor={processColor}
        />
      )}
    </div>
  );
}

export function EmployeeMatrix({
  employees, dates, state, onCellClick, compact = false,
}: {
  employees: Employee[];
  dates: string[];
  state: ReturnType<typeof useApp>['state'];
  onCellClick?: (employee: Employee, date: string, cell: RosterCell) => void;
  compact?: boolean;
}) {
  const cells = state.roster!.cells;
  const holidays = new Set(state.holidays.map((h) => h.date));
  return (
    <div className="matrix-scroll">
      <table className={`matrix ${compact ? 'compact' : ''}`}>
        <thead>
          <tr>
            <th className="sticky-col">Employee</th>
            {dates.map((d) => {
              const wd = weekdayOf(d);
              const isHoliday = holidays.has(d);
              return (
                <th key={d} className={`${wd === 0 ? 'col-sunday' : ''} ${wd === 6 ? 'col-saturday' : ''} ${isHoliday ? 'col-holiday' : ''}`} title={isHoliday ? state.holidays.find((h) => h.date === d)?.name : undefined}>
                  <span>{dayLabel(d)}</span><small>{WEEKDAY_SHORT[wd]}</small>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id}>
              <td className="sticky-col">
                <div className="emp-cell">
                  <span className="avatar-sm">{employee.name.split(' ').map((p) => p[0]).join('')}</span>
                  <div><strong>{employee.name}</strong><small>{state.pods.find((p) => p.id === employee.podId)?.name}</small></div>
                </div>
              </td>
              {dates.map((d) => {
                const cell = cells[employee.id]?.[d] ?? { state: 'OFF' as const };
                const process = state.processes.find((p) => p.id === cell.processId);
                const brand = state.brands.find((b) => b.id === cell.brandId);
                return (
                  <td key={d} className={`cell cell-${cell.state.toLowerCase()} ${cell.manual ? 'cell-manual' : ''}`}>
                    <button
                      className="cell-btn"
                      title={cell.state === 'WORKING' ? `${brand?.name} · ${process?.name}${cell.manual ? ' (manual)' : ''}` : cell.reason || cell.state}
                      onClick={() => onCellClick?.(employee, d, cell)}
                    >
                      {cell.state === 'WORKING' ? <span className="work-chip" style={{ borderColor: process?.color, color: process?.color }}>{process?.code ?? 'WORK'}</span> : <span className="state-mark">{cell.state === 'LEAVE' ? 'L' : cell.state === 'UNAVAILABLE' ? 'X' : '·'}</span>}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BrandView({ brandId, dates }: { brandId: string; dates: string[] }) {
  const { state } = useApp();
  const brand = state.brands.find((b) => b.id === brandId)!;
  const allocations = state.allocations.filter((a) => a.brandId === brandId);
  const holidays = new Set(state.holidays.map((h) => h.date));

  return (
    <>
      <Card>
        <SectionHeader title={`${brand.code} · ${brand.name}`} subtitle={`${brand.category} brand · ${allocations.length} processes · ${new Set(allocations.flatMap((a) => a.employeeIds)).size} people`} />
        <div className="assignment-list">
          {allocations.map((a) => (
            <div key={a.id} className="assignment-row">
              <Pill tone="blue">{state.processes.find((p) => p.id === a.processId)?.code}</Pill>
              <span>{state.processes.find((p) => p.id === a.processId)?.name}</span>
              <span className="muted">min {a.minCoverage}/day</span>
              <span className="muted">{a.rule.label}</span>
              <span className="people">{a.employeeIds.map((id) => {
                const e = state.employees.find((x) => x.id === id);
                return <span key={id} className="person-chip">{e?.name}</span>;
              })}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card className="matrix-card">
        <SectionHeader title="Daily coverage" subtitle="Green = requirement met · Red = shortfall · Grey = process closed" />
        <CoverageMatrix allocations={allocations} dates={dates} holidays={holidays} state={state} />
      </Card>
    </>
  );
}

function ProcessView({ processId, dates }: { processId: string; dates: string[] }) {
  const { state } = useApp();
  const process = state.processes.find((p) => p.id === processId)!;
  const allocations = state.allocations.filter((a) => a.processId === processId);
  const holidays = new Set(state.holidays.map((h) => h.date));
  const employees = [...new Set(allocations.flatMap((a) => a.employeeIds))];

  return (
    <>
      <Card>
        <SectionHeader title={`${process.code} · ${process.name}`} subtitle={`${allocations.length} brand allocations · ${employees.length} trained employees`} />
        <div className="people-wrap">
          {employees.map((id) => {
            const e = state.employees.find((x) => x.id === id)!;
            const days = dates.filter((d) => state.roster?.cells[id]?.[d]?.state === 'WORKING' && state.roster.cells[id][d].processId === processId).length;
            return <div key={id} className="person-stat"><span className="avatar-sm">{e.name.split(' ').map((p) => p[0]).join('')}</span><div><strong>{e.name}</strong><small>{days} days this month</small></div></div>;
          })}
        </div>
      </Card>
      <Card className="matrix-card">
        <SectionHeader title="Coverage by brand" subtitle="One row per brand-process allocation" />
        <CoverageMatrix allocations={allocations} dates={dates} holidays={holidays} state={state} showBrand />
      </Card>
    </>
  );
}

function CoverageMatrix({ allocations, dates, holidays, state, showBrand = false }: {
  allocations: import('../types').Allocation[];
  dates: string[];
  holidays: Set<string>;
  state: ReturnType<typeof useApp>['state'];
  showBrand?: boolean;
}) {
  return (
    <div className="matrix-scroll">
      <table className="matrix compact">
        <thead>
          <tr>
            <th className="sticky-col">{showBrand ? 'Brand / process' : 'Process'}</th>
            {dates.map((d) => (
              <th key={d} className={`${weekdayOf(d) === 0 ? 'col-sunday' : ''} ${holidays.has(d) ? 'col-holiday' : ''}`}>
                <span>{dayLabel(d)}</span><small>{WEEKDAY_SHORT[weekdayOf(d)]}</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allocations.map((a) => (
            <tr key={a.id}>
              <td className="sticky-col">
                <div className="alloc-cell">
                  <strong>{showBrand ? state.brands.find((b) => b.id === a.brandId)?.name : state.processes.find((p) => p.id === a.processId)?.name}</strong>
                  <small>{state.processes.find((p) => p.id === a.processId)?.code} · need {a.minCoverage}</small>
                </div>
              </td>
              {dates.map((d) => {
                const c = state.roster!.coverage[a.id]?.[d];
                if (!c || c.status === 'NOT_REQUIRED') return <td key={d} className="cell cell-closed"><span>·</span></td>;
                const names = c.scheduled.map((id) => state.employees.find((e) => e.id === id)?.name ?? id).join(', ');
                return (
                  <td key={d} className={`cell cell-${c.status === 'OK' ? 'ok' : 'shortfall'}`}>
                    <span className="cover-chip" title={`${c.scheduled.length}/${c.required} · ${names || 'nobody scheduled'}`}>{c.scheduled.length}/{c.required}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmployeeSummary({ employeeId, dates }: { employeeId: string; dates: string[] }) {
  const { state } = useApp();
  const employee = state.employees.find((e) => e.id === employeeId)!;
  const cells = dates.map((d) => ({ date: d, cell: state.roster?.cells[employeeId]?.[d] }));
  const working = cells.filter((c) => c.cell?.state === 'WORKING').length;
  const offs = cells.filter((c) => c.cell?.state === 'OFF').length;
  const leaves = cells.filter((c) => c.cell?.state === 'LEAVE' || c.cell?.state === 'UNAVAILABLE').length;
  const allocations = state.allocations.filter((a) => a.employeeIds.includes(employeeId));

  return (
    <div className="two-col">
      <Card>
        <SectionHeader title="Profile & preferences" subtitle="These preferences never override mandatory coverage" />
        <div className="detail-grid">
          <div><span>Pod</span><strong>{state.pods.find((p) => p.id === employee.podId)?.name}</strong></div>
          <div><span>Email</span><strong>{employee.email}</strong></div>
          <div><span>Preferred off days</span><strong>{employee.preferredOffDays.map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}</strong></div>
          <div><span>Max consecutive days</span><strong>{employee.maxConsecutiveDays}</strong></div>
          <div><span>Trained processes</span><strong>{employee.skills.join(', ')}</strong></div>
          <div><span>Assignments</span><strong>{allocations.length} brand-process pairs</strong></div>
        </div>
        <div className="assignment-list">
          {allocations.map((a) => (
            <div key={a.id} className="assignment-row">
              <Pill tone="blue">{state.processes.find((p) => p.id === a.processId)?.code}</Pill>
              <span>{state.brands.find((b) => b.id === a.brandId)?.name}</span>
              <span className="muted">{a.rule.label}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <SectionHeader title="Month summary" subtitle={monthLabel(state.rosterMonth)} />
        <div className="breakdown">
          <div><strong>{working}</strong><span>Working days</span></div>
          <div><strong>{offs}</strong><span>Weekly offs</span></div>
          <div><strong>{leaves}</strong><span>Leave / unavailable</span></div>
        </div>
        <div className="callout"><Check size={16} /> Working days are derived from allocation rules, not a fixed 5-day week — a 365-day process will schedule weekends and holidays.</div>
      </Card>
    </div>
  );
}

function CellEditor({ selection, onClose, processColor }: {
  selection: { employee: Employee; date: string; cell: RosterCell };
  onClose: () => void;
  processColor: (id?: string) => string;
}) {
  const { state, addManual } = useApp();
  const { employee, date, cell } = selection;
  const allocation = state.allocations.find((a) => a.id === cell.allocationId);
  const alternatives = (allocation?.employeeIds ?? []).filter((id) => id !== employee.id);
  const [reassignTo, setReassignTo] = useState(alternatives[0] ?? '');

  return (
    <Modal title="Edit roster cell" onClose={onClose}>
      <div className="detail-grid">
        <div><span>Employee</span><strong>{employee.name}</strong></div>
        <div><span>Date</span><strong>{date}</strong></div>
        <div><span>Current state</span><strong>{cell.state}</strong></div>
        {allocation && <div><span>Assignment</span><strong style={{ color: processColor(allocation.processId) }}>{state.brands.find((b) => b.id === allocation.brandId)?.name} · {state.processes.find((p) => p.id === allocation.processId)?.code}</strong></div>}
      </div>
      {cell.state === 'WORKING' && allocation && (
        <div className="editor-actions">
          {alternatives.length > 0 && (
            <>
              <Field label="Reassign to">
                <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
                  {alternatives.map((id) => <option key={id} value={id}>{state.employees.find((e) => e.id === id)?.name}</option>)}
                </select>
              </Field>
              <button className="btn btn-primary" onClick={() => {
                const stamp = Date.now();
                addManual({ id: `manual-remove-${stamp}`, date, allocationId: allocation.id, employeeId: employee.id, action: 'REMOVE', note: 'Manual reassignment' });
                if (reassignTo) addManual({ id: `manual-add-${stamp}`, date, allocationId: allocation.id, employeeId: reassignTo, action: 'ADD', note: 'Manual reassignment' });
                onClose();
              }}><Check size={15} /> Apply reassignment</button>
            </>
          )}
          <button className="btn btn-danger" onClick={() => {
            addManual({ id: `manual-${Date.now()}`, date, allocationId: allocation.id, employeeId: employee.id, action: 'REMOVE', note: 'Manager removed assignment' });
            onClose();
          }}><UserMinus size={15} /> Remove assignment</button>
          <p className="hint">The roster is regenerated and every constraint is revalidated after this change.</p>
        </div>
      )}
      {cell.state !== 'WORKING' && <div className="callout"><X size={16} /> This employee is not working that day. Use the Conflicts page to assign a backup to a coverage gap.</div>}
    </Modal>
  );
}
