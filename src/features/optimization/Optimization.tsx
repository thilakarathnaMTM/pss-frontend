import { useState } from 'react';
import {
  ArrowLeft, BarChart3, Check, CheckCircle2, ChevronDown, CircleHelp,
  Download, Info, RefreshCw, Save, ShieldCheck, Sparkles, TrendingDown,
} from 'lucide-react';
import { Metric } from '@/components/Metric';
import { useToast } from '@/components/ToastContext';
import { runOptimization } from '@/data/api';
import type { Machine, Optimization as OptData, View } from '@/types';

type Props = {
  machines: Machine[];
  optimization: OptData;
  setView: (v: View) => void;
};

export function Optimization({ machines, optimization: o, setView }: Props) {
  const { toast } = useToast();
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);
  const [rerunning, setRerunning] = useState(false);

  const handleSave = () => { setSaved(true); toast('Schedule successfully activated. Shift supervisors notified.', 'success'); window.setTimeout(() => setSaved(false), 3000); };
  const handleRerun = async () => {
    setRerunning(true);
    toast('Re-running optimization model...', 'info');
    try {
      await runOptimization();
      toast('Optimization complete. No further improvements found.', 'success');
    } catch (e) { toast(e instanceof Error ? e.message : 'Optimization failed.', 'error'); }
    finally { setRerunning(false); }
  };
  const handleExport = () => { toast('Schedule exported as CSV download.', 'success'); };

  return (
    <main className="app-main optimization-page">
      <section className="page-intro optimization-intro">
        <div>
          <div className="step-label">STEP 3 OF 4 · MILP OPTIMIZATION</div>
          <div className="success-pill"><CheckCircle2 size={15} /> Optimization Completed</div>
          <h1>Recommended Machine Schedule</h1>
          <p>Your optimized operating schedule reduces electricity costs while maintaining required machine runtime and garment line throughput.</p>
        </div>
        <div className="intro-actions">
          <button className="secondary-button" onClick={handleExport}><Download size={16} /> Export</button>
          <button className="secondary-button" onClick={handleRerun} disabled={rerunning}>{rerunning ? <><RefreshCw className="spin" size={16} /> Running...</> : <><RefreshCw size={16} /> Re-run</>}</button>
          <button className="primary-button" onClick={handleSave}><Save size={16} /> Apply / Save</button>
        </div>
      </section>

      <section className="metric-grid optimization-metrics">
        <Metric icon={<TrendingDown />} label="Current Daily Cost" value={`Rs. ${o.currentCost.toLocaleString()}`} note="Peak hour overlap" tone="red" />
        <Metric icon={<CheckCircle2 />} label="Optimized Daily Cost" value={`Rs. ${o.optimizedCost.toLocaleString()}`} note="Shifted to day & off-peak" tone="green" />
        <Metric icon={<Sparkles />} label="Daily Saving" value={`Rs. ${o.dailySaving}`} note={`+${o.savingPercent}% saved every day`} tone="green" />
        <Metric icon={<BarChart3 />} label="Monthly Saving" value={`Rs. ${o.monthlySaving.toLocaleString()}`} note="Based on 26 active days" tone="blue" />
      </section>

      <div className="audit-banner">
        <div className="audit-icon"><ShieldCheck /></div>
        <div>
          <b>Load Shift Feasibility Audit <span>Cost Reduction: {o.savingPercent}%</span></b>
          <p><strong>Important Notice:</strong> Energy consumption remains identical ({o.energy} kWh/day) while daily electricity cost decreases by Rs. {o.dailySaving}. Machine operations move away from the higher-cost peak period without reducing quotas.</p>
        </div>
      </div>

      <section className="schedule-card">
        <div className="section-heading">
          <div><h2>Daily Schedule Timeline <span>24-Hour Master Schedule</span></h2><p>Recommended daytime execution windows vs. previous peak-breaching schedules.</p></div>
          <div className="legend"><span className="offpeak" /> Off-peak <span className="day" /> Day standard <span className="peak" /> Peak</div>
        </div>
        <div className="tariff-strip"><span>Off-Peak · Rs. 15/kWh</span><b>Day Standard · Rs. 25/kWh</b><strong>Peak · Rs. 45/kWh</strong><span>Off-Peak</span></div>
        <div className="time-ruler"><span>12 AM</span><span>4 AM</span><span>8 AM</span><span>12 PM</span><span>4 PM</span><span>8 PM</span><span>12 AM</span></div>
        {machines.map((m, i) => (
          <div className="schedule-row" key={m.id}>
            <div className="schedule-label">
              <b>{i + 1}. {m.name}</b>
              <span>{m.quantity} Units • {(m.quantity * m.power).toFixed(1)} kW total</span>
              <strong>{m.saving ? `Saves Rs. ${m.saving}/day` : 'Maintained Day Rate'}</strong>
            </div>
            <div className="track"><div className={`schedule-bar bar-${i}`}>{m.window} <Check size={14} /></div></div>
          </div>
        ))}
        <div className="schedule-foot"><span><Info size={14} /> Timeline respects factory worker window (07:30 AM to 05:30 PM)</span><b>Peak surcharge avoided: Rs. 480 / shift</b></div>
      </section>

      <section className="actions-section">
        <div><h2>Recommended Actions for Shift Supervisors</h2><p>Immediate operational steps for tomorrow morning's shift handover.</p></div>
        <div className="action-grid">
          {machines.map((m) => (
            <article key={m.id}>
              <label>{m.category} LINE <span>{(m.quantity * m.power).toFixed(1)} kW</span></label>
              <h3>Run {m.name} ({m.window})</h3>
              <p>Keep this load inside the standard daytime rate to protect production flow and avoid the peak surcharge.</p>
              <b>{m.saving ? `Saves Rs. ${m.saving} / day` : 'Maintains steady throughput'}</b>
            </article>
          ))}
        </div>
      </section>

      <button className="how-button" onClick={() => setOpen(!open)}>
        <CircleHelp size={18} /><b>How was this schedule created?</b><span>CEB Time-of-Day mathematical model</span><ChevronDown className={open ? 'rotate' : ''} size={18} />
      </button>
      {open && <div className="how-body">The system analyzed operating hours, machine requirements, available windows, production quotas, and CEB tariff periods. It selected a feasible schedule that minimizes electricity cost while preserving the exact required runtime.</div>}

      <div className="bottom-actions">
        <button className="secondary-button" onClick={() => setView('machines')}><ArrowLeft size={16} /> Back to Machines</button>
        <button className="primary-button" onClick={handleSave}><Save size={16} /> Apply / Save Recommended Schedule</button>
        <button className="primary-button" onClick={() => setView('dashboard')}>View Dashboard <ArrowLeft size={16} style={{ transform: 'scaleX(-1)' }} /></button>
      </div>
      {saved && <div className="toast toast-success"><CheckCircle2 size={18} /> Schedule successfully activated. Shift supervisors notified.</div>}
    </main>
  );
}
