import { useState } from 'react';
import {
  ArrowRight, BarChart3, CheckCircle2, Clock3, Eye, Plus,
  TrendingDown, X, Zap, Pencil, Trash2, Activity,
} from 'lucide-react';
import { Metric } from '@/components/Metric';
import { Stepper } from '@/components/Stepper';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/ToastContext';
import { createMachine, deleteMachine, updateMachine } from '@/data/api';
import type { Machine, View } from '@/types';

type Props = {
  machines: Machine[];
  setMachines: (m: Machine[]) => void;
  setView: (v: View) => void;
};

const CATEGORIES = ['Cutting', 'Sewing', 'Finishing', 'Washing', 'Packaging'];

export function Machines({ machines, setMachines, setView }: Props) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Machine | null>(null);
  const [viewTarget, setViewTarget] = useState<Machine | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Machine | null>(null);

  const totalPowerW = machines.reduce((s, m) => s + m.quantity * (m.power ?? 0), 0);
  const totalEnergy = machines.reduce((s, m) => s + m.quantity * (m.power ?? 0) * (m.hours ?? 0) / 1000, 0);
  const totalUnits = machines.reduce((s, m) => s + m.quantity, 0);
  const avgPower = totalUnits > 0 ? totalPowerW / totalUnits : 0;

  const handleAdd = async (m: Machine) => {
    try {
      const created = await createMachine(m);
      setMachines([...machines, created]);
      setShowAdd(false);
      toast(`"${created.name}" added to inventory`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to add machine.', 'error');
    }
  };

  const handleEdit = async (updated: Machine) => {
    try {
      const result = await updateMachine(updated.id, updated);
      setMachines(machines.map((m) => (m.id === result.id ? result : m)));
      setEditTarget(null);
      toast(`"${updated.name}" updated successfully`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to update machine.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMachine(deleteTarget.id);
      setMachines(machines.filter((m) => m.id !== deleteTarget.id));
      toast(`"${deleteTarget.name}" removed from inventory`, 'warning');
      setDeleteTarget(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to delete machine.', 'error');
    }
  };

  return (
    <main className="app-main">
      <section className="page-intro">
        <div>
          <div className="step-label">STEP 2 OF 4 · MACHINE INVENTORY CONFIGURATION</div>
          <h1>Machine Management</h1>
          <p>Configure power ratings in watts, model names, and operating windows for optimization.</p>
        </div>
        <Stepper current={2} />
      </section>

      <section className="metric-grid">
        <Metric icon={<BarChart3 />} label="Total Machines" value={`${totalUnits} Units`} note="Across manufacturing categories" tone="blue" />
        <Metric icon={<Zap />} label="Total Installed Power" value={`${totalPowerW.toFixed(0)} W`} note={`${(totalPowerW / 1000).toFixed(2)} kW fleet capacity`} tone="green" />
        <Metric icon={<TrendingDown />} label="Estimated Daily Energy" value={`${totalEnergy.toFixed(1)} kWh / day`} note="Qty × W × hours / 1000" tone="amber" />
        <Metric icon={<CheckCircle2 />} label="Avg Power / Unit" value={`${avgPower.toFixed(0)} W`} note={`${machines.length} machine types configured`} tone="green" />
      </section>

      <section className="table-card">
        <div className="table-head">
          <div>
            <h2>Factory Machine Inventory <span>{machines.length} Configured Machine Types</span></h2>
            <p>Individual power ratings (W), model names, and operating windows for the optimization model.</p>
          </div>
          <button className="primary-button add-button" onClick={() => setShowAdd(true)}>
            <Plus size={16} /> Add Machine
          </button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Machine Name</th>
                <th>Model</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Power / Unit</th>
                <th>Total Power</th>
                <th>Required Runtime</th>
                <th>Available Window</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {machines.length === 0 ? (
                <tr>
                  <td colSpan={10} className="empty-row">
                    <div className="empty-state">
                      <Activity size={32} />
                      <b>No machines configured</b>
                      <p>Click &quot;Add Machine&quot; to start building your inventory.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                machines.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="machine-name">
                        <div className={`machine-avatar ${m.tone}`}>{m.name.slice(0, 2).toUpperCase()}</div>
                        <div>
                          <b>{m.name}</b>
                          <small>ID: {m.id} • Priority: {m.priority}</small>
                        </div>
                      </div>
                    </td>
                    <td><span className="category-chip">{m.modelName || '—'}</span></td>
                    <td><span className="category-chip">{m.category}</span></td>
                    <td className="mono center">{m.quantity}</td>
                    <td className="mono right">{(m.power ?? 0).toFixed(0)} W</td>
                    <td className="mono right"><b>{(m.quantity * (m.power ?? 0)).toFixed(0)} W</b></td>
                    <td>
                      <b className="mono">{(m.hours ?? 0).toFixed(1)} hrs / day</b>
                      <small className="table-muted">Est: {(m.quantity * (m.power ?? 0) * (m.hours ?? 0) / 1000).toFixed(1)} kWh/day</small>
                    </td>
                    <td>
                      <span className="window-chip"><Clock3 size={13} /> {m.window}</span>
                      <small className="green-text">Window validated</small>
                    </td>
                    <td><span className="ready-chip"><span /> Ready</span></td>
                    <td>
                      <div className="row-actions">
                        <button title="View details" onClick={() => setViewTarget(m)}><Eye size={15} /></button>
                        <button title="Edit" onClick={() => setEditTarget(m)}><Pencil size={15} /></button>
                        <button title="Delete" className="delete-action" onClick={() => setDeleteTarget(m)}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="table-note">
          <CheckCircle2 size={17} />
          <span>
            <b>Automatic Energy Calculation:</b> Total Power (W) = Quantity × Power per Unit. Daily kWh = Total W × Hours / 1000.
          </span>
        </div>
      </section>

      <div className="bottom-actions">
        <span><span className="status-dot" /> {machines.length} Machines Ready for Mathematical Modeling</span>
        <button className="secondary-button" onClick={() => setView('factory')}>Back to Factory Setup</button>
        <button className="primary-button" onClick={() => setView('optimization')}>
          Continue to Optimization <ArrowRight size={16} />
        </button>
      </div>

      {showAdd && <MachineFormModal mode="add" close={() => setShowAdd(false)} onSave={handleAdd} />}
      {editTarget && <MachineFormModal mode="edit" machine={editTarget} close={() => setEditTarget(null)} onSave={handleEdit} />}
      {viewTarget && (
        <MachineViewModal
          machine={viewTarget}
          close={() => setViewTarget(null)}
          onEdit={() => { setEditTarget(viewTarget); setViewTarget(null); }}
        />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Machine"
        message={`Are you sure you want to remove "${deleteTarget?.name}" from the inventory? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  );
}

function MachineFormModal({
  mode,
  machine,
  close,
  onSave,
}: {
  mode: 'add' | 'edit';
  machine?: Machine;
  close: () => void;
  onSave: (m: Machine) => void;
}) {
  const [name, setName] = useState(machine?.name ?? '');
  const [modelName, setModelName] = useState(machine?.modelName ?? '');
  const [category, setCategory] = useState(machine?.category ?? 'Cutting');
  const [quantity, setQuantity] = useState(machine?.quantity ?? 1);
  const [power, setPower] = useState(machine?.power ?? 550);
  const [hours, setHours] = useState(machine?.hours ?? 3);
  const [priority, setPriority] = useState(machine?.priority ?? 'Medium');
  const [availableStart, setAvailableStart] = useState(machine?.availableStart?.slice(0, 5) ?? '08:00');
  const [availableEnd, setAvailableEnd] = useState(machine?.availableEnd?.slice(0, 5) ?? '17:00');
  const [tone, setTone] = useState(machine?.tone ?? 'green');
  const [nameError, setNameError] = useState(false);
  const total = quantity * power;

  const save = () => {
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    onSave({
      id: machine?.id ?? `MCH-${Date.now()}`,
      name: name.trim(),
      modelName: modelName.trim(),
      category,
      quantity: Math.max(1, quantity),
      power: Math.max(1, power),
      hours: Math.max(0.5, hours),
      window: `${availableStart} – ${availableEnd}`,
      priority,
      saving: machine?.saving ?? 0,
      tone,
      availableStart,
      availableEnd,
    });
  };

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal-card add-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">
          <div className={`soft-icon ${mode === 'add' ? 'green-bg' : 'blue-bg'}`}>
            {mode === 'add' ? <Plus size={20} /> : <Pencil size={20} />}
          </div>
          <div>
            <h2>{mode === 'add' ? 'Add Machine' : 'Edit Machine'}</h2>
            <p>{mode === 'add' ? 'Provide model, power in watts, and operating parameters.' : 'Update machine specifications and parameters.'}</p>
          </div>
          <button onClick={close}><X /></button>
        </div>
        <div className="form-grid">
          <label className={nameError ? 'has-error' : ''}>
            Machine Name
            <input value={name} onChange={(e) => { setName(e.target.value); setNameError(false); }} placeholder="e.g. Fabric Cutter" />
            {nameError && <small className="field-error">Machine name is required</small>}
          </label>
          <label>
            Model Name
            <input value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="e.g. S-7200" />
          </label>
          <label>
            Machine Category
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>
            Quantity
            <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
          </label>
          <label>
            Power per Unit (W)
            <input type="number" min="1" step="1" value={power} onChange={(e) => setPower(Number(e.target.value))} />
          </label>
          <label>
            Required Hours / Day
            <input type="number" min="0.5" step="0.5" value={hours} onChange={(e) => setHours(Number(e.target.value))} />
          </label>
          <label>
            Available Start
            <input type="time" value={availableStart} onChange={(e) => setAvailableStart(e.target.value)} />
          </label>
          <label>
            Available End
            <input type="time" value={availableEnd} onChange={(e) => setAvailableEnd(e.target.value)} />
          </label>
          <label>
            Priority
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </label>
          <label>
            Display Color
            <select value={tone} onChange={(e) => setTone(e.target.value)}>
              <option value="blue">Blue</option>
              <option value="green">Green</option>
              <option value="amber">Amber</option>
            </select>
          </label>
        </div>
        <div className="form-summary">
          <Zap size={16} />
          <span>
            Total power: <b>{total.toFixed(0)} W</b> ({(total / 1000).toFixed(2)} kW) • Est. energy:{' '}
            <b>{(total * hours / 1000).toFixed(1)} kWh/day</b>
          </span>
        </div>
        <div className="modal-actions">
          <button className="secondary-button" onClick={close}>Cancel</button>
          <button className="primary-button" onClick={save}>{mode === 'add' ? 'Save Machine' : 'Update Machine'}</button>
        </div>
      </div>
    </div>
  );
}

function MachineViewModal({
  machine,
  close,
  onEdit,
}: {
  machine: Machine;
  close: () => void;
  onEdit: () => void;
}) {
  const totalPower = machine.quantity * (machine.power ?? 0);
  const dailyEnergy = totalPower * (machine.hours ?? 0) / 1000;
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal-card view-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">
          <div className={`soft-icon ${machine.tone === 'blue' ? 'blue-bg' : machine.tone === 'amber' ? 'amber-bg' : 'green-bg'}`}>
            <Eye size={20} />
          </div>
          <div>
            <h2>{machine.name}</h2>
            <p>{machine.modelName || 'No model'} • {machine.category} • ID: {machine.id}</p>
          </div>
          <button onClick={close}><X /></button>
        </div>
        <div className="view-grid">
          <div className="view-item"><label>MODEL</label><b>{machine.modelName || '—'}</b></div>
          <div className="view-item"><label>CATEGORY</label><span className="category-chip">{machine.category}</span></div>
          <div className="view-item"><label>PRIORITY</label><span className={`priority-tag priority-${machine.priority.toLowerCase()}`}>{machine.priority}</span></div>
          <div className="view-item"><label>QUANTITY</label><b className="mono">{machine.quantity} units</b></div>
          <div className="view-item"><label>POWER PER UNIT</label><b className="mono">{(machine.power ?? 0).toFixed(0)} W</b></div>
          <div className="view-item"><label>TOTAL POWER</label><b className="mono">{totalPower.toFixed(0)} W</b></div>
          <div className="view-item"><label>RUNTIME</label><b className="mono">{(machine.hours ?? 0).toFixed(1)} hrs/day</b></div>
          <div className="view-item"><label>DAILY ENERGY</label><b className="mono">{dailyEnergy.toFixed(1)} kWh/day</b></div>
          <div className="view-item view-item-wide"><label>AVAILABLE WINDOW</label><b><Clock3 size={14} /> {machine.window}</b></div>
        </div>
        <div className="modal-actions">
          <button className="secondary-button" onClick={close}>Close</button>
          <button className="primary-button" onClick={onEdit}><Pencil size={15} /> Edit Machine</button>
        </div>
      </div>
    </div>
  );
}
