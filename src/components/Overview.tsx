import { Users, Building2, GitBranch, ShieldCheck, CalendarDays, CalendarOff, ArrowRight, Info } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { Card, Stat, Pill, SectionHeader } from './ui';
import { monthLabel, monthDays } from '../utils/date';

export default function Overview({ onNavigate }: { onNavigate: (p: 'roster' | 'conflicts' | 'data' | 'changes') => void }) {
  const { state } = useApp();
  const { employees, brands, processes, pods, allocations, holidays, roster, rosterMonth } = state;
  const dates = monthDays(rosterMonth);
  const monthHolidays = holidays.filter((h) => h.date.startsWith(rosterMonth));

  let required = 0;
  let ok = 0;
  allocations.forEach((a) => dates.forEach((d) => {
    const c = roster?.coverage[a.id]?.[d];
    if (c && c.status !== 'NOT_REQUIRED') { required++; if (c.status === 'OK') ok++; }
  }));
  const coveragePct = required ? Math.round((ok / required) * 100) : 0;
  const mandatory = roster?.conflicts.filter((c) => c.mandatory) ?? [];
  const workingCells = roster ? Object.values(roster.cells).reduce((n, byDate) => n + Object.values(byDate).filter((c) => c.state === 'WORKING').length, 0) : 0;

  const ruleMix = allocations.reduce<Record<string, number>>((acc, a) => {
    acc[a.rule.label] = (acc[a.rule.label] ?? 0) + 1;
    return acc;
  }, {});

  const podStats = pods.map((pod) => ({
    pod,
    members: employees.filter((e) => e.podId === pod.id),
  }));

  return (
    <div className="page-stack">
      <div className="hero card">
        <div>
          <Pill tone="blue">{monthLabel(rosterMonth)} plan</Pill>
          <h2>Roster planning at a glance</h2>
          <p>
            Deterministic generation across {brands.length} brands, {processes.length} processes and {pods.length} pods.
            Mandatory client coverage always wins over employee preferences; anything that cannot be satisfied is surfaced below.
          </p>
        </div>
        <div className="hero-gauge">
          <div className="gauge-ring" style={{ background: `conic-gradient(#4f46e5 ${coveragePct}%, #e2e8f0 0)` }}>
            <div className="gauge-inner"><strong>{coveragePct}%</strong><span>coverage</span></div>
          </div>
        </div>
      </div>

      <div className="stat-grid">
        <Stat label="Employees" value={employees.length} sub={`${pods.length} pods · ${pods.length} pod leads`} tone="blue" />
        <Stat label="Brands" value={brands.length} sub={`${brands.filter((b) => allocations.filter((a) => a.brandId === b.id).every((a) => a.employeeIds.length === 1)).length} single-resource`} tone="purple" />
        <Stat label="Brand-process allocations" value={allocations.length} sub={`${processes.length} distinct processes`} tone="green" />
        <Stat label="Working assignments" value={workingCells} sub={`across ${dates.length} days`} tone="blue" />
        <Stat label="Public holidays" value={monthHolidays.length} sub={monthHolidays.map((h) => h.name).join(', ') || 'None this month'} tone="amber" />
        <Stat label="Mandatory conflicts" value={mandatory.length} sub={mandatory.length ? 'Needs attention before publishing' : 'Roster is publishable'} tone={mandatory.length ? 'red' : 'green'} />
      </div>

      <div className="two-col">
        <Card>
          <SectionHeader title="Operating calendar mix" subtitle="Each allocation carries its own coverage rule" />
          <div className="rule-list">
            {Object.entries(ruleMix).map(([label, count]) => (
              <div key={label} className="rule-row">
                <span>{label}</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(count / allocations.length) * 100}%` }} /></div>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          <div className="callout">
            <Info size={16} />
            <span>A brand may run Customer Support 365 days while its Retention process works Mon–Fri. Rules live on the allocation, not on the employee.</span>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Pods & leads" subtitle="Every employee belongs to exactly one operational pod" />
          <div className="pod-grid">
            {podStats.map(({ pod, members }) => (
              <div key={pod.id} className="pod-card">
                <div className="pod-dot" style={{ background: pod.color }} />
                <div>
                  <strong>{pod.name}</strong>
                  <span>{members.length} employees</span>
                </div>
                <Pill tone="neutral">{employees.find((e) => e.id === pod.leadEmployeeId)?.name.split(' ')[0]} · lead</Pill>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="two-col">
        <Card>
          <SectionHeader
            title="Coverage health"
            subtitle={`${ok} of ${required} required allocation-days are fully staffed`}
            action={<button className="link-btn" onClick={() => onNavigate('conflicts')}>View conflicts <ArrowRight size={14} /></button>}
          />
          {mandatory.length === 0 ? (
            <div className="good-state"><ShieldCheck size={22} /> No mandatory conflicts — every required process has enough people.</div>
          ) : (
            <div className="mini-conflicts">
              {mandatory.slice(0, 5).map((c) => (
                <div key={c.id} className="mini-conflict">
                  <span className="dot dot-red" />
                  <div><strong>{c.title}</strong><span>{c.date} · {brands.find((b) => b.id === c.brandId)?.name}</span></div>
                  <Pill tone="red">Critical</Pill>
                </div>
              ))}
              {mandatory.length > 5 && <div className="more">+{mandatory.length - 5} more</div>}
            </div>
          )}
        </Card>

        <Card>
          <SectionHeader title="What you can do here" subtitle="A quick tour of the assessment workflow" />
          <div className="action-list">
            <button onClick={() => onNavigate('roster')}><span className="action-icon"><CalendarDays size={18} /></span><div><strong>Inspect the roster</strong><small>Company, pod, brand, process and employee views</small></div><ArrowRight size={16} /></button>
            <button onClick={() => onNavigate('conflicts')}><span className="action-icon"><GitBranch size={18} /></span><div><strong>Review conflicts</strong><small>Coverage gaps, leave clashes and preference trade-offs</small></div><ArrowRight size={16} /></button>
            <button onClick={() => onNavigate('changes')}><span className="action-icon"><CalendarOff size={18} /></span><div><strong>Simulate an absence</strong><small>See gaps appear and pick a ranked backup resource</small></div><ArrowRight size={16} /></button>
            <button onClick={() => onNavigate('data')}><span className="action-icon"><Users size={18} /></span><div><strong>Change the setup</strong><small>Add employees, brands, rules and coverage requirements</small></div><ArrowRight size={16} /></button>
          </div>
        </Card>
      </div>

      <Card>
        <SectionHeader title="Rule legend" subtitle="How a day is classified for an allocation" />
        <div className="legend">
          <div><Pill tone="blue">WORKING</Pill> Employee assigned to a brand-process</div>
          <div><Pill tone="neutral">OFF</Pill> Available but not needed that day</div>
          <div><Pill tone="amber">LEAVE</Pill> Approved planned leave, comp-off or sick leave</div>
          <div><Pill tone="red">UNAVAILABLE</Pill> Availability change or manual override</div>
          <div><Building2 size={15} /> Header tinted red = public holiday · orange = Sunday</div>
        </div>
      </Card>
    </div>
  );
}
