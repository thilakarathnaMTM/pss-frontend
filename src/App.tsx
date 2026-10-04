import { useEffect, useState } from 'react';
import { Bolt } from 'lucide-react';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { ToastProvider } from '@/components/ToastContext';
import { AppHeader } from '@/components/AppHeader';
import { Login } from '@/features/auth/Login';
import { FactorySetup } from '@/features/factory/FactorySetup';
import { Machines } from '@/features/machines/Machines';
import { Optimization } from '@/features/optimization/Optimization';
import { Dashboard } from '@/features/dashboard/Dashboard';
import { Reports } from '@/features/reports/Reports';
import { fetchData } from '@/data/api';
import type { Facility, Machine, PortalData, View } from '@/types';

function AppContent() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<PortalData | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [view, setView] = useState<View>('factory');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setData(null); setError(null); return; }
    setLoading(true);
    setError(null);
    fetchData()
      .then((d) => { setData(d); setMachines(d.machines); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unable to load your factory data.'))
      .finally(() => setLoading(false));
  }, [user]);

  const handleFacilityUpdate = (facility: Facility) => {
    setData((prev) => (prev ? { ...prev, facility } : prev));
  };

  if (!user) return <Login />;
  if (loading) return <div className="loading-screen"><Bolt size={28} /><span>Loading telemetry profile</span></div>;
  if (error || !data) return <div className="loading-screen"><span>{error ?? 'No factory data is available.'}</span></div>;

  return (
    <AppHeader user={user} facilityName={data.facility.name} facilityCode={data.facility.code} view={view} setView={setView} onSignOut={logout}>
      {view === 'factory' && (
        <FactorySetup
          facility={data.facility}
          tariffs={data.tariffs}
          setView={setView}
          onFacilityUpdate={handleFacilityUpdate}
        />
      )}
      {view === 'machines' && <Machines machines={machines} setMachines={setMachines} setView={setView} />}
      {view === 'optimization' && <Optimization machines={machines} optimization={data.optimization} setView={setView} />}
      {view === 'dashboard' && <Dashboard machines={machines} optimization={data.optimization} facility={data.facility} tariffs={data.tariffs} setView={setView} />}
      {view === 'reports' && <Reports reports={data.reports} setView={setView} />}
    </AppHeader>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}
