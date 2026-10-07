import { useState } from 'react';
import { ArrowRight, Bolt, Building2, Clock3, Save } from 'lucide-react';
import { Stepper } from '@/components/Stepper';
import { useToast } from '@/components/ToastContext';
import { updateFactory } from '@/data/api';
import type { Facility, Tariff, View } from '@/types';

type Props = {
  facility: Facility;
  tariffs: Tariff[];
  setView: (v: View) => void;
  onChanged: () => Promise<void>;
};

export function FactorySetup({ facility, tariffs, setView, onChanged }: Props) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(facility.name);
  const [code, setCode] = useState(facility.code);
  const [startTime, setStartTime] = useState(facility.startTime.slice(0, 5));
  const [endTime, setEndTime] = useState(facility.endTime.slice(0, 5));
  const [workingDays, setWorkingDays] = useState(facility.workingDays);

  const handleSave = async () => {
    try {
      await updateFactory({
        name,
        code,
        startTime,
        endTime,
        workingDays,
        manager: facility.manager,
        role: facility.role,
        tariff: facility.tariff,
      });
      await onChanged();
      setEditing(false);
      toast('Factory details updated. Schedule recalculated.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to update factory', 'error');
    }
  };

  return (
    <main className="app-main">
      <section className="page-intro">
        <div>
          <div className="step-label">STEP 1 OF 4 · FACTORY PROFILE CONFIGURATION</div>
          <h1>Factory Setup</h1>
          <p>Configure facility profile and review CEB TOD tariffs. Edit your account from the profile icon in the header.</p>
        </div>
        <Stepper current={1} />
      </section>

      <section className="setup-grid">
        <div className="setup-card">
          <div className="setup-card-head">
            <div className="soft-icon"><Building2 size={20} /></div>
            <div>
              <h2>Facility Profile</h2>
              <p>{facility.name} operating parameters</p>
            </div>
            {!editing && <button className="text-button" onClick={() => setEditing(true)}>Edit Details</button>}
          </div>
          <div className="form-grid">
            <label>Factory Name<input value={name} onChange={(e) => setName(e.target.value)} disabled={!editing} /></label>
            <label>Factory Code<input value={code} onChange={(e) => setCode(e.target.value)} disabled={!editing} /></label>
            <label>Factory Start Time<input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={!editing} /></label>
            <label>Factory End Time<input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={!editing} /></label>
            <label>Working Days / Month<input type="number" min="1" max="31" value={workingDays} onChange={(e) => setWorkingDays(Number(e.target.value))} disabled={!editing} /></label>
            <label>Tariff Plan<input value={facility.tariff} disabled /></label>
          </div>
          {editing && (
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setEditing(false)}>Cancel</button>
              <button className="primary-button" onClick={handleSave}><Save size={15} /> Save Changes</button>
            </div>
          )}
        </div>

        <div className="setup-card">
          <div className="setup-card-head">
            <div className="soft-icon"><Bolt size={20} /></div>
            <div>
              <h2>Electricity Tariff Structure</h2>
              <p>CEB Time-of-Day rates — system configured</p>
            </div>
          </div>
          <div className="tariff-list">
            {tariffs.map((t) => (
              <div key={t.id} className={`tariff-item tariff-${t.period.toLowerCase().replace('-', '')}`}>
                <div className="tariff-rate">Rs.{t.rate}<small>/kWh</small></div>
                <div className="tariff-info">
                  <b>{t.period}</b>
                  <span><Clock3 size={13} /> {t.startTime} – {t.endTime}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="bottom-actions">
        <span><span className="status-dot" /> Factory profile active — Ready for machine input</span>
        <button className="secondary-button" disabled>Back</button>
        <button className="primary-button" onClick={() => setView('machines')}>Continue to Add Machines <ArrowRight size={16} /></button>
      </div>
    </main>
  );
}
