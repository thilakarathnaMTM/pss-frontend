import type { Machine, ScheduleSlot } from '@/types';

/*
 * Ageing / efficiency-loss ESTIMATE (not a measurement).
 * Machines draw a little more power each year: motor bearings and belts add friction, heating elements and
 * steam generators scale up, compressors leak. We assume a yearly drift per machine type, compounded:
 *
 *   estimated W now = rated W x (1 + rate) ^ age
 *   extra kWh/day   = (estimated W - rated W) x quantity x hours / 1000
 *   extra cost      = extra kWh x the Rs/kWh this machine pays in its optimized slot
 *
 * The optimizer keeps using the rated W; this only flags machines worth checking with a clamp meter.
 */
export const DRIFT_PER_YEAR: Record<string, number> = {
  Cutting: 0.008,
  Sewing: 0.008,
  Embroidery: 0.008,
  Packaging: 0.01,
  Finishing: 0.015, // irons, fusing presses: heating elements + scale
  Washing: 0.015, // washer heaters, dryers: scale, lint, worn seals
  Utilities: 0.02, // air compressors: leaks, worn valves, clogged filters
  General: 0.01,
};
const MAX_INCREASE = 0.25; // cap the estimate; beyond this a machine needs an audit, not a formula
const DEFAULT_RATE = 47; // Rs/kWh (Day) if the machine has no schedule

export type HealthStatus = 'good' | 'monitor' | 'service' | 'replace' | 'unknown';

export type MachineHealth = {
  machine: Machine;
  age: number | null;
  driftPerYear: number;
  ratedW: number; // quantity x W per unit
  estimatedW: number;
  increasePct: number;
  extraKwhDay: number;
  ratePerKwh: number;
  extraCostDay: number;
  extraCostMonth: number;
  extraCostYear: number;
  status: HealthStatus;
  recommendation: string;
};

const MAINTENANCE: Record<string, string> = {
  Cutting: 'Clean and lubricate the motor and bearings, check belt tension and blade sharpness.',
  Sewing: 'Lubricate motors and bearings, check belts; a servo-motor upgrade cuts idle power.',
  Embroidery: 'Lubricate, check belts and motor brushes; clean dust from cooling vents.',
  Packaging: 'Clean the sealing jaws, check the heater element and thermostat calibration.',
  Finishing: 'Descale the steam generator / heating plates, check thermostat and insulation.',
  Washing: 'Descale the heater, clean lint and exhaust filters, check door seals.',
  Utilities: 'Fix air leaks, clean the intake filter, lower the pressure set-point if possible.',
  General: 'Routine service: clean, lubricate and tighten electrical connections.',
};

function statusFor(increase: number): HealthStatus {
  if (increase >= 0.15) return 'replace';
  if (increase >= 0.08) return 'service';
  if (increase >= 0.03) return 'monitor';
  return 'good';
}

export function machineHealth(
  machines: Machine[],
  schedules: ScheduleSlot[] | undefined,
  workingDays: number,
  year = new Date().getFullYear(),
): MachineHealth[] {
  return machines
    .map((m) => {
      const ratedW = m.quantity * m.power;
      const drift = DRIFT_PER_YEAR[m.category] ?? DRIFT_PER_YEAR.General;
      const slot = schedules?.find((s) => s.machineId === m.id);
      const ratePerKwh = slot && slot.energy > 0 ? slot.cost / slot.energy : DEFAULT_RATE;
      const age = m.manufacturedYear ? Math.max(0, year - m.manufacturedYear) : null;

      if (age === null) {
        return {
          machine: m, age, driftPerYear: drift, ratedW, estimatedW: ratedW, increasePct: 0, extraKwhDay: 0,
          ratePerKwh, extraCostDay: 0, extraCostMonth: 0, extraCostYear: 0, status: 'unknown' as const,
          recommendation: 'Add the manufactured year (Edit machine) to estimate its efficiency loss.',
        };
      }

      const increase = Math.min((1 + drift) ** age - 1, MAX_INCREASE);
      const estimatedW = ratedW * (1 + increase);
      const extraKwhDay = ((estimatedW - ratedW) * m.hours) / 1000;
      const extraCostDay = extraKwhDay * ratePerKwh;
      const status = statusFor(increase);
      const maintenance = MAINTENANCE[m.category] ?? MAINTENANCE.General;
      const recommendation =
        status === 'replace'
          ? `About ${age} years old. Get a quote for an energy-efficient replacement — it may already cost ~Rs. ${Math.round(extraCostDay * workingDays * 12).toLocaleString()}/year more than when new. ${maintenance}`
          : status === 'service'
            ? `Service due. ${maintenance}`
            : status === 'monitor'
              ? `Check at the next routine maintenance. ${maintenance}`
              : 'No action needed — still close to its rated power.';

      return {
        machine: m, age, driftPerYear: drift, ratedW, estimatedW, increasePct: increase * 100, extraKwhDay,
        ratePerKwh, extraCostDay, extraCostMonth: extraCostDay * workingDays, extraCostYear: extraCostDay * workingDays * 12,
        status, recommendation,
      };
    })
    .sort((a, b) => b.extraCostYear - a.extraCostYear);
}
