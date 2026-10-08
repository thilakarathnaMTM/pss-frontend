import { useState } from 'react';
import { BarChart3, ChevronDown, Download, History, TrendingDown } from 'lucide-react';
import { Metric } from '@/components/Metric';
import { useToast } from '@/components/ToastContext';
import { downloadCsv } from '@/data/api';
import type { ReportRow, RunRecord, View } from '@/types';

type Props = {
  reports: ReportRow[];
  history: RunRecord[];
  setView: (v: View) => void;
};

const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

export function Reports({ reports, history, setView }: Props) {
  const [openRun, setOpenRun] = useState<string | null>(null);
  const { toast } = useToast();
  const count = reports.length;
  const avgSaving = count ? reports.reduce((s, r) => s + r.saving, 0) / count : 0;
  const totalSaving = reports.reduce((s, r) => s + r.saving, 0);
  const avgEnergy = count ? reports.reduce((s, r) => s + r.energy, 0) / count : 0;
  const avgCurrent = count ? reports.reduce((s, r) => s + r.currentCost, 0) / count : 0;
  const avgPct = count
    ? reports.reduce((s, r) => s + (r.currentCost > 0 ? (r.saving / r.currentCost) * 100 : 0), 0) / count
    : 0;

  const exportAll = () => {
    if (!count) { toast('No reports to export yet. Run optimization first.', 'info'); return; }
    downloadCsv('energy-reports.csv', [
      ['Date', 'Current cost (Rs)', 'Optimized cost (Rs)', 'Saving (Rs)', 'Energy (kWh)'],
      ...reports.map((r) => [r.date, r.currentCost, r.optimizedCost, r.saving, r.energy]),
    ]);
  };

  const exportHistory = () => {
    if (!history.length) { toast('No optimization runs saved yet.', 'info'); return; }
    downloadCsv('optimization-run-history.csv', [
      ['Date/time', 'Trigger', 'Current cost (Rs)', 'Optimized cost (Rs)', 'Saving (Rs)', 'Saving %', 'Energy (kWh)', 'Productive h', 'kWh per productive h', 'Rs per productive h', 'Machines scheduled'],
      ...history.map((r) => [r.createdAt, r.trigger, r.currentCost, r.optimizedCost, r.dailySaving, r.savingPercent, r.energy, r.productiveHours, r.kwhPerHour, r.costPerHour, r.machinesScheduled]),
    ]);
  };

  const monthlySummary = () => {
    if (!count) { toast('Need at least one daily report first.', 'info'); return; }
    const byMonth = new Map<string, { days: number; current: number; optimized: number; saving: number; energy: number }>();
    reports.forEach((r) => {
      const key = r.date.slice(0, 7);
      const m = byMonth.get(key) ?? { days: 0, current: 0, optimized: 0, saving: 0, energy: 0 };
      byMonth.set(key, { days: m.days + 1, current: m.current + r.currentCost, optimized: m.optimized + r.optimizedCost, saving: m.saving + r.saving, energy: m.energy + r.energy });
    });
    downloadCsv('monthly-summary.csv', [
      ['Month', 'Days', 'Current cost (Rs)', 'Optimized cost (Rs)', 'Saving (Rs)', 'Energy (kWh)'],
      ...[...byMonth.entries()].sort().map(([k, v]) => [k, v.days, v.current.toFixed(2), v.optimized.toFixed(2), v.saving.toFixed(2), v.energy.toFixed(2)]),
    ]);
  };

  return (
    <main className="app-main">
      <section className="page-intro">
        <div>
          <div className="step-label">REPORTS · COST & SAVINGS HISTORY</div>
          <h1>Energy Reports</h1>
          <p>Daily and monthly electricity cost tracking, savings history, and energy consumption trends.</p>
        </div>
        <button className="secondary-button" onClick={exportAll}>
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
                      <p>Run optimization from the Optimization page to generate today&apos;s cost report.</p>
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

      <section className="table-card history-card">
        <div className="table-head">
          <div>
            <h2>Optimization Run History <span>{history.length} Runs</span></h2>
            <p>Every re-run and every machine / factory change is saved here with its result. Click a row to see that run&apos;s schedule.</p>
          </div>
          <button className="secondary-button" onClick={exportHistory}><Download size={16} /> Export CSV</button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date &amp; time</th><th>Trigger</th><th>Current cost</th><th>Optimized cost</th><th>Saving</th>
                <th>Energy</th><th>kWh / prod. h</th><th>Rs / prod. h</th><th>Machines</th><th></th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={10} className="empty-row"><div className="empty-state"><History size={32} /><b>No runs saved yet</b><p>Re-run the optimization or change a machine to record a run.</p></div></td></tr>
              ) : history.map((r) => (
                <HistoryRow key={r.id} run={r} open={openRun === r.id} toggle={() => setOpenRun(openRun === r.id ? null : r.id)} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="bottom-actions">
        <span><span className="status-dot" /> {count} daily reports available</span>
        <button className="secondary-button" onClick={() => setView('dashboard')}>Back to Dashboard</button>
        <button className="primary-button" onClick={monthlySummary}>
          <Download size={16} /> Generate Monthly Summary
        </button>
      </div>
    </main>
  );
}

function HistoryRow({ run: r, open, toggle }: { run: RunRecord; open: boolean; toggle: () => void }) {
  return (
    <>
      <tr className="history-row" onClick={toggle}>
        <td className="mono">{fmtDateTime(r.createdAt)}</td>
        <td>{r.trigger}</td>
        <td className="mono">Rs. {r.currentCost.toLocaleString()}</td>
        <td className="mono"><b>Rs. {r.optimizedCost.toLocaleString()}</b></td>
        <td className="mono">{r.dailySaving > 0 ? <span className="green-text">Rs. {r.dailySaving.toLocaleString()} ({r.savingPercent}%)</span> : '—'}</td>
        <td className="mono">{r.energy.toFixed(1)} kWh</td>
        <td className="mono">{r.kwhPerHour.toFixed(2)}</td>
        <td className="mono">Rs. {r.costPerHour.toLocaleString()}</td>
        <td className="mono center">{r.machinesScheduled}</td>
        <td><ChevronDown size={16} className={open ? 'rotate' : ''} /></td>
      </tr>
      {open && (
        <tr className="history-detail">
          <td colSpan={10}>
            <div className="history-slots">
              {r.schedules.map((s) => (
                <span key={s.machineName} className="window-chip">
                  <b>{s.machineName}</b> {s.start} – {s.end} · {s.energy} kWh · Rs. {s.cost.toLocaleString()}
                </span>
              ))}
              <small className="table-muted">Productive hours that day: {r.productiveHours} h</small>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
