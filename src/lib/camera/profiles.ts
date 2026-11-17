/** Picture profiles and how the simulated preview renders them. */
export type Curve = 'rec709' | 'flat' | 'cine' | 'clog' | 'clog2' | 'clog3' | 'slog3' | 'vlog' | 'flog2' | 'bmdfilm' | 'hlg';

export interface Profile {
  id: string;
  name: string;
  kind: 'standard' | 'flat' | 'cine' | 'log' | 'hdr';
  curve: Curve;
  /** Lowest recommended ISO in this profile, if the maker sets one. */
  minIso?: number;
  saturation: number;
  colourSpaces: string[];
}

export const PROFILES: Profile[] = [
  { id: 'standard', name: 'Standard', kind: 'standard', curve: 'rec709', saturation: 1, colourSpaces: ['BT.709'] },
  { id: 'neutral', name: 'Neutral', kind: 'flat', curve: 'flat', saturation: 0.85, colourSpaces: ['BT.709'] },
  { id: 'cinetone', name: 'S-Cinetone', kind: 'cine', curve: 'cine', saturation: 0.95, colourSpaces: ['BT.709'] },
  { id: 'cinelike-d2', name: 'Cinelike D2', kind: 'flat', curve: 'flat', saturation: 0.9, colourSpaces: ['BT.709'] },
  { id: 'eterna', name: 'Eterna', kind: 'cine', curve: 'cine', saturation: 0.8, colourSpaces: ['BT.709'] },
  { id: 'video', name: 'Video (Rec.709)', kind: 'standard', curve: 'rec709', saturation: 1, colourSpaces: ['Rec.709'] },
  { id: 'extended-video', name: 'Extended Video', kind: 'flat', curve: 'flat', saturation: 0.95, colourSpaces: ['Rec.709'] },
  { id: 'clog', name: 'Canon Log', kind: 'log', curve: 'clog', minIso: 400, saturation: 0.75, colourSpaces: ['Cinema Gamut', 'BT.709'] },
  { id: 'clog2', name: 'Canon Log 2', kind: 'log', curve: 'clog2', minIso: 800, saturation: 0.72, colourSpaces: ['Cinema Gamut', 'BT.2020', 'BT.709'] },
  { id: 'clog3', name: 'Canon Log 3', kind: 'log', curve: 'clog3', minIso: 400, saturation: 0.75, colourSpaces: ['Cinema Gamut', 'BT.2020', 'BT.709'] },
  { id: 'slog3', name: 'S-Log3', kind: 'log', curve: 'slog3', minIso: 640, saturation: 0.72, colourSpaces: ['S-Gamut3.Cine', 'S-Gamut3'] },
  { id: 'vlog', name: 'V-Log', kind: 'log', curve: 'vlog', minIso: 640, saturation: 0.74, colourSpaces: ['V-Gamut'] },
  { id: 'flog2', name: 'F-Log2', kind: 'log', curve: 'flog2', minIso: 1250, saturation: 0.72, colourSpaces: ['F-Gamut'] },
  { id: 'bmd-film', name: 'Film (Gen 5)', kind: 'log', curve: 'bmdfilm', saturation: 0.75, colourSpaces: ['Blackmagic Wide Gamut'] },
  { id: 'hlg', name: 'HLG', kind: 'hdr', curve: 'hlg', saturation: 0.95, colourSpaces: ['BT.2020'] },
  { id: 'log-generic', name: 'Log (any maker)', kind: 'log', curve: 'clog3', minIso: 400, saturation: 0.74, colourSpaces: ['Native wide gamut', 'BT.2020', 'BT.709'] },
  { id: 'raw', name: 'RAW (shown as Log until graded)', kind: 'log', curve: 'clog3', saturation: 0.74, colourSpaces: ['Native wide gamut'] },
];

export function profile(id: string): Profile {
  return PROFILES.find((p) => p.id === id) ?? PROFILES[0];
}

/** Camera log encodings from the makers' published formulas. Input is scene-linear reflectance (0.18 = middle grey). */
export function encode(curve: Curve, x: number): number {
  const v = Math.max(0, x);
  switch (curve) {
    case 'slog3':
      return v >= 0.01125 ? (420 + Math.log10((v + 0.01) / 0.19) * 261.5) / 1023 : (v * (171.2102946929 - 95) / 0.01125 + 95) / 1023;
    case 'clog3':
      return v >= 0.014 ? 0.36726845 * Math.log10(v * 14.98325 + 1) + 0.12783901 : 1.9754798 * v + 0.12512219;
    case 'clog2':
      return 0.24136077 * Math.log10(v * 87.09937546 + 1) + 0.092864125;
    case 'clog':
      return 0.529136 * Math.log10(v * 10.1596 + 1) + 0.0730597;
    case 'vlog':
      return v >= 0.01 ? 0.241514 * Math.log10(v + 0.00873) + 0.598206 : 5.6 * v + 0.125;
    case 'flog2':
      return v >= 0.000889 ? 0.245281 * Math.log10(5.555556 * v + 0.064829) + 0.384316 : 8.799461 * v + 0.092864;
    case 'bmdfilm':
      // Approximation: Blackmagic does not publish Gen 5 Film as a closed formula; this tracks its middle grey near 0.38.
      return 0.27 * Math.log10(v * 30 + 1) + 0.09;
    case 'hlg': {
      const a = 0.17883277;
      const b = 0.28466892;
      const c = 0.55991073;
      const e = v / 3.2; // scene light scaled so 18% grey sits near 38% signal, as BT.2100 recommends
      return e <= 1 / 12 ? Math.sqrt(3 * e) : a * Math.log(12 * e - b) + c;
    }
    default:
      return v;
  }
}

export const CURVE_ID: Record<Curve, number> = { rec709: 0, flat: 1, cine: 2, clog: 3, clog2: 4, clog3: 5, slog3: 6, vlog: 7, flog2: 8, bmdfilm: 9, hlg: 10 };
