import { useState, type ReactNode } from 'react';
import { Field } from '@/components/Field';
import { fmtShutter, parseShutter } from '@/lib/format';
import { STANDARD_SHUTTERS } from '@/lib/calc/exposure';

interface Props {
  label?: ReactNode;
  value: number; // seconds
  onChange: (seconds: number) => void;
  hint?: ReactNode;
}

/** Shutter speed input: type "1/50" or seconds, or pick a standard value. */
export function ShutterInput({ label = 'Shutter', value, onChange, hint }: Props) {
  const [text, setText] = useState<string | null>(null);
  const display = text ?? fmtShutter(value).replace(/ s$/, '');
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <div style={{ display: 'flex', gap: 'var(--s-1)', width: '100%' }}>
          <input
            id={id}
            className="input input--mono"
            inputMode="decimal"
            value={display}
            onFocus={() => setText(fmtShutter(value).replace(/ s$/, ''))}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => {
              if (text != null) {
                const s = parseShutter(text);
                if (Number.isFinite(s)) onChange(s);
              }
              setText(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            aria-describedby={`${id}-help`}
          />
          <select className="select" aria-label="Standard shutter speeds" value="" onChange={(e) => e.target.value && onChange(parseFloat(e.target.value))} style={{ width: 56, flex: '0 0 56px', padding: 0, backgroundPosition: 'center', color: 'transparent' }}>
            <option value="">—</option>
            {STANDARD_SHUTTERS.map((s) => (
              <option key={s} value={s}>
                {fmtShutter(s)}
              </option>
            ))}
          </select>
          <span id={`${id}-help`} className="visually-hidden">
            Type a fraction like 1/50 or seconds
          </span>
        </div>
      )}
    </Field>
  );
}
