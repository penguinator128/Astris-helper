import { describe, contrastRatio } from '@/lib/colour/colour';
import { copyText } from '@/lib/download';
import { toast } from '@/store/toast';

interface Props {
  hex: string;
  name?: string;
  onSelect?: (hex: string) => void;
  compact?: boolean;
}

/** Colour swatch with hex, RGB, HSL and OKLCH. Tapping copies the hex. */
export function Swatch({ hex, name, onSelect, compact }: Props) {
  const d = describe(hex);
  const dark = contrastRatio(hex, '#000000') < contrastRatio(hex, '#ffffff');
  async function copy() {
    const ok = await copyText(d.hex);
    toast(ok ? `Copied ${d.hex}` : d.hex);
    onSelect?.(d.hex);
  }
  return (
    <button type="button" className="swatch swatch-btn" onClick={copy} title={`Copy ${d.hex}`}>
      <div className="swatch__chip" style={{ background: hex, color: dark ? '#fff' : '#000' }}>
        {name && (
          <span className="tiny" style={{ display: 'block', padding: 6, fontWeight: 500 }}>
            {name}
          </span>
        )}
      </div>
      <div className="swatch__meta">
        <div className="swatch__hex">{d.hex}</div>
        {!compact && (
          <>
            <div className="swatch__row">
              <span>rgb</span>
              <span>{d.rgb.slice(4, -1)}</span>
            </div>
            <div className="swatch__row">
              <span>hsl</span>
              <span>{d.hsl.slice(4, -1)}</span>
            </div>
            <div className="swatch__row">
              <span>oklch</span>
              <span>{d.oklch.slice(6, -1)}</span>
            </div>
          </>
        )}
      </div>
      <span className="visually-hidden">Copy hex</span>
    </button>
  );
}
