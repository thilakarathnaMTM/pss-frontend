import { Bolt } from 'lucide-react';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <div className="brand-mark">
        <Bolt size={22} />
      </div>
      <div>
        <strong>APEX ENERGY</strong>
        <span>{compact ? 'TELEMETRY' : 'SME TELEMETRY'}</span>
      </div>
    </div>
  );
}

export const LOGO_URL =
  'https://lh3.googleusercontent.com/aida/AEtjO1VVW-ffahGR-hIR5uHx8bGCDDWVhtlsvmvGMtOc8G1e9onYpaJ52IeUOp-zi251agdO2jwSP9lDdDzQ8dCm-BYzwy9VH6vI7mJGUc8b2VF8IC7ASwuiwK8IefR9KWHrZlYm9c_HsQ_uTyldnJ-1ovVHp9aLrAb2_D4qImUfXd2y772udwquc60Oe--R-sytZ1RoCuQnTMSLTz62MK5p9zhedj5asNOD0JpvKnBmkmHb9m73WlWiUAC7Ds7N';
