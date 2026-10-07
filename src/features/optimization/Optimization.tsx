import { useState } from 'react';
import {
  ArrowLeft, BarChart3, Check, CheckCircle2, ChevronDown, CircleHelp,
  Download, Info, RefreshCw, Save, ShieldCheck, Sparkles, TrendingDown,
} from 'lucide-react';
import { Metric } from '@/components/Metric';
import { useToast } from '@/components/ToastContext';
import { downloadCsv, runOptimization } from '@/data/api';
import type { Machine, Optimization as OptData, Tariff, View } from '@/types';

type Kind = 'off' | 'day' | 'peak';
type Segment = { left: number; width: number };

const toMin = (t: string) => {
  const [h, m] = t.split(':');
  return Number(h) * 60 + Number(m ?? 0);
};

// Check 'off' first: "Off-Peak" also contains "peak".
function tariffKind(period: string): Kind {
  const p = period.toLowerCase();
  if (p.includes('off')) return 'off';
  if (p.includes('peak')) return 'peak';
  return 'day';
}

// Split a start/end pair (in minutes) into 0-1440 segments, handling wrap past midnight.
function toSegments(start: number, end: number): Segment[] {
  const seg = (a: number, b: number) => ({ left: (a / 1440) * 100, width: ((b - a) / 1440) * 100 });
  if (end > start) return [seg(start, end)];
  if (end === start) return [];
  return [seg(start, 1440), ...(end > 0 ? [seg(0, end)] : [])];
}

function tariffBands(tariffs: Tariff[]) {
  return tariffs.flatMap((t) =>
    toSegments(toMin(t.startTime), toMin(t.endTime)).map((s) => ({ ...s, kind: tariffKind(t.period), rate: t.rate, period: t.period })),
  );
}

type Props = {
  machines: Machine[];
  optimization: OptData;
  onChanged: () => Promise<void>;
  tariffs: Tariff[];
  setView: (v: View) => void;
};

const TICKS = [0, 4, 8, 12, 16, 20, 24];

const fmt12 = (t: string) => {
  const h = Number(t.slice(0, 2));
  return `${String(h % 12 || 12).padStart(2, '0')}:${t.slice(3, 5)} ${h >= 12 ? 'PM' : 'AM'}`;
};

export function Optimization({ machines, optimization: o, onChanged, tariffs, setView }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [rerunning, setRerunning] = useState(false);

  const offPeak = tariffs.find((t) => tariffKind(t.period) === 'off')?.rate ?? 33;
  const dayRate = tariffs.find((t) => tariffKind(t.period) === 'day')?.rate ?? 47;
  const peakRate = tariffs.find((t) => tariffKind(t.period) === 'peak')?.rate ?? 106;
  const bands = tariffBands(tariffs);
  const slotFor = (id: string) => o.schedules?.find((x) => x.machineId === id);

  const hasResult = (o.schedules?.length ?? 0) > 0;

  // The backend already stores the schedule when the optimizer runs, so "Apply" just confirms it.
  const handleSave = () => {
    if (!hasResult) { toast('Run the optimization first.', 'info'); return; }
    toast('Schedule saved.', 'success');
  };

  const handleRerun = async () => {
    setRerunning(true);
    toast('Re-running optimization model...', 'info');
    try {
      const result = await runOptimization();
      await onChanged();
      if (result.skipped?.length) {
        toast(`Not scheduled (window too short for runtime or outside factory hours): ${result.skipped.join(', ')}`, 'warning');
      } else if (result.dailySaving > 0) {
        toast(`Optimization complete. Daily saving Rs. ${result.dailySaving.toFixed(0)} (${result.savingPercent}%).`, 'success');
      } else {
        toast('Optimization complete. No cheaper schedule found with current available windows.', 'info');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Optimization failed.', 'error');
    } finally {
      setRerunning(false);
    }
  };

  const handleExport = () => {
    if (!hasResult) { toast('Nothing to export. Run the optimization first.', 'info'); return; }
    downloadCsv('optimized-schedule.csv', [
      ['Machine', 'Available window', 'Start', 'End', 'Energy (kWh)', 'Cost (Rs)', 'Saving (Rs)'],
      ...machines.flatMap((m) => {
        const s = slotFor(m.id);
        return s ? [[m.name, m.window, s.start, s.end, s.energy, s.cost, s.saving]] : [];
      }),
    ]);
  };

  return (
    <main className="app-main optimization-page">
      <section className="page-intro optimization-intro">
        <div>
          <div className="step-label">STEP 3 OF 4 · MILP OPTIMIZATION</div>
          {hasResult && <div className="success-pill"><CheckCircle2 size={15} /> Optimization Completed</div>}
          <h1>Recommended Machine Schedule</h1>
          <p>Your optimized operating schedule reduces electricity costs while maintaining required machine runtime and garment line throughput.</p>
        </div>
        <div className="intro-actions">
          <button className="secondary-button" onClick={handleExport}><Download size={16} /> Export</button>
          <button className="secondary-button" onClick={handleRerun} disabled={rerunning}>
            {rerunning ? <><RefreshCw className="spin" size={16} /> Running...</> : <><RefreshCw size={16} /> Re-run</>}
          </button>
          <button className="primary-button" onClick={handleSave}><Save size={16} /> Apply / Save</button>
        </div>
      </section>

      <section className="metric-grid optimization-metrics">
        <Metric icon={<TrendingDown />} label="Current Daily Cost" value={`Rs. ${o.currentCost.toLocaleString()}`} note="If each machine starts at window open" tone="red" />
        <Metric icon={<CheckCircle2 />} label="Optimized Daily Cost" value={`Rs. ${o.optimizedCost.toLocaleString()}`} note="Cheapest legal start times" tone="green" />
        <Metric icon={<Sparkles />} label="Daily Saving" value={`Rs. ${Number(o.dailySaving).toLocaleString()}`} note={`+${o.savingPercent}% saved every day`} tone="green" />
        <Metric icon={<BarChart3 />} label="Monthly Saving" value={`Rs. ${Number(o.monthlySaving).toLocaleString()}`} note="Based on working days / month" tone="blue" />
      </section>

      <div className="audit-banner">
        <div className="audit-icon"><ShieldCheck /></div>
        <div>
          <b>Load Shift Feasibility Audit <span>Cost Reduction: {o.savingPercent}%</span></b>
          {o.skipped && o.skipped.length > 0 && <p style={{ color: '#b83232' }}><strong>Not scheduled:</strong> {o.skipped.join(', ')} — runtime does not fit its window inside factory hours.</p>}
          <p>
            <strong>Important Notice:</strong> Energy stays about {o.energy} kWh/day.
            Bill changes only when runtime moves across CEB rates
            (Off-Peak Rs.{offPeak} / Day Rs.{dayRate} / Peak Rs.{peakRate}).
            {o.dailySaving <= 0
              ? ' Zero saving means every machine is already on the cheapest start allowed by its available window.'
              : ` Model found Rs. ${o.dailySaving} per day by shifting load away from expensive slots.`}
          </p>
        </div>
      </div>

      <section className="schedule-card">
        <div className="section-heading">
          <div>
            <h2>Daily Schedule Timeline <span>24-Hour Master Schedule</span></h2>
            <p>The thin line under each bar is the machine's available window (constraint). The solid bar is the run time chosen by the solver. Both update automatically when machines or factory hours change.</p>
          </div>
          <div className="legend">
            <span className="offpeak" /> Off-peak <span className="day" /> Day standard <span className="peak" /> Peak <span className="winlegend" /> Available window <span className="runlegend" /> Optimized run
          </div>
        </div>
        <div className="tariff-strip">
          {bands.map((b, i) => (
            <div key={i} className={`tband tband-${b.kind}`} style={{ left: `${b.left}%`, width: `${b.width}%` }}>
              {b.width > 8 ? `${b.period} · Rs. ${b.rate}/kWh` : ''}
            </div>
          ))}
        </div>
        <div className="time-ruler">
          <div className="ruler-inner">
            {TICKS.map((h) => (
              <span key={h} className={h === 0 ? 'first' : h === 24 ? 'last' : ''} style={{ left: `${(h / 24) * 100}%` }}>
                {h % 24 === 0 ? '12 AM' : h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`}
              </span>
            ))}
          </div>
        </div>
        {machines.map((m, i) => {
          const slot = slotFor(m.id);
          const win = toSegments(toMin(m.availableStart ?? '00:00'), toMin(m.availableEnd ?? '00:00'));
          const run = slot ? toSegments(toMin(slot.start), toMin(slot.end)) : [];
          return (
            <div className="schedule-row" key={m.id}>
              <div className="schedule-label">
                <b>{i + 1}. {m.name}</b>
                <span>{m.quantity} Units • {((m.quantity * m.power) / 1000).toFixed(1)} kW total • {m.hours}h required</span>
                <strong className={slot ? '' : 'red-text'}>{slot ? `Run ${fmt12(slot.start)} – ${fmt12(slot.end)}` : 'Not scheduled'}</strong>
              </div>
              <div className="track" style={{ backgroundImage: 'none' }}>
                {TICKS.slice(1, -1).map((h) => (
                  <div key={h} className="grid-line" style={{ left: `${(h / 24) * 100}%` }} />
                ))}
                {bands.map((b, k) => (
                  <div key={k} className={`track-band tband-${b.kind}`} style={{ left: `${b.left}%`, width: `${b.width}%` }} />
                ))}
                {win.map((w, k) => (
                  <div key={k} className="window-bar" style={{ left: `${w.left}%`, width: `${w.width}%` }} title={`Available ${m.window}`} />
                ))}
                {run.map((r, k) => {
                  const label = `${fmt12(slot!.start)} – ${fmt12(slot!.end)}`;
                  const inside = r.width > 17;
                  return (
                    <div key={k} className={`schedule-bar bar-run bar-c${i % 3}`} style={{ left: `${r.left}%`, width: `${r.width}%` }}>
                      {k === 0 && inside ? label : ''}
                    </div>
                  );
                })}
                {run.length > 0 && run[0].width <= 17 && (() => {
                  // Narrow bar: print the time beside it (right side, or left side near the end of the day).
                  const label = `${fmt12(slot!.start)} – ${fmt12(slot!.end)}`;
                  const last = run[run.length - 1];
                  const nearEnd = last.left + last.width > 72;
                  return (
                    <span
                      className="bar-label-out"
                      style={nearEnd ? { right: `${100 - run[0].left}%`, marginRight: 8 } : { left: `${last.left + last.width}%`, marginLeft: 8 }}
                    >
                      {label}
                    </span>
                  );
                })()}
              </div>
              <small className="window-note">Available window: {m.window}{slot ? ` • ${slot.energy} kWh • Cost Rs. ${slot.cost.toLocaleString()}${slot.saving > 0 ? ` • Saves Rs. ${slot.saving.toLocaleString()}` : ''}` : ' • runtime does not fit this window inside factory hours'}</small>
            </div>
          );
        })}
        <div className="schedule-foot">
          <span><Info size={14} /> The schedule recalculates automatically whenever machines or factory hours change.</span>
          <span>{`CEB Peak Rs.${peakRate} · Day Rs.${dayRate} · Off-Peak Rs.${offPeak}`}</span>
        </div>
      </section>

      <section className="actions-grid">
        <div className="section-heading">
          <div>
            <h2>Recommended Actions for Shift Supervisors</h2>
            <p>Immediate operational steps for tomorrow morning&apos;s shift handover.</p>
          </div>
        </div>
        <div className="action-cards">
          {machines.map((m) => (
            <div className="action-card" key={m.id}>
              <div className="action-card-head">
                <span>{m.category.toUpperCase()} LINE</span>
                <small>{((m.quantity * m.power) / 1000).toFixed(1)} kW</small>
              </div>
              <b>Run {m.name} ({slotFor(m.id) ? `${fmt12(slotFor(m.id)!.start)} – ${fmt12(slotFor(m.id)!.end)}` : m.window})</b>
              <p>
                Run for {m.hours}h at the optimized time (allowed window {m.window}).
              </p>
              <span className="green-text">Optimizer recommended start</span>
            </div>
          ))}
        </div>
      </section>

      <button type="button" className="how-button" onClick={() => setOpen(!open)}>
        <CircleHelp size={18} />
        <b>How was this schedule created?</b>
        <span>CEB Time-of-Day mathematical model</span>
        <ChevronDown className={open ? 'rotate' : ''} size={18} />
      </button>
      {open && (
        <div className="how-body">
          Baseline cost assumes every machine starts at the opening of its available window.
          The optimizer tries every 30-minute start inside the window (and inside factory hours). For each start it adds up
          power (kW) × 0.5 h × the CEB rate of every half-hour the machine would run
          {` (Off-Peak ${offPeak} / Day ${dayRate} / Peak ${peakRate})`}, then picks the cheapest start.
          Saving appears only when a different start is cheaper than starting at window open
          (for example Peak → Off-Peak). Same kWh, different clock time, different bill.
        </div>
      )}

      <div className="bottom-actions">
        <button className="secondary-button" onClick={() => setView('machines')}><ArrowLeft size={16} /> Back to Machines</button>
        <button className="primary-button" onClick={handleSave}><Save size={16} /> Apply / Save Recommended Schedule</button>
        <button className="primary-button" onClick={() => setView('dashboard')}>View Dashboard <ArrowLeft size={16} style={{ transform: 'scaleX(-1)' }} /></button>
      </div>
    </main>
  );
}
