import { useCallback, useEffect, useState } from 'react';
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
import { Planning } from '@/features/planning/Planning';
import { fetchData, isBackendMode, refreshData } from '@/data/api';
import type { PortalData, View } from '@/types';

function AppContent() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<PortalData | null>(null);
  const [view, setView] = useState<View>('factory');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    if (!user) { setData(null); setError(null); return; }
    setLoading(true);
    setError(null);
    isBackendMode().then((on) => setDemo(!on));
    fetchData()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unable to load your factory data.'))
      .finally(() => setLoading(false));
  }, [user]);

  // Re-read machines, factory, schedule and reports from the database after any change.
  const reload = useCallback(async () => {
    setData(await refreshData());
  }, []);

  if (!user) return <Login />;
  if (loading) return <div className="loading-screen"><Bolt size={28} /><span>Loading telemetry profile</span></div>;
  if (error || !data) return <div className="loading-screen"><span>{error ?? 'No factory data is available.'}</span></div>;

  return (
    <AppHeader user={user} facilityName={data.facility.name} facilityCode={data.facility.code} view={view} setView={setView} onSignOut={logout}>
      {demo && <div className="demo-banner">Demo mode: backend not reachable, showing sample data from dummy.json. Changes are kept in this browser only.</div>}
      {view === 'factory' && (
        <FactorySetup
          facility={data.facility}
          tariffs={data.tariffs}
          setView={setView}
          onChanged={reload}
        />
      )}
      {view === 'machines' && <Machines machines={data.machines} optimization={data.optimization} workingDays={data.facility.workingDays} onChanged={reload} setView={setView} />}
      {view === 'optimization' && <Optimization machines={data.machines} optimization={data.optimization} onChanged={reload} tariffs={data.tariffs} setView={setView} />}
      {view === 'dashboard' && <Dashboard machines={data.machines} optimization={data.optimization} facility={data.facility} tariffs={data.tariffs} setView={setView} />}
      {view === 'planning' && <Planning profiles={data.profiles} machines={data.machines} onChanged={reload} setView={setView} />}
      {view === 'reports' && <Reports reports={data.reports} history={data.history} setView={setView} />}
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
