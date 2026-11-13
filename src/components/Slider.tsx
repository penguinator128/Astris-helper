import { useId, useState, type ReactNode } from 'react';

interface Props {
  label: ReactNode;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  decimals?: number;
  format?: (v: number) => string;
  hint?: ReactNode;
  /** Allow typing an exact value next to the slider. */
  editable?: boolean;
}

export function Slider({ label, value, onChange, min, max, step = 1, unit, decimals = 0, format, hint, editable = true }: Props) {
  const id = useId();
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);

  const display = format ? format(value) : `${value.toFixed(decimals)}${unit ? ` ${unit}` : ''}`;

  return (
    <div className="slider field">
      <label className="field__label" htmlFor={id}>
        <span>{label}</span>
        {!editable && <span className="mono">{display}</span>}
      </label>
      <div className="slider__row">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          style={{ ['--pct' as string]: `${pct}%` }}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          aria-valuetext={display}
        />
        {editable && (
          <div className="slider__value">
            <input
              className="input input--mono"
              inputMode="decimal"
              aria-label={`${typeof label === 'string' ? label : 'Value'} exact`}
              value={editing ? text : value.toFixed(decimals)}
              onFocus={() => {
                setEditing(true);
                setText(value.toFixed(decimals));
              }}
              onChange={(e) => setText(e.target.value)}
              onBlur={() => {
                setEditing(false);
                const n = parseFloat(text);
                if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
            {unit && (
              <span className="tiny muted" style={{ marginLeft: 4 }}>
                {unit}
              </span>
            )}
          </div>
        )}
      </div>
      {hint && <div className="field__hint">{hint}</div>}
    </div>
  );
}
