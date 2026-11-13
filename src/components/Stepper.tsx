import { useId, useState, type ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';

interface Props {
  label: ReactNode;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  decimals?: number;
  hint?: ReactNode;
  /** Optional list of snap values for the +/- buttons (e.g. aperture stops). */
  snaps?: number[];
  format?: (v: number) => string;
}

export function Stepper({ label, value, onChange, step = 1, min = -Infinity, max = Infinity, unit, decimals, hint, snaps, format }: Props) {
  const id = useId();
  const [text, setText] = useState(() => fmt(value));
  const [editing, setEditing] = useState(false);

  function fmt(v: number) {
    if (!Number.isFinite(v)) return '';
    if (format) return format(v);
    return decimals != null ? v.toFixed(decimals) : String(Math.round(v * 1e6) / 1e6);
  }

  function clamp(v: number) {
    return Math.min(max, Math.max(min, v));
  }

  function nudge(dir: 1 | -1) {
    if (snaps && snaps.length) {
      const sorted = snaps.slice().sort((a, b) => a - b);
      if (dir > 0) {
        const next = sorted.find((s) => s > value + 1e-9);
        if (next != null) onChange(clamp(next));
        return;
      }
      const prev = sorted.slice().reverse().find((s) => s < value - 1e-9);
      if (prev != null) onChange(clamp(prev));
      return;
    }
    const n = clamp(Math.round((value + dir * step) * 1e6) / 1e6);
    onChange(n);
  }

  function commit() {
    setEditing(false);
    const n = parseFloat(text.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(n)) onChange(clamp(n));
    else setText(fmt(value));
  }

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        <span>{label}</span>
        {unit && <span>{unit}</span>}
      </label>
      <div className="stepper">
        <button type="button" className="stepper__btn" onClick={() => nudge(-1)} aria-label={`Decrease ${typeof label === 'string' ? label : ''}`} disabled={value <= min}>
          <Minus size={18} />
        </button>
        <input
          id={id}
          className="stepper__input"
          inputMode="decimal"
          value={editing ? text : fmt(value)}
          onFocus={() => {
            setEditing(true);
            setText(fmt(value));
          }}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              nudge(1);
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              nudge(-1);
            }
          }}
        />
        <button type="button" className="stepper__btn" onClick={() => nudge(1)} aria-label={`Increase ${typeof label === 'string' ? label : ''}`} disabled={value >= max}>
          <Plus size={18} />
        </button>
      </div>
      {hint && <div className="field__hint">{hint}</div>}
    </div>
  );
}
