import type { Facility, Machine, MonthlyProfile, Optimization, ScheduleSlot, Season, Tariff } from '@/types';

// Demo-mode copy of the backend optimizer (app/services/optimizer.py).
// Same formula: cost(start) = sum over 30-min slots of kW x 0.5 h x rate(slot time); pick the cheapest start.
const SLOT = 30;
const DEFAULT_RATE = 47;

const toMin = (t: string) => {
  const [h, m] = t.split(':');
  return Number(h) * 60 + Number(m ?? 0);
};
const toHHMM = (m: number) =>
  `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const round2 = (n: number) => Math.round(n * 100) / 100;

function rateAt(minute: number, tariffs: Tariff[]): number {
  const m = minute % 1440;
  for (const t of tariffs) {
    const s = toMin(t.startTime);
    const e = toMin(t.endTime);
    if (s < e ? m >= s && m < e : m >= s || m < e) return t.rate;
  }
  return DEFAULT_RATE;
}

export function computeOptimization(
  machines: Machine[],
  tariffs: Tariff[],
  facility: Pick<Facility, 'startTime' | 'endTime' | 'workingDays'>,
): Optimization {
  const schedules: ScheduleSlot[] = [];
  const skipped: string[] = [];
  let current = 0;

  for (const m of machines) {
    const kw = (m.quantity * m.power) / 1000;
    const slots = Math.round((m.hours * 60) / SLOT);
    const lo = Math.max(toMin(m.availableStart ?? '00:00'), toMin(facility.startTime));
    const hi = Math.min(toMin(m.availableEnd ?? '00:00'), toMin(facility.endTime));
    const cost = (start: number) => {
      let c = 0;
      for (let i = 0; i < slots; i++) c += kw * (SLOT / 60) * rateAt(start + i * SLOT, tariffs);
      return c;
    };

    let best = -1;
    let bestCost = Infinity;
    const starts: number[] = [];
    for (let s = lo; slots > 0 && s + slots * SLOT <= hi; s += SLOT) {
      starts.push(s);
      const c = cost(s);
      if (c < bestCost) { bestCost = c; best = s; } // strict "<" keeps the earlier start on ties
    }
    if (best < 0) { skipped.push(m.name); continue; }
    // Baseline = the usual (before-optimization) start, snapped to the nearest legal start; else window open.
    let baseStart = starts[0];
    if (m.usualStart) {
      const u = toMin(m.usualStart);
      baseStart = starts.reduce((a, b) => (Math.abs(b - u) < Math.abs(a - u) ? b : a));
    }
    const baseline = cost(baseStart);

    current += baseline;
    schedules.push({
      machineId: m.id,
      start: toHHMM(best),
      end: toHHMM(best + slots * SLOT),
      energy: round2(kw * slots * (SLOT / 60)),
      cost: round2(bestCost),
      saving: round2(Math.max(baseline - bestCost, 0)),
    });
  }

  const optimized = round2(schedules.reduce((s, x) => s + x.cost, 0));
  const currentCost = round2(current);
  const daily = round2(Math.max(currentCost - optimized, 0));
  return {
    currentCost,
    optimizedCost: optimized,
    dailySaving: daily,
    monthlySaving: round2(daily * facility.workingDays),
    energy: round2(schedules.reduce((s, x) => s + x.energy, 0)),
    savingPercent: currentCost > 0 ? round2((daily / currentCost) * 100) : 0,
    schedules,
    skipped,
  };
}

// ---- Seasonal plan (mirror of app/services/planning.py) ----

const HOLIDAYS_PER_MONTH = [0, 2, 2, 1, 3, 2, 1, 1, 1, 1, 2, 1, 2];
const SEASON_BY_MONTH: Record<number, Season> = { 1: 'Low', 4: 'Low', 8: 'Peak', 9: 'Peak', 10: 'Peak', 11: 'Peak' };
const LOW_SEASON_HOURS_CUT = 120;

/** Productive hours per day = operating hours from start to end. */
export const productiveHours = (start: string, end: string) => Math.max(toMin(end) - toMin(start), 0) / 60;

/** Monday-Saturday days in the month minus the usual holidays. */
export function workingDaysIn(year: number, month: number): number {
  const days = new Date(year, month, 0).getDate();
  let monSat = 0;
  for (let d = 1; d <= days; d++) if (new Date(year, month - 1, d).getDay() !== 0) monSat++;
  return monSat - HOLIDAYS_PER_MONTH[month];
}

export function defaultProfiles(facility: Facility, year: number): MonthlyProfile[] {
  const start = toMin(facility.startTime);
  const end = toMin(facility.endTime);
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const season = SEASON_BY_MONTH[month] ?? 'Normal';
    const monthEnd = season === 'Low' ? Math.max(end - LOW_SEASON_HOURS_CUT, start + 8 * 60) : end;
    return {
      ...blankProfile(`P-${year}-${month}`, year, month, season, workingDaysIn(year, month),
        facility.startTime.slice(0, 5), toHHMM(Math.min(monthEnd, end))),
      optimized: year >= new Date().getFullYear(), // past years: before the app was in use
    };
  });
}

function blankProfile(id: string, year: number, month: number, season: Season, workingDays: number, startTime: string, endTime: string): MonthlyProfile {
  return {
    id, year, month, season, optimized: true, workingDays, startTime, endTime, inactiveMachineIds: [],
    hoursPerDay: 0, activeMachines: 0, skipped: [], dailyKwh: 0, dailyCost: 0, monthlyKwh: 0,
    monthlyBill: 0, monthlyBaseline: 0, monthlySaving: 0, potentialSaving: 0, kwhPerHour: 0, costPerHour: 0,
  };
}

/** Optimize one typical day of the month with its hours and active machines, then scale by working days. */
export function computeProfile(p: MonthlyProfile, machines: Machine[], tariffs: Tariff[]): MonthlyProfile {
  const inactive = p.inactiveMachineIds.filter((id) => machines.some((m) => m.id === id));
  const active = machines.filter((m) => !inactive.includes(m.id));
  const day = computeOptimization(active, tariffs, { startTime: p.startTime, endTime: p.endTime, workingDays: p.workingDays });
  const hours = productiveHours(p.startTime, p.endTime);
  const days = p.workingDays;
  const used = p.optimized !== false;
  const dayBill = used ? day.optimizedCost : day.currentCost; // without the app: the usual schedule's cost
  return {
    ...p,
    optimized: used,
    inactiveMachineIds: inactive,
    hoursPerDay: round2(hours),
    activeMachines: active.length,
    skipped: day.skipped ?? [],
    dailyKwh: day.energy,
    dailyCost: round2(dayBill),
    monthlyKwh: round2(day.energy * days),
    monthlyBill: round2(dayBill * days),
    monthlyBaseline: round2(day.currentCost * days),
    monthlySaving: used ? round2(day.dailySaving * days) : 0,
    potentialSaving: round2(day.dailySaving * days),
    kwhPerHour: hours > 0 ? round2(day.energy / hours) : 0,
    costPerHour: hours > 0 ? round2(dayBill / hours) : 0,
  };
}
