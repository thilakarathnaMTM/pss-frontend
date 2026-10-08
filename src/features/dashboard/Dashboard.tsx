import { BarChart3, CheckCircle2, Clock3, Gauge, Sparkles, TrendingDown, Zap, ArrowRight } from 'lucide-react';
import { Metric } from '@/components/Metric';
import { useToast } from '@/components/ToastContext';
import { downloadCsv } from '@/data/api';
import { productiveHours } from '@/data/optimizer';
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
  // Energy, cost and saving per machine come from the saved optimizer result (database).
  const rows = machines.flatMap((m) => {
    const slot = o.schedules?.find((x) => x.machineId === m.id);
    return slot ? [{ m, slot, rate: slot.energy > 0 ? slot.cost / slot.energy : 0 }] : [];
  });
  const totalEnergy = rows.reduce((s, r) => s + r.slot.energy, 0);
  const totalPowerW = machines.reduce((s, m) => s + m.quantity * m.power, 0);
  // Productive hours = factory operating hours (start to end).
  const hours = productiveHours(facility.startTime, facility.endTime);
  const costPerUnit = totalEnergy > 0 ? o.optimizedCost / totalEnergy : 0;
  const notScheduled = machines.length - rows.length;

  const exportCsv = () => {
    if (!rows.length) { toast('Nothing to export. Run the optimization first.', 'info'); return; }
    downloadCsv('machine-cost-breakdown.csv', [
      ['Machine', 'Category', 'Start', 'End', 'Energy (kWh)', 'Avg rate (Rs/kWh)', 'Cost (Rs/day)', 'Saving (Rs/day)'],
      ...rows.map(({ m, slot, rate }) => [m.name, m.category, slot.start, slot.end, slot.energy, rate.toFixed(2), slot.cost, slot.saving]),
      ['TOTAL', '', '', '', totalEnergy.toFixed(2), costPerUnit.toFixed(2), o.optimizedCost, o.dailySaving],
    ]);
  };

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
        <Metric icon={<Sparkles />} label="Daily Saving" value={`Rs. ${o.dailySaving.toLocaleString()}`} note={`+${o.savingPercent}% reduction`} tone="green" />
        <Metric icon={<BarChart3 />} label="Monthly Saving" value={`Rs. ${o.monthlySaving.toLocaleString()}`} note={`${facility.workingDays} working days`} tone="blue" />
      </section>

      <section className="metric-grid">
        <Metric icon={<Zap />} label="Total Energy" value={`${o.energy} kWh / day`} note="Optimized schedule" tone="amber" />
        <Metric icon={<BarChart3 />} label="Cost Per Unit" value={`Rs. ${costPerUnit.toFixed(2)}/kWh`} note="Optimized average rate" tone="blue" />
        <Metric icon={<TrendingDown />} label="Cost Reduction" value={`${o.savingPercent}%`} note="Electricity cost saved" tone="green" />
        <Metric icon={<CheckCircle2 />} label="Machines Optimized" value={`${rows.length} / ${machines.length}`} note={notScheduled > 0 ? `${notScheduled} not scheduled - re-run optimization` : 'All machines scheduled'} tone={notScheduled > 0 ? 'amber' : 'green'} />
      </section>

      <section className="metric-grid">
        <Metric icon={<Clock3 />} label="Productive Hours" value={`${hours.toFixed(1)} h / day`} note={`${facility.startTime} – ${facility.endTime} operating hours`} tone="blue" />
        <Metric icon={<Gauge />} label="kWh / Productive Hour" value={hours > 0 ? (o.energy / hours).toFixed(2) : '0'} note="Daily kWh ÷ productive hours" tone="amber" />
        <Metric icon={<Gauge />} label="Cost / Productive Hour" value={`Rs. ${hours > 0 ? (o.optimizedCost / hours).toFixed(2) : '0'}`} note="Optimized daily cost ÷ productive hours" tone="green" />
        <Metric icon={<Zap />} label="Installed Power" value={`${totalPowerW.toLocaleString()} W`} note="Σ quantity × W per unit" tone="blue" />
      </section>

      <section className="table-card">
        <div className="table-head">
          <div><h2>Machine-wise Cost Breakdown <span>Daily Energy & Cost</span></h2><p>See exactly where your electricity cost comes from, machine by machine.</p></div>
          <button className="secondary-button" onClick={exportCsv}>Export CSV</button>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Machine</th><th>Category</th><th>Scheduled Run</th><th>Energy (kWh)</th><th>Avg Rate (Rs/kWh)</th><th>Cost (Rs/day)</th><th>Saving</th></tr></thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="empty-row"><div className="empty-state"><b>No optimization result yet</b><p>Open the Optimization page and click Re-run.</p></div></td></tr>
              )}
              {rows.map(({ m, slot, rate }) => (
                <tr key={m.id}>
                  <td><div className="machine-name"><div className={`machine-avatar ${m.tone}`}>{m.name.slice(0, 2).toUpperCase()}</div><div><b>{m.name}</b><small>{m.quantity} × {m.power} W</small></div></div></td>
                  <td><span className="category-chip">{m.category}</span></td>
                  <td className="mono">{slot.start} – {slot.end}</td>
                  <td className="mono"><b>{slot.energy.toFixed(1)}</b></td>
                  <td className="mono">Rs. {rate.toFixed(2)}</td>
                  <td className="mono"><b>Rs. {slot.cost.toLocaleString()}</b></td>
                  <td className="mono">{slot.saving ? <span className="green-text">Rs. {slot.saving.toLocaleString()}</span> : '—'}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td><b>TOTAL</b></td><td></td><td></td>
                <td className="mono"><b>{totalEnergy.toFixed(1)} kWh</b></td><td className="mono">Rs. {costPerUnit.toFixed(2)}</td>
                <td className="mono"><b>Rs. {o.optimizedCost.toLocaleString()}</b></td>
                <td className="mono"><b className="green-text">Rs. {o.dailySaving.toLocaleString()}</b></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="table-note">
          <CheckCircle2 size={17} />
          <span><b>1 unit = 1 kWh</b> — Energy = Total kW × Runtime. Cost = Σ (kW × 0.5 h × tariff rate of each half-hour).</span>
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
