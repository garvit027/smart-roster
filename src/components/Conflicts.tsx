import { useMemo, useState } from 'react';
import { AlertOctagon, AlertTriangle, Info, ShieldCheck, WandSparkles, UserPlus } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { recommendBackups, resolutionHint } from '../engine/recommendations';
import { Card, EmptyState, Pill, SectionHeader, Tabs } from './ui';
import type { Conflict } from '../types';

type Filter = 'all' | 'mandatory' | 'info';

export default function Conflicts() {
  const { state, addManual } = useApp();
  const [filter, setFilter] = useState<Filter>('mandatory');
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const conflicts = state.roster?.conflicts ?? [];
  const visible = useMemo(() => conflicts.filter((c) =>
    filter === 'all' ? true : filter === 'mandatory' ? c.mandatory : !c.mandatory
  ), [conflicts, filter]);

  const counts = {
    critical: conflicts.filter((c) => c.severity === 'CRITICAL').length,
    warning: conflicts.filter((c) => c.severity === 'WARNING').length,
    info: conflicts.filter((c) => c.severity === 'INFO').length,
  };

  return (
    <div className="page-stack">
      <Card>
        <SectionHeader
          title="Validation report"
          subtitle="Mandatory conflicts block publishing. Preferences are advisory and are only flagged when coverage takes priority."
          action={<div className="pill-row">
            <Pill tone="red">{counts.critical} critical</Pill>
            <Pill tone="amber">{counts.warning} warnings</Pill>
            <Pill tone="neutral">{counts.info} preferences</Pill>
          </div>}
        />
        <Tabs
          active={filter}
          onChange={setFilter}
          tabs={[
            { id: 'mandatory', label: `Mandatory (${conflicts.filter((c) => c.mandatory).length})` },
            { id: 'info', label: `Preferences (${counts.info})` },
            { id: 'all', label: 'All' },
          ]}
        />
      </Card>

      {message && <div className="toast"><ShieldCheck size={16} /> {message}<button onClick={() => setMessage('')}>×</button></div>}

      {visible.length === 0 ? (
        <Card><EmptyState icon={<ShieldCheck />} title={filter === 'mandatory' ? 'No mandatory conflicts' : 'Nothing to show'} text={filter === 'mandatory' ? 'Every required brand-process day has enough available employees. This roster is ready to publish.' : 'Try another filter.'} /></Card>
      ) : (
        <div className="conflict-list">
          {visible.map((conflict) => {
            const backups = open === conflict.id ? recommendBackups(conflict, state) : [];
            const hint = resolutionHint(conflict, state);
            return (
              <Card key={conflict.id} className={`conflict-card severity-${conflict.severity.toLowerCase()}`}>
                <button className="conflict-main" onClick={() => setOpen(open === conflict.id ? null : conflict.id)}>
                  <span className="conflict-icon">
                    {conflict.severity === 'CRITICAL' ? <AlertOctagon size={19} /> : conflict.severity === 'WARNING' ? <AlertTriangle size={19} /> : <Info size={19} />}
                  </span>
                  <span className="conflict-text">
                    <strong>{conflict.title}</strong>
                    <span>{conflict.detail}</span>
                    <span className="conflict-meta">
                      {conflict.date.length === 10 ? conflict.date : conflict.date.slice(0, 7)}
                      {conflict.brandId && ` · ${state.brands.find((b) => b.id === conflict.brandId)?.name}`}
                      {conflict.processId && ` · ${state.processes.find((p) => p.id === conflict.processId)?.code}`}
                      {conflict.employeeId && ` · ${state.employees.find((e) => e.id === conflict.employeeId)?.name}`}
                    </span>
                  </span>
                  <Pill tone={conflict.severity === 'CRITICAL' ? 'red' : conflict.severity === 'WARNING' ? 'amber' : 'neutral'}>
                    {conflict.mandatory ? 'Mandatory' : 'Preference'}
                  </Pill>
                </button>
                {open === conflict.id && (
                  <div className="conflict-detail">
                    {hint && <div className="hint-box"><WandSparkles size={16} /><span>{hint}</span></div>}
                    {backups.length > 0 ? (
                      <>
                        <h4>Ranked backup options</h4>
                        <div className="backup-list">
                          {backups.map((b, i) => (
                            <div key={b.employeeId} className="backup-row">
                              <span className="rank">{i + 1}</span>
                              <div><strong>{b.name}</strong><small>{b.detail}</small></div>
                              <span className="score">{Math.round(b.score)}</span>
                              <button className="btn btn-small" onClick={() => {
                                if (!conflict.allocationId || conflict.date.length !== 10) return;
                                addManual({
                                  id: `backup-${Date.now()}-${b.employeeId}`,
                                  date: conflict.date,
                                  allocationId: conflict.allocationId,
                                  employeeId: b.employeeId,
                                  action: 'ADD',
                                  note: `Backup for ${conflict.title}`,
                                });
                                setMessage(`${b.name} assigned to close the gap. Roster revalidated.`);
                                setOpen(null);
                              }}><UserPlus size={14} /> Assign</button>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="hint-box"><Info size={16} /><span>No available backup on this date. Consider a comp-off swap, client exception, or cross-training a pod colleague.</span></div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
