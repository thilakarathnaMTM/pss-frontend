import { useState, type FormEvent } from 'react';
import { Bolt, LogOut, Menu, Settings, UserRound, X } from 'lucide-react';
import { Brand } from '@/components/Brand';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/components/ToastContext';
import { useAuth } from '@/auth/AuthContext';
import { updateProfile } from '@/data/api';
import type { User, View } from '@/types';

type Props = {
  user: User;
  facilityName: string;
  facilityCode: string;
  view: View;
  setView: (v: View) => void;
  onSignOut: () => void;
  children: React.ReactNode;
};

const NAV_ITEMS: { key: View; label: string }[] = [
  { key: 'factory', label: 'Factory' },
  { key: 'machines', label: 'Machines' },
  { key: 'optimization', label: 'Optimization' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'reports', label: 'Reports' },
];

export function AppHeader({ user, facilityName, facilityCode, view, setView, onSignOut, children }: Props) {
  const { toast } = useToast();
  const { updateUser } = useAuth();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSignOut = () => {
    setConfirmSignOut(false);
    onSignOut();
    toast('Signed out successfully', 'info');
  };

  const openProfile = () => {
    setName(user.name);
    setPhone(user.phone ?? '');
    setPassword('');
    setProfileOpen(true);
  };

  const handleProfileSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateProfile({
        name,
        phone,
        ...(password ? { password } : {}),
      });
      updateUser(updated);
      setProfileOpen(false);
      setPassword('');
      toast('Profile updated', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="portal-shell">
      <header className="app-header">
        <div className="header-inner">
          <Brand compact />
          <div className="brand-subtitle">
            <b>SRI LANKA SME ENGINE</b>
            <span>Energy Optimization for SME Garment Factory</span>
          </div>
          <nav>
            {NAV_ITEMS.map((item) => (
              <button key={item.key} className={view === item.key ? 'active' : ''} onClick={() => setView(item.key)}>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="profile">
            <span className="status-dot" /> CEB Grid: Normal
            <div className="profile-name">
              <b>{user.name}</b>
              <small>{user.role} • {facilityName}</small>
            </div>
            <button className="signout-header-btn" title="Account settings" onClick={openProfile}>
              <Settings size={17} />
            </button>
            <button className="signout-header-btn" title="Sign Out" onClick={() => setConfirmSignOut(true)}>
              <LogOut size={17} />
            </button>
            <button className="icon-button mobile-menu"><Menu size={19} /></button>
          </div>
        </div>
      </header>
      <div className="context-bar">
        <span><Bolt size={15} /> CEB INDUSTRIAL TARIFF (I-2 / I-3)</span>
        <i>•</i>
        <span>TOD SOLVER v2.4</span>
        <i>•</i>
        <b>FACILITY: {facilityCode}</b>
        <strong><span className="status-dot" /> Solver: Feasible Global Optimal Found</strong>
      </div>
      {children}

      {profileOpen && (
        <div className="modal-backdrop" onClick={() => setProfileOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-title">
              <div className="soft-icon"><UserRound size={20} /></div>
              <div>
                <h2>Account Settings</h2>
                <p>Update your manager profile for {facilityName}</p>
              </div>
              <button type="button" onClick={() => setProfileOpen(false)}><X /></button>
            </div>
            <form onSubmit={handleProfileSave} className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <label>
                Manager Name
                <input required value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label>
                Email
                <input value={user.email} disabled />
              </label>
              <label>
                Phone
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0771234567" />
              </label>
              <label>
                New Password
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to keep current" />
              </label>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setProfileOpen(false)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmSignOut}
        title="Sign Out"
        message="Are you sure you want to sign out of the facility portal?"
        confirmLabel="Sign Out"
        cancelLabel="Stay Signed In"
        variant="primary"
        onConfirm={handleSignOut}
        onCancel={() => setConfirmSignOut(false)}
      />
    </div>
  );
}
