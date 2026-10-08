import { useMemo, useState } from 'react';
import { CalendarDays, Clock3, Pencil, Plus, Trash2, TrendingDown, X, Zap, BarChart3, Gauge } from 'lucide-react';
import { Metric } from '@/components/Metric';
import { BarChart } from '@/components/BarChart';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/ToastContext';
import { createPlanYear, deletePlanYear, updateMonthlyProfile } from '@/data/api';
import type { Machine, MonthlyProfile, ProfileInput, Season, View } from '@/types';

type Props = {
  profiles: MonthlyProfile[];
  machines: Machine[];
  onChanged: () => Promise<void>;
  setView: (v: View) => void;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Categorical slots 1-3 (validated). Colour follows the year itself, so it never repaints when years change.
const YEAR_COLORS = ['#2a78d6', '#eb6834', '#1baf7a'];
const yearColor = (y: number) => YEAR_COLORS[((y % 3) + 3) % 3];

const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;
const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${Math.round(n)}`);

function totals(rows: MonthlyProfile[]) {
  const bill = rows.reduce((s, p) => s + p.monthlyBill, 0);
  const kwh = rows.reduce((s, p) => s + p.monthlyKwh, 0);
  const saving = rows.reduce((s, p) => s + p.monthlySaving, 0);
  const potential = rows.reduce((s, p) => s + p.potentialSaving, 0);
  const usedMonths = rows.filter((p) => p.optimized).length;
  const baseline = rows.reduce((s, p) => s + p.monthlyBaseline, 0);
  const hours = rows.reduce((s, p) => s + p.hoursPerDay * p.workingDays, 0);
  const days = rows.reduce((s, p) => s + p.workingDays, 0);
  return { bill, kwh, saving, potential, usedMonths, baseline, hours, days };
}

export function Planning({ profiles, machines, onChanged, setView }: Props) {
  const { toast } = useToast();
  const years = useMemo(() => [...new Set(profiles.map((p) => p.year))].sort((a, b) => a - b), [profiles]);
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(years.includes(thisYear) ? thisYear : years[years.length - 1] ?? thisYear);
  const [newYear, setNewYear] = useState<number>((years[years.length - 1] ?? thisYear) + 1);
  const [editTarget, setEditTarget] = useState<MonthlyProfile | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selected = years.includes(year) ? year : years[years.length - 1];
  const rows = profiles.filter((p) => p.year === selected);
  const t = totals(rows);
  const prev = totals(profiles.filter((p) => p.year === selected - 1));
  const billChange = prev.bill > 0 ? ((t.bill - prev.bill) / prev.bill) * 100 : null;

  const chartYears = years.slice(-3);
  const seriesFor = (pick: (p: MonthlyProfile) => number) =>
    chartYears.map((y) => ({
      key: String(y),
      label: String(y),
      color: yearColor(y),
      values: MONTHS.map((_, i) => {
        const p = profiles.find((x) => x.year === y && x.month === i + 1);
        return p ? pick(p) : 0;
      }),
    }));

  const addYear = async () => {
    try {
      await createPlanYear(newYear);
      await onChanged();
      setYear(newYear);
      setNewYear(Math.max(newYear, ...years) + 1);
      toast(`${newYear} added${years.includes(newYear - 1) ? ` (copied from ${newYear - 1})` : ' with seasonal defaults'}.`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not add year.', 'error');
    }
  };

  const removeYear = async () => {
    try {
      await deletePlanYear(selected);
      setConfirmDelete(false);
      await onChanged();
      toast(`${selected} removed.`, 'warning');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not delete year.', 'error');
    }
  };

  const saveProfile = async (p: MonthlyProfile, input: ProfileInput) => {
    try {
      await updateMonthlyProfile(p.id, input);
      await onChanged();
      setEditTarget(null);
      toast(`${MONTHS[p.month - 1]} ${p.year} updated.`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save.', 'error');
    }
  };

  return (
    <main className="app-main">
      <section className="page-intro">
        <div>
          <div className="step-label">PLANNING · SEASONAL OPERATING PROFILE</div>
          <h1>Seasonal Plan &amp; Yearly Bill</h1>
          <p>
            Set working days, operating hours and active machines for each month. Each month is optimized with the same
            model as the daily schedule, then multiplied by its working days.
          </p>
        </div>
        <div className="year-controls">
          <div className="year-chips">
            {years.map((y) => (
              <button key={y} className={y === selected ? 'active' : ''} onClick={() => setYear(y)}>
                <i style={{ background: yearColor(y) }} />{y}
              </button>
            ))}
          </div>
          <div className="year-add">
            <input type="number" min={2000} max={2100} value={newYear} onChange={(e) => setNewYear(Number(e.target.value))} aria-label="Year to add" />
            <button className="secondary-button" onClick={addYear}><Plus size={15} /> Add year</button>
            {years.length > 0 && (
              <button className="secondary-button" title={`Delete ${selected}`} onClick={() => setConfirmDelete(true)}><Trash2 size={15} /></button>
            )}
          </div>
        </div>
      </section>

      {rows.length === 0 ? (
        <section className="table-card"><div className="empty-state planning-empty"><CalendarDays size={32} /><b>No plan yet</b><p>Add a year to start with seasonal defaults.</p></div></section>
      ) : (
        <>
          <section className="metric-grid">
            <Metric icon={<BarChart3 />} label={`Annual Bill ${selected}`} value={rs(t.bill)}
              note={billChange === null ? 'Optimized schedule × working days' : `${billChange >= 0 ? '+' : ''}${billChange.toFixed(1)}% vs ${selected - 1}`} tone="blue" />
            <Metric icon={<Zap />} label="Annual Energy" value={`${Math.round(t.kwh).toLocaleString()} kWh`} note={`${t.days} working days`} tone="amber" />
            {t.usedMonths > 0 ? (
              <Metric icon={<TrendingDown />} label="Optimizer Saving" value={rs(t.saving)}
                note={`${t.baseline > 0 ? ((t.saving / t.baseline) * 100).toFixed(1) : 0}% saved · app used ${t.usedMonths}/12 months`} tone="green" />
            ) : (
              <Metric icon={<TrendingDown />} label="Missed Saving" value={rs(t.potential)}
                note="App not used this year — could have been saved" tone="red" />
            )}
            <Metric icon={<Clock3 />} label="Productive Hours" value={`${Math.round(t.hours).toLocaleString()} h`} note="Operating hours × working days" tone="blue" />
          </section>
          <section className="metric-grid">
            <Metric icon={<Gauge />} label="kWh / Productive Hour" value={t.hours > 0 ? (t.kwh / t.hours).toFixed(2) : '0'} note={`${selected} average`} tone="amber" />
            <Metric icon={<Gauge />} label="Cost / Productive Hour" value={t.hours > 0 ? rs(t.bill / t.hours) : 'Rs. 0'} note={`${selected} average`} tone="green" />
            <Metric icon={<CalendarDays />} label="Peak-Season Bill" value={rs(rows.filter((p) => p.season === 'Peak').reduce((s, p) => s + p.monthlyBill, 0))}
              note={`${rows.filter((p) => p.season === 'Peak').length} peak months`} tone="red" />
            <Metric icon={<CalendarDays />} label="Avg Monthly Bill" value={rs(t.bill / rows.length)} note={`${rows.length} months planned`} tone="blue" />
          </section>

          <section className="table-card chart-section">
            <div className="table-head">
              <div>
                <h2>Bill &amp; Energy by Year <span>{chartYears.join(' · ')}</span></h2>
                <p>Projected monthly totals for each planned year{years.length > 3 ? ' (latest 3 years shown)' : ''}. Hover a month for exact values.</p>
              </div>
            </div>
            <div className="chart-grid">
              <BarChart title="Monthly electricity bill" subtitle="Rs. per month" categories={MONTHS}
                series={seriesFor((p) => p.monthlyBill)} format={rs} axisFormat={compact} />
              <BarChart title="Monthly energy use" subtitle="kWh per month" categories={MONTHS}
                series={seriesFor((p) => p.monthlyKwh)} format={(n) => `${Math.round(n).toLocaleString()} kWh`} axisFormat={compact} />
            </div>
            <div className="table-scroll">
              <table className="year-table">
                <thead><tr><th>Year</th><th>App used</th><th>Annual bill</th><th>Annual kWh</th><th>Optimizer saving</th><th>kWh / prod. h</th><th>Rs / prod. h</th><th>Change vs previous</th></tr></thead>
                <tbody>
                  {years.map((y) => {
                    const yt = totals(profiles.filter((p) => p.year === y));
                    const pt = totals(profiles.filter((p) => p.year === y - 1));
                    const ch = pt.bill > 0 ? ((yt.bill - pt.bill) / pt.bill) * 100 : null;
                    return (
                      <tr key={y}>
                        <td><span className="year-dot" style={{ background: yearColor(y) }} /><b>{y}</b></td>
                        <td className="mono">{yt.usedMonths === 0 ? <span className="season-chip season-low">Not used</span> : `${yt.usedMonths} / 12 months`}</td>
                        <td className="mono">{rs(yt.bill)}</td>
                        <td className="mono">{Math.round(yt.kwh).toLocaleString()}</td>
                        <td className="mono">{yt.saving > 0 ? <span className="green-text">{rs(yt.saving)}</span> : <span className="red-text">missed {rs(yt.potential)}</span>}</td>
                        <td className="mono">{yt.hours > 0 ? (yt.kwh / yt.hours).toFixed(2) : '—'}</td>
                        <td className="mono">{yt.hours > 0 ? rs(yt.bill / yt.hours) : '—'}</td>
                        <td className="mono">{ch === null ? '—' : `${ch >= 0 ? '+' : ''}${ch.toFixed(1)}%`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="table-card">
            <div className="table-head">
              <div>
                <h2>Monthly Operating Profile <span>{selected}</span></h2>
                <p>Edit a month to change its season, working days, operating hours or which machines run.</p>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Month</th><th>Season</th><th>App</th><th>Working days</th><th>Operating hours</th><th>Active machines</th>
                    <th>kWh / day</th><th>Monthly kWh</th><th>Monthly bill</th><th>Saving</th><th>kWh / prod. h</th><th>Rs / prod. h</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <td><b>{MONTHS[p.month - 1]}</b></td>
                      <td><span className={`season-chip season-${p.season.toLowerCase()}`}>{p.season}</span></td>
                      <td>{p.optimized ? <span className="ready-chip"><span /> Optimized</span> : <span className="ready-chip bad-chip"><span /> Not used</span>}</td>
                      <td className="mono center">{p.workingDays}</td>
                      <td className="mono">{p.startTime} – {p.endTime}<small className="table-muted">{p.hoursPerDay} h/day</small></td>
                      <td className="mono">
                        {p.activeMachines} / {machines.length}
                        {p.skipped.length > 0 && <small className="red-text">Not scheduled: {p.skipped.join(', ')}</small>}
                      </td>
                      <td className="mono">{p.dailyKwh.toFixed(1)}</td>
                      <td className="mono">{Math.round(p.monthlyKwh).toLocaleString()}</td>
                      <td className="mono"><b>{rs(p.monthlyBill)}</b></td>
                      <td className="mono">
                        {p.optimized
                          ? (p.monthlySaving > 0 ? <span className="green-text">{rs(p.monthlySaving)}</span> : '—')
                          : (p.potentialSaving > 0 ? <span className="red-text" title="Saving the optimizer would have made">missed {rs(p.potentialSaving)}</span> : '—')}
                      </td>
                      <td className="mono">{p.kwhPerHour.toFixed(2)}</td>
                      <td className="mono">{rs(p.costPerHour)}</td>
                      <td><div className="row-actions"><button title="Edit month" onClick={() => setEditTarget(p)}><Pencil size={15} /></button></div></td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td><b>TOTAL</b></td><td></td>
                    <td className="mono">{t.usedMonths}/12</td>
                    <td className="mono center"><b>{t.days}</b></td>
                    <td className="mono">{Math.round(t.hours).toLocaleString()} h</td><td></td><td></td>
                    <td className="mono"><b>{Math.round(t.kwh).toLocaleString()}</b></td>
                    <td className="mono"><b>{rs(t.bill)}</b></td>
                    <td className="mono">{t.saving > 0 ? <b className="green-text">{rs(t.saving)}</b> : <b className="red-text">missed {rs(t.potential)}</b>}</td>
                    <td className="mono">{t.hours > 0 ? (t.kwh / t.hours).toFixed(2) : '—'}</td>
                    <td className="mono">{t.hours > 0 ? rs(t.bill / t.hours) : '—'}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="table-note">
              <Clock3 size={17} />
              <span>
                <b>Monthly bill</b> = cost of one working day × working days — the optimized schedule when the app is used,
                otherwise the usual schedule (<b>missed</b> = what the optimizer would have saved). <b>Productive hours</b> = operating hours (start → end).
                {' '}<b>kWh / prod. h</b> = daily kWh ÷ hours per day; <b>Rs / prod. h</b> = daily cost ÷ hours per day.
              </span>
            </div>
          </section>
        </>
      )}

      <div className="bottom-actions">
        <span><span className="status-dot" /> {years.length} planned year{years.length === 1 ? '' : 's'} · recalculated from current machines and tariffs</span>
        <button className="secondary-button" onClick={() => setView('dashboard')}>Back to Dashboard</button>
        <button className="primary-button" onClick={() => setView('reports')}>View Reports</button>
      </div>

      {editTarget && (
        <ProfileModal profile={editTarget} machines={machines} close={() => setEditTarget(null)} onSave={(input) => saveProfile(editTarget, input)} />
      )}
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${selected}`}
        message={`Remove the ${selected} operating plan (12 months)? Machines, schedules and reports are not affected.`}
        onConfirm={removeYear}
        onCancel={() => setConfirmDelete(false)}
      />
    </main>
  );
}

function ProfileModal({ profile, machines, close, onSave }: {
  profile: MonthlyProfile;
  machines: Machine[];
  close: () => void;
  onSave: (input: ProfileInput) => void;
}) {
  const [season, setSeason] = useState<Season>(profile.season);
  const [optimized, setOptimized] = useState(profile.optimized);
  const [workingDays, setWorkingDays] = useState(profile.workingDays);
  const [startTime, setStartTime] = useState(profile.startTime);
  const [endTime, setEndTime] = useState(profile.endTime);
  const [inactive, setInactive] = useState<string[]>(profile.inactiveMachineIds);
  const [error, setError] = useState('');

  const toggle = (id: string) => setInactive((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const save = () => {
    if (endTime <= startTime) { setError('End time must be after the start time.'); return; }
    if (workingDays < 0 || workingDays > 31) { setError('Working days must be between 0 and 31.'); return; }
    onSave({ season, optimized, workingDays, startTime, endTime, inactiveMachineIds: inactive });
  };
  const hours = Math.max(0, (Number(endTime.slice(0, 2)) * 60 + Number(endTime.slice(3, 5)) - Number(startTime.slice(0, 2)) * 60 - Number(startTime.slice(3, 5))) / 60);

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal-card add-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">
          <div className="soft-icon"><CalendarDays size={20} /></div>
          <div>
            <h2>{MONTHS[profile.month - 1]} {profile.year}</h2>
            <p>Operating profile for this month.</p>
          </div>
          <button onClick={close}><X /></button>
        </div>
        <div className="form-grid">
          <label>Season
            <select value={season} onChange={(e) => setSeason(e.target.value as Season)}>
              <option>Peak</option><option>Normal</option><option>Low</option>
            </select>
          </label>
          <label>Working Days
            <input type="number" min={0} max={31} value={workingDays} onChange={(e) => { setWorkingDays(Number(e.target.value)); setError(''); }} />
          </label>
          <label>Start Time
            <input type="time" value={startTime} onChange={(e) => { setStartTime(e.target.value); setError(''); }} />
          </label>
          <label>End Time
            <input type="time" value={endTime} onChange={(e) => { setEndTime(e.target.value); setError(''); }} />
          </label>
        </div>
        <label className="optimizer-toggle">
          <input type="checkbox" checked={optimized} onChange={(e) => setOptimized(e.target.checked)} />
          <span><b>Optimizer used this month</b><small>Off = the factory ran its usual schedule (before the app), so the bill is the higher usual cost.</small></span>
        </label>
        <div className="machine-toggle-list">
          <b>Active machines</b>
          {machines.map((m) => (
            <label key={m.id}>
              <input type="checkbox" checked={!inactive.includes(m.id)} onChange={() => toggle(m.id)} />
              <span>{m.name}</span>
              <small>{(m.quantity * m.power).toLocaleString()} W · {m.hours} h</small>
            </label>
          ))}
        </div>
        {error && <div className="field-error form-error">{error}</div>}
        <div className="form-summary">
          <Clock3 size={16} />
          <span>{hours.toFixed(1)} productive h/day · {machines.length - inactive.length} of {machines.length} machines active</span>
        </div>
        <div className="modal-actions">
          <button className="secondary-button" onClick={close}>Cancel</button>
          <button className="primary-button" onClick={save}>Save Month</button>
        </div>
      </div>
    </div>
  );
}
