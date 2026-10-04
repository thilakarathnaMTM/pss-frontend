import { useState, type FormEvent } from 'react';
import {
  ArrowRight, CheckCircle2, Eye, EyeOff, Factory, Info, LockKeyhole,
  Plus, RefreshCw, ShieldCheck, X, Activity, Bolt, UserRound, Phone,
} from 'lucide-react';
import { Brand, LOGO_URL } from '@/components/Brand';
import { useAuth } from '@/auth/AuthContext';
import { useToast } from '@/components/ToastContext';
import type { SignupInput } from '@/types';

export function Login() {
  const { login, loading, error } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await login(email, password);
    if (ok) toast('Welcome back! Authentication successful.', 'success');
  };

  return (
    <div className="auth-shell">
      <header className="auth-header">
        <Brand />
        <div className="grid-badge"><ShieldCheck size={18} /> LK-SME GRID</div>
      </header>
      <main className="auth-main">
        <div className="access-pill"><span>LK</span> SRI LANKA SME ENERGY PORTAL <i /> Facility Access</div>
        <section className="login-card">
          <div className="accent-line" />
          <div className="login-heading">
            <div className="portal-logo"><img src={LOGO_URL} alt="Apex Energy" /><span /></div>
            <h1>Energy Optimization for SME Garment Factory</h1>
            <p>Optimize machine schedules. Reduce electricity costs.</p>
          </div>
          <div className="info-callout">
            <Info size={21} />
            <div>
              <b>DEDICATED FACTORY PORTAL</b>
              <span>One authenticated console per licensed apparel production facility.</span>
            </div>
          </div>
          <form onSubmit={submit} className="login-form">
            <label>
              FACTORY MANAGER EMAIL {email.includes('@') && email.toLowerCase().endsWith('.lk') && <em><CheckCircle2 size={14} /> Valid SME domain</em>}
              <div className="input-wrap">
                <Factory size={19} />
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tharuka@nookclothes.lk" />
              </div>
              <small>Use your CEB registered facility controller email.</small>
            </label>
            <label>
              SECURITY KEY / PASSWORD <span>SCADA Level-2</span>
              <div className="input-wrap">
                <LockKeyhole size={19} />
                <input required type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••" />
                <button type="button" aria-label="Toggle password visibility" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </label>
            {error && <div className="auth-error">{error}</div>}
            <div className="login-options">
              <label className="check-label"><input type="checkbox" defaultChecked /> <span>Remember unit token</span></label>
              <button type="button" className="text-button" onClick={() => toast('Please contact your facility administrator to reset access.', 'info')}>Need help signing in?</button>
            </div>
            <button className="primary-button login-submit" disabled={loading}>
              {loading ? <><RefreshCw className="spin" size={20} /> Verifying Grid Authentication...</> : <>Authenticate &amp; Access Dashboard <ArrowRight size={20} /></>}
            </button>
          </form>
          <div className="tariff-row">
            <div><Bolt size={18} /> CEB TOD WINDOW:</div>
            <b>Day Rate Active (05:30 - 18:30)</b>
          </div>
          <div className="onboarding">
            <div><span /> NEW FACILITY ONBOARDING? <span /></div>
            <button onClick={() => setShowRegister(true)}><Plus size={18} /> Create Factory Manager Account</button>
          </div>
          <div className="trust-row">
            <span><ShieldCheck size={15} /> 256-bit Encrypted</span><i>•</i>
            <span><Activity size={15} /> CEB / LECO Protocol</span><i>•</i>
            <span><ShieldCheck size={15} /> Dedicated Unit Shield</span>
          </div>
        </section>
        <div className="auth-footnote">
          <b>ENERGY OPTIMIZATION FOR SME GARMENT FACTORY</b>
          <p>Smart energy telemetry &amp; peak load shedding protocol for Sri Lankan garment manufacturing clusters.</p>
          <strong><Bolt size={14} /> Ceylon Electricity Board (CEB) Industrial Rate I-2 / I-3 Optimized</strong>
        </div>
      </main>
      <footer className="auth-footer">
        <span><Activity size={15} /> INDUSTRIAL TOD PEAK LOAD &amp; SCADA SHIELD</span>
        <span>© 2024 Garment SME Energy Protocol. All rights reserved.</span>
      </footer>
      {showRegister && <RegisterModal close={() => setShowRegister(false)} />}
    </div>
  );
}

function RegisterModal({ close }: { close: () => void }) {
  const { signup, loading, error } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<SignupInput>({ name: '', email: '', password: '', factoryName: '', phone: '' });

  const set = (key: keyof SignupInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await signup(form);
    if (ok) { toast('Account created! Welcome to Apex Energy.', 'success'); close(); }
  };

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal-card register-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">
          <div className="soft-icon"><Factory size={20} /></div>
          <div><h2>Create Factory Manager Account</h2><p>Register your facility to begin optimization</p></div>
          <button onClick={close}><X /></button>
        </div>
        <form onSubmit={submit} className="modal-fields">
          <label>MANAGER NAME<div className="input-wrap"><UserRound size={18} /><input required value={form.name} onChange={set('name')} placeholder="Tharuka Thilakarathna" /></div></label>
          <label>EMAIL<div className="input-wrap"><Factory size={18} /><input required type="email" value={form.email} onChange={set('email')} placeholder="tharuka@nookclothes.lk" /></div></label>
          <label>PASSWORD<div className="input-wrap"><LockKeyhole size={18} /><input required type="password" value={form.password} onChange={set('password')} placeholder="••••••••" /></div></label>
          <label>PHONE NUMBER<div className="input-wrap"><Phone size={18} /><input required value={form.phone} onChange={set('phone')} placeholder="+94 77 123 4567" /></div></label>
          <label>FACTORY NAME<div className="input-wrap"><Factory size={18} /><input required value={form.factoryName} onChange={set('factoryName')} placeholder="Nook Clothes" /></div></label>
          {error && <div className="auth-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={close}>Cancel</button>
            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? <><RefreshCw className="spin" size={16} /> Creating...</> : <><Plus size={16} /> Create Account</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
