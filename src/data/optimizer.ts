import type { Facility, Machine, Optimization, ScheduleSlot, Tariff } from '@/types';

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

export function computeOptimization(machines: Machine[], tariffs: Tariff[], facility: Facility): Optimization {
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
    let baseline = 0;
    for (let s = lo; slots > 0 && s + slots * SLOT <= hi; s += SLOT) {
      const c = cost(s);
      if (best < 0) baseline = c;
      if (c < bestCost) { bestCost = c; best = s; } // strict "<" keeps the earlier start on ties
    }
    if (best < 0) { skipped.push(m.name); continue; }

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
