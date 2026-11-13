import type { ReactNode } from 'react';

interface Props {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  sub?: ReactNode;
}

export function Readout({ label, value, unit, size = 'md', sub }: Props) {
  const cls = size === 'lg' ? 'readout__value readout__value--lg' : size === 'sm' ? 'readout__value readout__value--sm' : 'readout__value';
  return (
    <div className="readout">
      <span className="readout__label">{label}</span>
      <span className={cls}>
        {value}
        {unit && <span className="readout__unit">{unit}</span>}
      </span>
      {sub && <span className="tiny muted">{sub}</span>}
    </div>
  );
}
