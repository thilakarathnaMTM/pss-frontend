export type User = {
  id: string;
  email: string;
  password?: string;
  name: string;
  role: string;
  facilityCode: string;
  facilityName: string;
  phone?: string;
};

export type SignupInput = {
  name: string;
  email: string;
  password: string;
  factoryName: string;
  phone: string;
};

export type ProfileUpdateInput = {
  name?: string;
  phone?: string;
  password?: string;
};

export type Tariff = {
  id: string;
  period: string;
  startTime: string;
  endTime: string;
  rate: number;
};

export type Facility = {
  name: string;
  code: string;
  manager: string;
  role: string;
  tariff: string;
  startTime: string;
  endTime: string;
  workingDays: number;
};

export type Machine = {
  id: string;
  name: string;
  modelName: string;
  category: string;
  quantity: number;
  power: number;
  hours: number;
  window: string;
  priority: string;
  saving: number;
  tone: string;
  availableStart?: string;
  availableEnd?: string;
  /** How the factory ran it before optimization ("HH:MM:SS"); the cost baseline. Empty = window open. */
  usualStart?: string;
  /** Year the machine was built; drives the ageing / efficiency-loss estimate. */
  manufacturedYear?: number | null;
};

export type ScheduleSlot = {
  machineId: string;
  start: string;
  end: string;
  energy: number;
  cost: number;
  saving: number;
};

export type Optimization = {
  currentCost: number;
  optimizedCost: number;
  dailySaving: number;
  monthlySaving: number;
  energy: number;
  savingPercent: number;
  schedules?: ScheduleSlot[];
  skipped?: string[];
};

export type ReportRow = {
  id: string;
  date: string;
  currentCost: number;
  optimizedCost: number;
  saving: number;
  energy: number;
};

export type Season = 'Peak' | 'Normal' | 'Low';

// One month of the seasonal operating plan. The first block is stored; the rest is computed
// (by the backend, or by data/optimizer.ts in demo mode) from the current machines and tariffs.
export type MonthlyProfile = {
  id: string;
  year: number;
  month: number;
  season: Season;
  /** false = month before the factory used the app: the bill is the usual (un-optimized) schedule. */
  optimized: boolean;
  workingDays: number;
  startTime: string;
  endTime: string;
  inactiveMachineIds: string[];
  hoursPerDay: number;
  activeMachines: number;
  skipped: string[];
  dailyKwh: number;
  dailyCost: number;
  monthlyKwh: number;
  monthlyBill: number;
  monthlyBaseline: number;
  monthlySaving: number;
  potentialSaving: number;
  kwhPerHour: number;
  costPerHour: number;
};

export type ProfileInput = Pick<MonthlyProfile, 'season' | 'optimized' | 'workingDays' | 'startTime' | 'endTime' | 'inactiveMachineIds'>;

export type RunRecord = {
  id: string;
  createdAt: string;
  trigger: string;
  currentCost: number;
  optimizedCost: number;
  dailySaving: number;
  savingPercent: number;
  energy: number;
  productiveHours: number;
  machinesScheduled: number;
  kwhPerHour: number;
  costPerHour: number;
  schedules: { machineName: string; start: string; end: string; energy: number; cost: number }[];
};

export type PortalData = {
  users: User[];
  facility: Facility;
  tariffs: Tariff[];
  machines: Machine[];
  optimization: Optimization;
  reports: ReportRow[];
  profiles: MonthlyProfile[];
  history: RunRecord[];
};

export type View = 'factory' | 'machines' | 'optimization' | 'dashboard' | 'planning' | 'reports';
