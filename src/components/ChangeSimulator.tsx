import { useMemo, useState } from 'react';
import { UserX, RotateCcw, ArrowRight, UserPlus, AlertOctagon, Info } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { recommendBackups, resolutionHint } from '../engine/recommendations';
import { Card, EmptyState, Field, Pill, SectionHeader } from './ui';
import { monthDays, monthLabel } from '../utils/date';
import type { Conflict } from '../types';

export default function ChangeSimulator() {
  const { state, simulateChange, revertChange, addManual } = useApp();
  const [employeeId, setEmployeeId] = useState(state.employees[0]?.id ?? '');
  const [startDate, setStartDate] = useState(`${state.rosterMonth}-15`);
  const [endDate, setEndDate] = useState(`${state.rosterMonth}-15`);
  const [reason, setReason] = useState('Emergency leave request');
  const [simulated, setSimulated] = useState(false);

  const dates = monthDays(state.rosterMonth);
  const baseline = state.baselineRoster;
  const current = state.roster;

  const diff = useMemo(() => {
    if (!baseline || !current) return [];
    const changed: Array<{ employee: string; date: string; from: string; to: string }> = [];
    state.employees.forEach((e) => {
      dates.forEach((d) => {
        const a = baseline.cells[e.id]?.[d];
        const b = current.cells[e.id]?.[d];
        const aKey = `${a?.state ?? '-'}:${a?.allocationId ?? ''}`;
        const bKey = `${b?.state ?? '-'}:${b?.allocationId ?? ''}`;
        if (aKey !== bKey) changed.push({ employee: e.name, date: d, from: aKey, to: bKey });
      });
    });
    return changed;
  }, [baseline, current, dates, state.employees]);

  const newConflicts: Conflict[] = useMemo(() => {
    if (!baseline || !current) return [];
    const before = new Set(baseline.conflicts.map((c) => c.id));
    return current.conflicts.filter((c) => !before.has(c.id) && c.mandatory);
  }, [baseline, current]);

  const employee = state.employees.find((e) => e.id === employeeId);
  const activeOverrides = state.overrides.length;

  return (
    <div className="page-stack">
      <div className="hero card">
        <div>
          <Pill tone="purple">Change management</Pill>
          <h2>What if someone becomes unavailable?</h2>
          <p>Mark a person unavailable for a date range. The engine regenerates the month, compares it with the previous plan, surfaces new gaps, and ranks possible backups — without rebuilding the roster by hand.</p>
        </div>
        <div className="hero-icon"><UserX size={38} /></div>
      </div>

      <Card>
        <SectionHeader title="Simulate an availability change" subtitle={`Planning month: ${monthLabel(state.rosterMonth)}`} />
        <div className="form-grid">
          <Field label="Employee">
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              {state.employees.map((e) => <option key={e.id} value={e.id}>{e.name} · {state.pods.find((p) => p.id === e.podId)?.name}</option>)}
            </select>
          </Field>
          <Field label="From">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
          <Field label="Reason">
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Approved emergency leave" />
          </Field>
        </div>
        <div className="button-row">
          <button className="btn btn-primary" disabled={!startDate || !endDate || startDate > endDate} onClick={() => { simulateChange(employeeId, startDate, endDate, reason); setSimulated(true); }}>
            <UserX size={15} /> Simulate absence
          </button>
          {baseline && <button className="btn btn-ghost" onClick={() => { revertChange(); setSimulated(false); }}><RotateCcw size={15} /> Revert to previous plan</button>}
          {activeOverrides > 0 && <Pill tone="amber">{activeOverrides} active availability overrides</Pill>}
        </div>
        {employee && (
          <div className="callout">
            <Info size={16} />
            <span>
              <strong>{employee.name}</strong> is assigned to {state.allocations.filter((a) => a.employeeIds.includes(employeeId)).length} brand-process pairs across{' '}
              {new Set(state.allocations.filter((a) => a.employeeIds.includes(employeeId)).map((a) => a.brandId)).size} brand(s). Single-resource brands will immediately show a gap on required days.
            </span>
          </div>
        )}
      </Card>

      {simulated && (
        <>
          <div className="stat-grid">
            <Card className="stat"><div className="stat-value tone-amber">{diff.length}</div><div className="stat-label">Cells changed</div><div className="stat-sub">vs. previous plan</div></Card>
            <Card className="stat"><div className="stat-value tone-red">{newConflicts.length}</div><div className="stat-label">New mandatory conflicts</div><div className="stat-sub">introduced by this change</div></Card>
            <Card className="stat"><div className="stat-value tone-blue">{state.overrides.length}</div><div className="stat-label">Availability overrides</div><div className="stat-sub">stored in the scenario</div></Card>
          </div>

          <Card>
            <SectionHeader title="Impact — cells that moved" subtitle="Only the affected days are shown; unaffected assignments stay exactly as planned" />
            {diff.length === 0 ? (
              <EmptyState icon={<RotateCcw />} title="No assignments changed" text="This person was not scheduled on the selected days, or a colleague was already covering." />
            ) : (
              <div className="diff-list">
                {diff.slice(0, 40).map((d, i) => (
                  <div key={`${d.employee}-${d.date}-${i}`} className="diff-row">
                    <strong>{d.employee}</strong><span>{d.date}</span>
                    <span className="diff-from">{d.from.replace('WORKING:', 'WORKING · ').replace('OFF:', '').replace('LEAVE:', 'LEAVE · ')}</span>
                    <ArrowRight size={14} />
                    <span className="diff-to">{d.to.replace('WORKING:', 'WORKING · ').replace('OFF:', 'OFF').replace('UNAVAILABLE:', 'UNAVAILABLE · ')}</span>
                  </div>
                ))}
                {diff.length > 40 && <div className="more">+{diff.length - 40} more changed cells</div>}
              </div>
            )}
          </Card>

          <Card>
            <SectionHeader title="New gaps & resolution options" subtitle="Ranked using same-allocation first, then same-process, then cross-training" />
            {newConflicts.length === 0 ? (
              <EmptyState icon={<AlertOctagon />} title="No new coverage gaps" text="The remaining employees absorbed the change without breaking any mandatory constraint." />
            ) : (
              <div className="conflict-list">
                {newConflicts.map((conflict) => {
                  const backups = recommendBackups(conflict, state);
                  return (
                    <div key={conflict.id} className="conflict-card severity-critical">
                      <div className="conflict-main static">
                        <span className="conflict-icon"><AlertOctagon size={18} /></span>
                        <span className="conflict-text"><strong>{conflict.title}</strong><span>{conflict.detail}</span><span className="conflict-meta">{conflict.date}</span></span>
                      </div>
                      <div className="conflict-detail always">
                        <div className="hint-box"><Info size={16} /><span>{resolutionHint(conflict, state)}</span></div>
                        {backups.map((b, i) => (
                          <div key={b.employeeId} className="backup-row">
                            <span className="rank">{i + 1}</span>
                            <div><strong>{b.name}</strong><small>{b.detail}</small></div>
                            <button className="btn btn-small" onClick={() => addManual({
                              id: `fix-${Date.now()}-${b.employeeId}`,
                              date: conflict.date,
                              allocationId: conflict.allocationId!,
                              employeeId: b.employeeId,
                              action: 'ADD',
                              note: 'Backup assigned after change simulation',
                            })}><UserPlus size={14} /> Assign backup</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
