import { computeOptimization, computeProfile, defaultProfiles, productiveHours, workingDaysIn } from '@/data/optimizer';
import type {
  Machine, MonthlyProfile, PortalData, ProfileInput, ProfileUpdateInput, RunRecord, ScheduleSlot, SignupInput, User,
} from '@/types';

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const DUMMY_DATA_URL = '/dummy.json';
const DUMMY_STORAGE_KEY = 'apex-energy-dummy-data-v5';
const TOKEN_STORAGE_KEY = 'apex-energy-token';
let cache: PortalData | null = null;

// The app talks to the FastAPI backend when it is reachable. If VITE_API_URL is
// missing or the server is down, it falls back to the sample data in /dummy.json.
let backendReachable: Promise<boolean> | null = null;

export function isBackendMode(): Promise<boolean> {
  if (!API_BASE_URL) return Promise.resolve(false);
  // Any HTTP response means the server is up (errors are then shown, not hidden by demo data).
  // Only a network failure counts as "offline"; that result is not cached so the next call retries.
  backendReachable ??= fetch(`${API_BASE_URL}/`, { signal: AbortSignal.timeout(3000) })
    .then(() => true)
    .catch(() => { backendReachable = null; return false; });
  return backendReachable;
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  cache = null;
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(options?.headers ?? {}) },
  });
  if (response.status === 401) {
    // Session expired or token invalid: go back to the login screen.
    clearAuthToken();
    localStorage.removeItem('apex-energy-user');
    window.location.reload();
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: unknown; message?: string } | null;
    const detail = body?.detail;
    const first = Array.isArray(detail) ? (detail[0] as { msg?: string } | undefined)?.msg : undefined;
    const message = typeof detail === 'string' ? detail
      : first ? first.replace(/^Value error, /, '')
      : body?.message ?? `Request failed with status ${response.status}.`;
    throw new Error(message);
  }
  return response.status === 204 ? (undefined as T) : await response.json() as T;
}

async function getDummyData(): Promise<PortalData> {
  const stored = localStorage.getItem(DUMMY_STORAGE_KEY);
  if (stored) return JSON.parse(stored) as PortalData;
  const response = await fetch(DUMMY_DATA_URL);
  if (!response.ok) throw new Error('Unable to load the local demo data.');
  const data = await response.json() as PortalData;
  localStorage.setItem(DUMMY_STORAGE_KEY, JSON.stringify(data));
  return data;
}

// Demo mode: recompute the schedule from the current machines so the pages stay consistent,
// and save the run to history (same as the backend does).
function saveDemoWithOptimization(data: PortalData, trigger?: string) {
  const o = computeOptimization(data.machines, data.tariffs, data.facility);
  data.optimization = o;
  if (trigger && o.schedules?.length) {
    const hours = productiveHours(data.facility.startTime, data.facility.endTime);
    const run: RunRecord = {
      id: `RUN-${Date.now()}`,
      createdAt: new Date().toISOString(),
      trigger,
      currentCost: o.currentCost,
      optimizedCost: o.optimizedCost,
      dailySaving: o.dailySaving,
      savingPercent: o.savingPercent,
      energy: o.energy,
      productiveHours: Math.round(hours * 100) / 100,
      machinesScheduled: o.schedules.length,
      kwhPerHour: hours > 0 ? Math.round((o.energy / hours) * 100) / 100 : 0,
      costPerHour: hours > 0 ? Math.round((o.optimizedCost / hours) * 100) / 100 : 0,
      schedules: o.schedules.map((x) => ({
        machineName: data.machines.find((m) => m.id === x.machineId)?.name ?? '',
        start: x.start, end: x.end, energy: x.energy, cost: x.cost,
      })),
    };
    data.history = [run, ...(data.history ?? [])].slice(0, 200);
  }
  saveDummyData(data);
}

function withComputedProfiles(data: PortalData): PortalData {
  data.history ??= [];
  data.profiles = (data.profiles ?? [])
    .map((p) => computeProfile(p, data.machines, data.tariffs))
    .sort((a, b) => a.year - b.year || a.month - b.month);
  return data;
}

export async function refreshData(): Promise<PortalData> {
  cache = null;
  return fetchData();
}

function saveDummyData(data: PortalData) {
  cache = data;
  localStorage.setItem(DUMMY_STORAGE_KEY, JSON.stringify(data));
}

function unwrapUser(payload: unknown, fallback?: User): User {
  const body = payload as {
    token?: string;
    access_token?: string;
    user?: User;
    data?: { token?: string; access_token?: string; user?: User };
    id?: number | string;
    email?: string;
    name?: string;
    phone?: string;
  };
  const token = body.token ?? body.access_token ?? body.data?.token ?? body.data?.access_token;
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
  if (body.user) return body.user;
  if (body.data?.user) return body.data.user;
  if (body.email) {
    return {
      id: String(body.id ?? 'user'),
      email: body.email,
      name: body.name ?? body.email.split('@')[0],
      role: 'Plant Manager',
      facilityCode: '',
      facilityName: '',
      phone: body.phone,
    };
  }
  if (fallback) return fallback;
  throw new Error('The server returned an invalid user response.');
}

type BackendMachine = {
  id: number;
  name: string;
  model_name?: string;
  category: string;
  quantity: number;
  power_w: number;
  required_hours: number;
  available_start: string;
  available_end: string;
  usual_start?: string | null;
  manufactured_year?: number | null;
  priority: string;
  color: string;
  saving?: number;
};

function mapSchedules(raw: unknown): ScheduleSlot[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>).map((s) => ({
    machineId: String(s.machine_id ?? ''),
    start: String(s.scheduled_start ?? '').slice(0, 5),
    end: String(s.scheduled_end ?? '').slice(0, 5),
    energy: Number(s.energy_kwh ?? 0),
    cost: Number(s.cost ?? 0),
    saving: Number(s.saving ?? 0),
  }));
}

function formatWindow(start: string, end: string): string {
  const fmt = (t: string) => {
    const parts = String(t).slice(0, 5).split(':');
    const h = Number(parts[0] ?? 0);
    const m = Number(parts[1] ?? 0);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

function mapMachineFromBackend(m: BackendMachine): Machine {
  return {
    id: String(m.id),
    name: m.name,
    modelName: m.model_name ?? '',
    category: m.category,
    quantity: m.quantity,
    power: m.power_w,
    hours: m.required_hours,
    window: formatWindow(m.available_start, m.available_end),
    priority: m.priority,
    saving: m.saving ?? 0,
    tone: m.color || 'blue',
    availableStart: String(m.available_start).slice(0, 8),
    availableEnd: String(m.available_end).slice(0, 8),
    usualStart: m.usual_start ? String(m.usual_start).slice(0, 8) : '',
    manufacturedYear: m.manufactured_year ?? null,
  };
}

function mapMachineToBackend(m: Partial<Machine> & { available_start?: string; available_end?: string }) {
  const body: Record<string, unknown> = {};
  if (m.name !== undefined) body.name = m.name;
  if (m.modelName !== undefined) body.model_name = m.modelName;
  if (m.category !== undefined) body.category = m.category;
  if (m.quantity !== undefined) body.quantity = m.quantity;
  if (m.power !== undefined) body.power_w = m.power;
  if (m.hours !== undefined) body.required_hours = m.hours;
  if (m.priority !== undefined) body.priority = m.priority;
  if (m.tone !== undefined) body.color = m.tone;
  if (m.available_start !== undefined) body.available_start = m.available_start;
  if (m.available_end !== undefined) body.available_end = m.available_end;
  if (m.availableStart !== undefined) {
    body.available_start = m.availableStart.length === 5 ? `${m.availableStart}:00` : m.availableStart;
  }
  if (m.availableEnd !== undefined) {
    body.available_end = m.availableEnd.length === 5 ? `${m.availableEnd}:00` : m.availableEnd;
  }
  if (m.manufacturedYear !== undefined) body.manufactured_year = m.manufacturedYear;
  if (m.usualStart !== undefined) {
    body.usual_start = m.usualStart ? (m.usualStart.length === 5 ? `${m.usualStart}:00` : m.usualStart) : null;
  }
  return body;
}

const hhmm = (t: unknown) => String(t ?? '').slice(0, 5);
const withSeconds = (t: string) => (t.length === 5 ? `${t}:00` : t);

function mapProfile(p: Record<string, unknown>): MonthlyProfile {
  return {
    id: String(p.id),
    year: Number(p.year),
    month: Number(p.month),
    season: (p.season as MonthlyProfile['season']) ?? 'Normal',
    optimized: p.optimized !== false,
    workingDays: Number(p.working_days ?? 0),
    startTime: hhmm(p.start_time),
    endTime: hhmm(p.end_time),
    inactiveMachineIds: Array.isArray(p.inactive_machine_ids) ? (p.inactive_machine_ids as number[]).map(String) : [],
    hoursPerDay: Number(p.hours_per_day ?? 0),
    activeMachines: Number(p.active_machines ?? 0),
    skipped: Array.isArray(p.skipped_machines) ? (p.skipped_machines as string[]) : [],
    dailyKwh: Number(p.daily_kwh ?? 0),
    dailyCost: Number(p.daily_cost ?? 0),
    monthlyKwh: Number(p.monthly_kwh ?? 0),
    monthlyBill: Number(p.monthly_bill ?? 0),
    monthlyBaseline: Number(p.monthly_baseline ?? 0),
    monthlySaving: Number(p.monthly_saving ?? 0),
    potentialSaving: Number(p.potential_saving ?? 0),
    kwhPerHour: Number(p.kwh_per_hour ?? 0),
    costPerHour: Number(p.cost_per_hour ?? 0),
  };
}

function mapRun(r: Record<string, unknown>): RunRecord {
  const items = Array.isArray(r.schedules) ? (r.schedules as Array<Record<string, unknown>>) : [];
  return {
    id: String(r.id),
    createdAt: String(r.created_at ?? ''),
    trigger: String(r.trigger ?? ''),
    currentCost: Number(r.current_cost ?? 0),
    optimizedCost: Number(r.optimized_cost ?? 0),
    dailySaving: Number(r.daily_saving ?? 0),
    savingPercent: Number(r.saving_percentage ?? 0),
    energy: Number(r.energy_kwh ?? 0),
    productiveHours: Number(r.productive_hours ?? 0),
    machinesScheduled: Number(r.machines_scheduled ?? 0),
    kwhPerHour: Number(r.kwh_per_hour ?? 0),
    costPerHour: Number(r.cost_per_hour ?? 0),
    schedules: items.map((x) => ({
      machineName: String(x.machine_name ?? ''), start: String(x.start ?? ''), end: String(x.end ?? ''),
      energy: Number(x.energy_kwh ?? 0), cost: Number(x.cost ?? 0),
    })),
  };
}

export async function fetchData(): Promise<PortalData> {
  if (cache) return cache;
  if (await isBackendMode()) {
    const [facilityRaw, machinesRaw, tariffsRaw, dashboardRaw, meRaw, reportsRaw] = await Promise.all([
      request<Record<string, unknown>>('/api/v1/factories/me'),
      request<BackendMachine[]>('/api/v1/machines'),
      request<Array<Record<string, unknown>>>('/api/v1/tariffs'),
      request<Record<string, unknown>>('/api/v1/dashboard'),
      request<Record<string, unknown>>('/api/v1/auth/me').catch((): Record<string, unknown> => ({})),
      request<Record<string, unknown>>('/api/v1/reports').catch((): Record<string, unknown> => ({ reports: [] })),
    ]);
    const [profilesRaw, historyRaw] = await Promise.all([
      request<Array<Record<string, unknown>>>('/api/v1/planning/profiles').catch(() => []),
      request<Array<Record<string, unknown>>>('/api/v1/history?limit=100').catch(() => []),
    ]);

    const facility = {
      name: String(facilityRaw.name ?? ''),
      code: String(facilityRaw.code ?? ''),
      manager: String(meRaw['name'] ?? ''),
      role: 'Plant Manager',
      tariff: String(facilityRaw.tariff_plan ?? ''),
      startTime: String(facilityRaw.start_time ?? '').slice(0, 5),
      endTime: String(facilityRaw.end_time ?? '').slice(0, 5),
      workingDays: Number(facilityRaw.working_days ?? 26),
    };

    const tariffs = (tariffsRaw ?? []).map((t) => ({
      id: String(t.id),
      period: String(t.period ?? ''),
      startTime: String(t.start_time ?? '').slice(0, 5),
      endTime: String(t.end_time ?? '').slice(0, 5),
      rate: Number(t.rate_per_kwh ?? 0),
    }));

    const optimization = {
      currentCost: Number(dashboardRaw.current_daily_cost ?? 0),
      optimizedCost: Number(dashboardRaw.optimized_daily_cost ?? 0),
      dailySaving: Number(dashboardRaw.daily_saving ?? 0),
      monthlySaving: Number(dashboardRaw.monthly_saving ?? 0),
      energy: Number(dashboardRaw.total_energy_kwh ?? 0),
      savingPercent: Number(dashboardRaw.saving_percentage ?? 0),
      schedules: mapSchedules(dashboardRaw.schedules),
      skipped: Array.isArray(dashboardRaw.skipped_machines) ? (dashboardRaw.skipped_machines as string[]) : [],
    };

    const reportList = Array.isArray(reportsRaw.reports) ? reportsRaw.reports as Array<Record<string, unknown>> : [];
    const reports = reportList.map((r) => ({
      id: String(r.id ?? ''),
      date: String(r.report_date ?? ''),
      currentCost: Number(r.current_cost ?? 0),
      optimizedCost: Number(r.optimized_cost ?? 0),
      saving: Number(r.saving ?? 0),
      energy: Number(r.energy_kwh ?? 0),
    }));

    cache = {
      users: [],
      facility,
      machines: (machinesRaw ?? []).map(mapMachineFromBackend),
      tariffs,
      optimization,
      reports,
      profiles: (profilesRaw ?? []).map(mapProfile),
      history: (historyRaw ?? []).map(mapRun),
    };
    return cache;
  }
  cache = withComputedProfiles(await getDummyData());
  return cache;
}

export async function authenticate(email: string, password: string): Promise<User | null> {
  cache = null;
  if (await isBackendMode()) {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.detail ?? 'Login failed');
    }

    const payload = await response.json();
    if (payload.access_token) localStorage.setItem(TOKEN_STORAGE_KEY, payload.access_token);

    try {
      const me = await request<Record<string, unknown>>('/api/v1/auth/me');
      return {
        id: String(me.id ?? 'authenticated'),
        email: String(me.email ?? email),
        name: String(me.name ?? email.split('@')[0]),
        role: 'Plant Manager',
        facilityCode: '',
        facilityName: '',
        phone: me.phone ? String(me.phone) : undefined,
      };
    } catch {
      return unwrapUser(payload, {
        id: 'authenticated',
        email,
        name: email.split('@')[0],
        role: 'Plant Manager',
        facilityCode: '',
        facilityName: '',
      });
    }
  }

  const data = await fetchData();
  return data.users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  ) ?? null;
}

export async function signup(input: SignupInput): Promise<User> {
  if (await isBackendMode()) {
    const payload = await request<unknown>('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        email: input.email,
        password: input.password,
        phone: input.phone,
        factory_name: input.factoryName,
      }),
    });
    const user = unwrapUser(payload, {
      id: 'new-user',
      email: input.email,
      name: input.name,
      role: 'Plant Manager',
      facilityCode: '',
      facilityName: input.factoryName,
      phone: input.phone,
    });
    if (!localStorage.getItem(TOKEN_STORAGE_KEY)) {
      await authenticate(input.email, input.password);
    }
    return user;
  }
  const data = await fetchData();
  if (data.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
    throw new Error('An account with this email already exists.');
  }
  const user: User = {
    id: `USR-${Date.now()}`,
    email: input.email,
    password: input.password,
    name: input.name,
    role: 'Plant Manager',
    facilityCode: `${input.factoryName.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
    facilityName: input.factoryName,
    phone: input.phone,
  };
  data.users.push(user);
  saveDummyData(data);
  return user;
}

export async function updateProfile(input: ProfileUpdateInput): Promise<User> {
  if (await isBackendMode()) {
    const body: Record<string, unknown> = {};
    if (input.name !== undefined) body.name = input.name;
    if (input.phone !== undefined) body.phone = input.phone;
    if (input.password) body.password = input.password;
    const me = await request<Record<string, unknown>>('/api/v1/auth/me', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    return {
      id: String(me.id ?? ''),
      email: String(me.email ?? ''),
      name: String(me.name ?? ''),
      role: 'Plant Manager',
      facilityCode: '',
      facilityName: '',
      phone: me.phone ? String(me.phone) : undefined,
    };
  }
  const data = await fetchData();
  const user = data.users[0];
  if (!user) throw new Error('No user found');
  if (input.name) user.name = input.name;
  if (input.phone !== undefined) user.phone = input.phone;
  if (input.password) user.password = input.password;
  saveDummyData(data);
  return user;
}

export async function createMachine(machine: Omit<Machine, 'id'>): Promise<Machine> {
  if (await isBackendMode()) {
    const body = mapMachineToBackend({
      ...machine,
      available_start: machine.availableStart
        ? (machine.availableStart.length === 5 ? `${machine.availableStart}:00` : machine.availableStart)
        : '08:00:00',
      available_end: machine.availableEnd
        ? (machine.availableEnd.length === 5 ? `${machine.availableEnd}:00` : machine.availableEnd)
        : '17:00:00',
    });
    const created = await request<BackendMachine>('/api/v1/machines', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    cache = null;
    return mapMachineFromBackend(created);
  }
  const data = await fetchData();
  const created = { ...machine, id: `MCH-${Date.now()}` };
  data.machines.push(created);
  saveDemoWithOptimization(data, `Machine added: ${created.name}`);
  return created;
}

export async function updateMachine(id: string, machine: Partial<Machine>): Promise<Machine> {
  if (await isBackendMode()) {
    const body = mapMachineToBackend(machine);
    const updated = await request<BackendMachine>(`/api/v1/machines/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    cache = null;
    return mapMachineFromBackend(updated);
  }
  const data = await fetchData();
  const index = data.machines.findIndex((item) => item.id === id);
  if (index < 0) throw new Error('Machine not found.');
  data.machines[index] = { ...data.machines[index], ...machine };
  saveDemoWithOptimization(data, `Machine updated: ${data.machines[index].name}`);
  return data.machines[index];
}

export async function deleteMachine(id: string): Promise<void> {
  if (await isBackendMode()) {
    await request<void>(`/api/v1/machines/${encodeURIComponent(id)}`, { method: 'DELETE' });
    cache = null;
    return;
  }
  const data = await fetchData();
  const removed = data.machines.find((item) => item.id === id);
  data.machines = data.machines.filter((item) => item.id !== id);
  saveDemoWithOptimization(data, `Machine deleted: ${removed?.name ?? id}`);
}

export async function updateFactory(factory: Partial<PortalData['facility']>): Promise<PortalData['facility']> {
  if (await isBackendMode()) {
    const body: Record<string, unknown> = {};
    if (factory.name !== undefined) body.name = factory.name;
    if (factory.code !== undefined) body.code = factory.code;
    if (factory.tariff !== undefined) body.tariff_plan = factory.tariff;
    if (factory.startTime !== undefined) {
      body.start_time = factory.startTime.length === 5 ? `${factory.startTime}:00` : factory.startTime;
    }
    if (factory.endTime !== undefined) {
      body.end_time = factory.endTime.length === 5 ? `${factory.endTime}:00` : factory.endTime;
    }
    if (factory.workingDays !== undefined) body.working_days = factory.workingDays;
    const updated = await request<Record<string, unknown>>('/api/v1/factories/me', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    cache = null;
    return {
      name: String(updated.name ?? ''),
      code: String(updated.code ?? ''),
      manager: factory.manager ?? '',
      role: factory.role ?? 'Plant Manager',
      tariff: String(updated.tariff_plan ?? ''),
      startTime: String(updated.start_time ?? '').slice(0, 5),
      endTime: String(updated.end_time ?? '').slice(0, 5),
      workingDays: Number(updated.working_days ?? 26),
    };
  }
  const data = await fetchData();
  data.facility = { ...data.facility, ...factory };
  saveDemoWithOptimization(data, 'Factory settings updated');
  return data.facility;
}

export async function runOptimization(): Promise<PortalData['optimization']> {
  if (await isBackendMode()) {
    const result = await request<Record<string, unknown>>('/api/v1/optimize', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    cache = null;
    return {
      currentCost: Number(result.current_cost ?? 0),
      optimizedCost: Number(result.optimized_cost ?? 0),
      dailySaving: Number(result.daily_saving ?? 0),
      monthlySaving: Number(result.monthly_saving ?? 0),
      energy: Number(result.total_energy_kwh ?? 0),
      savingPercent: Number(result.saving_percentage ?? 0),
      schedules: mapSchedules(result.schedules),
      skipped: Array.isArray(result.skipped_machines) ? (result.skipped_machines as string[]) : [],
    };
  }
  const data = await fetchData();
  saveDemoWithOptimization(data, 'Manual re-run');
  return data.optimization;
}

// ---- Seasonal plan ----

export async function updateMonthlyProfile(id: string, input: ProfileInput): Promise<void> {
  if (await isBackendMode()) {
    await request(`/api/v1/planning/profiles/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({
        season: input.season,
        optimized: input.optimized,
        working_days: input.workingDays,
        start_time: withSeconds(input.startTime),
        end_time: withSeconds(input.endTime),
        inactive_machine_ids: input.inactiveMachineIds.map(Number),
      }),
    });
    cache = null;
    return;
  }
  const data = await fetchData();
  const p = data.profiles.find((x) => x.id === id);
  if (!p) throw new Error('Profile not found.');
  Object.assign(p, input);
  saveDummyData(withComputedProfiles(data));
}

export async function createPlanYear(year: number): Promise<void> {
  if (await isBackendMode()) {
    await request(`/api/v1/planning/years/${year}`, { method: 'POST' });
    cache = null;
    return;
  }
  const data = await fetchData();
  if (data.profiles.some((p) => p.year === year)) throw new Error(`${year} already exists`);
  const previous = data.profiles.filter((p) => p.year === year - 1);
  const fresh = defaultProfiles(data.facility, year).map((p) => {
    const prev = previous.find((x) => x.month === p.month);
    return prev
      ? { ...p, season: prev.season, startTime: prev.startTime, endTime: prev.endTime,
          inactiveMachineIds: [...prev.inactiveMachineIds], workingDays: workingDaysIn(year, p.month) }
      : p;
  });
  data.profiles.push(...fresh);
  saveDummyData(withComputedProfiles(data));
}

export async function deletePlanYear(year: number): Promise<void> {
  if (await isBackendMode()) {
    await request(`/api/v1/planning/years/${year}`, { method: 'DELETE' });
    cache = null;
    return;
  }
  const data = await fetchData();
  data.profiles = data.profiles.filter((p) => p.year !== year);
  saveDummyData(data);
}

export function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
