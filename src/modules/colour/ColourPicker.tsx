import { useState } from 'react';
import { Slider } from '@/components/Slider';
import { describe, oklchToHex } from '@/lib/colour/colour';

interface Props {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
}

/** Hex field, native picker and OKLCH sliders for the must-have colour. */
export function ColourPicker({ value, onChange, label = 'Must-have colour' }: Props) {
  const d = describe(value);
  const [text, setText] = useState<string | null>(null);
  return (
    <div className="stack stack--sm">
      <div className="picker">
        <div className="picker__chip" style={{ background: value }}>
          <input type="color" value={d.hex} onChange={(e) => onChange(e.target.value)} aria-label={`${label} picker`} />
        </div>
        <div className="stack stack--sm">
          <div className="field">
            <label className="field__label" htmlFor="colour-hex">
              {label}
            </label>
            <input
              id="colour-hex"
              className="input input--mono"
              value={text ?? d.hex}
              onFocus={() => setText(d.hex)}
              onChange={(e) => setText(e.target.value)}
              onBlur={() => {
                if (text && /^#?[0-9a-f]{6}$/i.test(text.trim())) onChange(text.trim().startsWith('#') ? text.trim() : `#${text.trim()}`);
                setText(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              spellCheck={false}
            />
          </div>
          <Slider label="Lightness" value={Math.round(d.l * 100)} onChange={(v) => onChange(oklchToHex(v / 100, d.c, d.h))} min={0} max={100} unit="%" />
          <Slider label="Chroma" value={Math.round(d.c * 1000) / 1000} onChange={(v) => onChange(oklchToHex(d.l, v, d.h))} min={0} max={0.37} step={0.005} decimals={3} />
          <Slider label="Hue" value={Math.round(d.h)} onChange={(v) => onChange(oklchToHex(d.l, d.c, v))} min={0} max={360} unit="°" />
        </div>
      </div>
    </div>
  );
}
