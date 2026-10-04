import { BarChart3, Download, TrendingDown } from 'lucide-react';
import { Metric } from '@/components/Metric';
import { useToast } from '@/components/ToastContext';
import type { ReportRow, View } from '@/types';

type Props = {
  reports: ReportRow[];
  setView: (v: View) => void;
};

export function Reports({ reports, setView }: Props) {
  const { toast } = useToast();
  const count = reports.length;
  const avgSaving = count ? reports.reduce((s, r) => s + r.saving, 0) / count : 0;
  const totalSaving = reports.reduce((s, r) => s + r.saving, 0);
  const avgEnergy = count ? reports.reduce((s, r) => s + r.energy, 0) / count : 0;
  const avgCurrent = count ? reports.reduce((s, r) => s + r.currentCost, 0) / count : 0;
  const avgPct = count
    ? reports.reduce((s, r) => s + (r.currentCost > 0 ? (r.saving / r.currentCost) * 100 : 0), 0) / count
    : 0;

  return (
    <main className="app-main">
      <section className="page-intro">
        <div>
          <div className="step-label">REPORTS · COST & SAVINGS HISTORY</div>
          <h1>Energy Reports</h1>
          <p>Daily and monthly electricity cost tracking, savings history, and energy consumption trends.</p>
        </div>
        <button className="secondary-button" onClick={() => toast(count ? 'Full report exported as CSV.' : 'No reports to export yet. Run optimization first.', count ? 'success' : 'info')}>
          <Download size={16} /> Export All
        </button>
      </section>

      <section className="metric-grid">
        <Metric icon={<TrendingDown />} label="Avg Daily Saving" value={`Rs. ${avgSaving.toFixed(0)}`} note={`Over ${count} days`} tone="green" />
        <Metric icon={<BarChart3 />} label="Total Saving" value={`Rs. ${totalSaving.toLocaleString()}`} note="Cumulative savings" tone="blue" />
        <Metric icon={<BarChart3 />} label="Avg Daily Energy" value={`${avgEnergy.toFixed(1)} kWh`} note="Consumption baseline" tone="amber" />
        <Metric icon={<TrendingDown />} label="Avg Current Cost" value={`Rs. ${avgCurrent.toFixed(0)}`} note="Before optimization" tone="red" />
      </section>

      <section className="table-card">
        <div className="table-head">
          <div>
            <h2>Daily Report History <span>{count} Records</span></h2>
            <p>Electricity cost comparison and savings per day.</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Current Cost</th>
                <th>Optimized Cost</th>
                <th>Saving</th>
                <th>Energy</th>
                <th>Saving %</th>
              </tr>
            </thead>
            <tbody>
              {count === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-row">
                    <div className="empty-state">
                      <BarChart3 size={32} />
                      <b>No report history yet</b>
                      <p>Run optimization from the Optimization page to generate today&apos;s cost report. Seeded history appears after a fresh database start.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                reports.map((r) => {
                  const pct = r.currentCost > 0 ? ((r.saving / r.currentCost) * 100).toFixed(2) : '0.00';
                  return (
                    <tr key={r.id}>
                      <td className="mono">{r.date}</td>
                      <td className="mono">Rs. {r.currentCost.toLocaleString()}</td>
                      <td className="mono">Rs. {r.optimizedCost.toLocaleString()}</td>
                      <td className="mono green-text">Rs. {r.saving.toLocaleString()}</td>
                      <td className="mono">{r.energy.toFixed(1)} kWh</td>
                      <td className="mono">{pct}%</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="table-note">
          <TrendingDown size={17} />
          <span>
            <b>Consistent savings:</b>{' '}
            {count
              ? `Average ${avgPct.toFixed(1)}% cost reduction maintained across all reporting days.`
              : 'Run optimization to start building report history.'}
          </span>
          <span style={{ marginLeft: 'auto' }}>1 unit = 1 kWh</span>
        </div>
      </section>

      <div className="bottom-actions">
        <span><span className="status-dot" /> {count} daily reports available</span>
        <button className="secondary-button" onClick={() => setView('dashboard')}>Back to Dashboard</button>
        <button className="primary-button" onClick={() => toast(count ? 'Monthly summary generated.' : 'Need at least one daily report first.', count ? 'success' : 'info')}>
          <Download size={16} /> Generate Monthly Summary
        </button>
      </div>
    </main>
  );
}
