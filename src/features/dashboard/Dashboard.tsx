import { BarChart3, CheckCircle2, Clock3, Sparkles, TrendingDown, Zap, ArrowRight } from 'lucide-react';
import { Metric } from '@/components/Metric';
import { useToast } from '@/components/ToastContext';
import type { Facility, Machine, Optimization as OptData, Tariff, View } from '@/types';

type Props = {
  machines: Machine[];
  optimization: OptData;
  facility: Facility;
  tariffs: Tariff[];
  setView: (v: View) => void;
};

export function Dashboard({ machines, optimization: o, facility, tariffs, setView }: Props) {
  const { toast } = useToast();
  const totalEnergy = machines.reduce((s, m) => s + m.quantity * m.power * m.hours, 0);
  const totalPower = machines.reduce((s, m) => s + m.quantity * m.power, 0);
  const costPerUnit = totalEnergy > 0 ? o.optimizedCost / totalEnergy : 0;

  return (
    <main className="app-main">
      <section className="page-intro">
        <div>
          <div className="step-label">STEP 4 OF 4 · ENERGY DASHBOARD</div>
          <h1>Energy Optimization Dashboard</h1>
          <p>Complete cost breakdown, machine-wise energy consumption, and savings analysis for {facility.name}.</p>
        </div>
      </section>

      <section className="metric-grid">
        <Metric icon={<TrendingDown />} label="Current Daily Cost" value={`Rs. ${o.currentCost.toLocaleString()}`} note="Before optimization" tone="red" />
        <Metric icon={<CheckCircle2 />} label="Optimized Daily Cost" value={`Rs. ${o.optimizedCost.toLocaleString()}`} note="After schedule shift" tone="green" />
        <Metric icon={<Sparkles />} label="Daily Saving" value={`Rs. ${o.dailySaving}`} note={`+${o.savingPercent}% reduction`} tone="green" />
        <Metric icon={<BarChart3 />} label="Monthly Saving" value={`Rs. ${o.monthlySaving.toLocaleString()}`} note={`${facility.workingDays} working days`} tone="blue" />
      </section>

      <section className="metric-grid">
        <Metric icon={<Zap />} label="Total Energy" value={`${o.energy} kWh / day`} note={`${totalPower.toFixed(1)} kW installed`} tone="amber" />
        <Metric icon={<BarChart3 />} label="Cost Per Unit" value={`Rs. ${costPerUnit.toFixed(2)}/kWh`} note="Optimized average rate" tone="blue" />
        <Metric icon={<TrendingDown />} label="Cost Reduction" value={`${o.savingPercent}%`} note="Electricity cost saved" tone="green" />
        <Metric icon={<CheckCircle2 />} label="Machines Optimized" value={`${machines.length}`} note="All machines scheduled" tone="green" />
      </section>

      <section className="table-card">
        <div className="table-head">
          <div><h2>Machine-wise Cost Breakdown <span>Daily Energy & Cost</span></h2><p>See exactly where your electricity cost comes from, machine by machine.</p></div>
          <button className="secondary-button" onClick={() => toast('Breakdown exported as PDF.', 'success')}>Export PDF</button>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Machine</th><th>Category</th><th>Runtime</th><th>Energy (kWh)</th><th>Rate (Rs/kWh)</th><th>Cost (Rs/day)</th><th>Saving</th></tr></thead>
            <tbody>
              {machines.map((m) => {
                const energy = m.quantity * m.power * m.hours;
                const cost = energy * 25;
                return (
                  <tr key={m.id}>
                    <td><div className="machine-name"><div className={`machine-avatar ${m.tone}`}>{m.name.slice(0, 2).toUpperCase()}</div><div><b>{m.name}</b><small>{m.quantity} × {m.power} kW</small></div></div></td>
                    <td><span className="category-chip">{m.category}</span></td>
                    <td className="mono">{m.hours}h</td>
                    <td className="mono"><b>{energy.toFixed(0)}</b></td>
                    <td className="mono">Rs. 25</td>
                    <td className="mono"><b>Rs. {cost.toLocaleString()}</b></td>
                    <td className="mono">{m.saving ? <span className="green-text">Rs. {m.saving}</span> : '—'}</td>
                  </tr>
                );
              })}
              <tr className="total-row">
                <td><b>TOTAL</b></td><td></td><td></td>
                <td className="mono"><b>{totalEnergy.toFixed(0)} kWh</b></td><td></td>
                <td className="mono"><b>Rs. {o.optimizedCost.toLocaleString()}</b></td>
                <td className="mono"><b className="green-text">Rs. {o.dailySaving}</b></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="table-note">
          <CheckCircle2 size={17} />
          <span><b>1 unit = 1 kWh</b> — Energy = Total Power × Runtime. Cost = Energy × Tariff Rate.</span>
          <code>Day Rate: Rs. 25/kWh</code>
        </div>
      </section>

      <section className="tariff-overview">
        <h2>Active Tariff Structure</h2>
        <div className="tariff-cards">
          {tariffs.map((t) => (
            <div key={t.id} className={`tariff-card tariff-${t.period.toLowerCase().replace('-', '')}`}>
              <div className="tariff-rate-big">Rs. {t.rate}<small>/kWh</small></div>
              <b>{t.period}</b>
              <span><Clock3 size={13} /> {t.startTime} – {t.endTime}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="bottom-actions">
        <span><span className="status-dot" /> Dashboard live — {facility.name} • {facility.code}</span>
        <button className="secondary-button" onClick={() => setView('optimization')}>Back to Schedule</button>
        <button className="primary-button" onClick={() => setView('reports')}>View Reports <ArrowRight size={16} /></button>
      </div>
    </main>
  );
}
