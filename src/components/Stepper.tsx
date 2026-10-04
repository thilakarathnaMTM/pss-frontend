import { Check } from 'lucide-react';

export function Stepper({ current }: { current: number }) {
  return (
    <div className="stepper">
      <span className={current >= 1 ? 'done' : ''}>
        {current >= 1 && <Check size={13} />} 01 Factory Setup
      </span>
      <b className={current === 2 ? '' : 'inactive'}>
        <span>02</span> Add Machines
      </b>
      <span className={current >= 3 ? 'done' : ''}>
        {current >= 3 && <Check size={13} />} 03 Optimization
      </span>
      <span className={current >= 4 ? 'done' : ''}>
        {current >= 4 && <Check size={13} />} 04 Dashboard
      </span>
    </div>
  );
}
