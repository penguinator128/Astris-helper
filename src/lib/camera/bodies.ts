import type { Connector, SignalKind } from '@/types/project';

export type PortSpec = [name: string, dir: 'in' | 'out', connector: Connector, signal: SignalKind, extra?: { standard?: string; phantom?: boolean; vMin?: number; vMax?: number; vOut?: number }];

export interface Codec {
  name: string;
  format: string;
  bitDepths: string[];
  chroma: string[];
}

export interface CameraBody {
  id: string;
  manufacturer: string;
  model: string;
  type: 'dslr' | 'mirrorless' | 'cinema';
  mount: string;
  sensorId: string;
  isoRange: [number, number];
  nativeIso: number[];
  usesEI: boolean;
  resolutions: { label: string; maxFps: number }[];
  fpsOptions: number[];
  codecs: Codec[];
  profiles: string[];
  colourSpaces: string[];
  stabilisation: string[];
  battery: string;
  volts: [number, number];
  ports: PortSpec[];
  size: [number, number, number]; // mm: width, height, depth
  weightKg: number;
  note?: string;
}

const FPS = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 100, 119.88, 120, 180, 240];
const H264_8: Codec = { name: 'H.264', format: 'MP4', bitDepths: ['8-bit'], chroma: ['4:2:0'] };
const H265_10: Codec = { name: 'H.265 (HEVC)', format: 'MP4', bitDepths: ['10-bit'], chroma: ['4:2:2', '4:2:0'] };

const shoe: PortSpec = ['Hot shoe', 'out', 'Cold shoe', 'mount'];
const base: PortSpec = ['Tripod socket', 'out', '1/4-20', 'mount'];
const mic35: PortSpec = ['Mic in', 'in', '3.5 mm TRS', 'audio'];
const phones: PortSpec = ['Headphones', 'out', '3.5 mm TRS', 'audio'];
const usbc: PortSpec = ['USB-C', 'out', 'USB-C', 'data'];

export const BODIES: CameraBody[] = [
  {
    id: 'canon-r50v', manufacturer: 'Canon', model: 'EOS R50 V', type: 'mirrorless', mount: 'RF', sensorId: 'canon-r50v',
    isoRange: [100, 32000], nativeIso: [100], usesEI: false,
    resolutions: [{ label: '3840 × 2160 (4K UHD)', maxFps: 60 }, { label: '1920 × 1080 (Full HD)', maxFps: 120 }], fpsOptions: FPS,
    codecs: [H264_8, H265_10], profiles: ['standard', 'neutral', 'clog3', 'hlg'], colourSpaces: ['BT.709', 'Cinema Gamut', 'BT.2020'],
    stabilisation: ['Off', 'Movie digital IS: on', 'Movie digital IS: enhanced'], battery: 'LP-E17', volts: [7.0, 8.4],
    ports: [['HDMI out', 'out', 'Micro HDMI', 'video'], mic35, phones, usbc, shoe, base], size: [119, 74, 46], weightKg: 0.37,
    note: 'Check ports against your body; Canon lists micro HDMI, mic, headphone and USB-C.',
  },
  {
    id: 'canon-r5', manufacturer: 'Canon', model: 'EOS R5', type: 'mirrorless', mount: 'RF', sensorId: 'full-frame',
    isoRange: [100, 51200], nativeIso: [100], usesEI: false,
    resolutions: [{ label: '8192 × 4320 (8K DCI)', maxFps: 30 }, { label: '4096 × 2160 (4K DCI)', maxFps: 120 }, { label: '3840 × 2160 (4K UHD)', maxFps: 120 }, { label: '1920 × 1080 (Full HD)', maxFps: 60 }], fpsOptions: FPS,
    codecs: [{ name: 'Canon RAW', format: 'CRM', bitDepths: ['12-bit'], chroma: ['RAW'] }, { name: 'ALL-I H.265', format: 'MP4', bitDepths: ['10-bit'], chroma: ['4:2:2'] }, H265_10, H264_8],
    profiles: ['standard', 'neutral', 'clog3', 'hlg'], colourSpaces: ['BT.709', 'Cinema Gamut', 'BT.2020'], stabilisation: ['Off', 'IBIS', 'IBIS + digital IS'],
    battery: 'LP-E6NH', volts: [7.0, 8.4], ports: [['HDMI out', 'out', 'Micro HDMI', 'video'], mic35, phones, usbc, shoe, base], size: [138, 98, 88], weightKg: 0.74,
  },
  {
    id: 'canon-c70', manufacturer: 'Canon', model: 'EOS C70', type: 'cinema', mount: 'RF', sensorId: 'c70-s35',
    isoRange: [160, 25600], nativeIso: [800, 3200], usesEI: false,
    resolutions: [{ label: '4096 × 2160 (4K DCI)', maxFps: 120 }, { label: '3840 × 2160 (4K UHD)', maxFps: 120 }, { label: '1920 × 1080 (Full HD)', maxFps: 180 }], fpsOptions: FPS,
    codecs: [{ name: 'XF-AVC Intra', format: 'MXF', bitDepths: ['10-bit'], chroma: ['4:2:2'] }, { name: 'XF-HEVC', format: 'MP4', bitDepths: ['10-bit'], chroma: ['4:2:2', '4:2:0'] }, { name: 'Cinema RAW Light', format: 'CRM', bitDepths: ['12-bit'], chroma: ['RAW'] }],
    profiles: ['standard', 'clog2', 'clog3', 'hlg'], colourSpaces: ['BT.709', 'Cinema Gamut', 'BT.2020'], stabilisation: ['Off', 'Electronic IS', 'Coordinated IS'],
    battery: 'BP-A', volts: [14.0, 16.8],
    ports: [['HDMI out', 'out', 'HDMI', 'video'], ['Mini XLR in 1', 'in', 'Mini XLR', 'audio', { phantom: true }], ['Mini XLR in 2', 'in', 'Mini XLR', 'audio', { phantom: true }], mic35, phones, ['Timecode in/out', 'in', 'BNC timecode', 'timecode'], ['DC in', 'in', 'DC barrel', 'power', { vMin: 11, vMax: 20 }], usbc, shoe, base],
    size: [160, 130, 116], weightKg: 1.17,
  },
  {
    id: 'sony-fx3', manufacturer: 'Sony', model: 'FX3', type: 'cinema', mount: 'E', sensorId: 'full-frame',
    isoRange: [80, 102400], nativeIso: [800, 12800], usesEI: false,
    resolutions: [{ label: '3840 × 2160 (4K UHD)', maxFps: 120 }, { label: '1920 × 1080 (Full HD)', maxFps: 240 }], fpsOptions: FPS,
    codecs: [{ name: 'XAVC S', format: 'MP4', bitDepths: ['8-bit', '10-bit'], chroma: ['4:2:0', '4:2:2'] }, { name: 'XAVC S-I', format: 'MP4', bitDepths: ['10-bit'], chroma: ['4:2:2'] }, { name: 'XAVC HS', format: 'MP4', bitDepths: ['10-bit'], chroma: ['4:2:0', '4:2:2'] }],
    profiles: ['standard', 'cinetone', 'slog3', 'hlg'], colourSpaces: ['BT.709', 'S-Gamut3.Cine', 'S-Gamut3', 'BT.2020'], stabilisation: ['Off', 'Standard', 'Active', 'Dynamic Active'],
    battery: 'NP-FZ100', volts: [7.0, 8.4], ports: [['HDMI out', 'out', 'HDMI', 'video'], mic35, phones, usbc, ['Multi interface shoe', 'out', 'Cold shoe', 'mount'], base], size: [130, 78, 85], weightKg: 0.64,
  },
  {
    id: 'sony-a7s3', manufacturer: 'Sony', model: 'Alpha 7S III', type: 'mirrorless', mount: 'E', sensorId: 'full-frame',
    isoRange: [80, 102400], nativeIso: [640, 12800], usesEI: false,
    resolutions: [{ label: '3840 × 2160 (4K UHD)', maxFps: 120 }, { label: '1920 × 1080 (Full HD)', maxFps: 240 }], fpsOptions: FPS,
    codecs: [{ name: 'XAVC S', format: 'MP4', bitDepths: ['8-bit', '10-bit'], chroma: ['4:2:0', '4:2:2'] }, { name: 'XAVC S-I', format: 'MP4', bitDepths: ['10-bit'], chroma: ['4:2:2'] }, { name: 'XAVC HS', format: 'MP4', bitDepths: ['10-bit'], chroma: ['4:2:0', '4:2:2'] }],
    profiles: ['standard', 'cinetone', 'slog3', 'hlg'], colourSpaces: ['BT.709', 'S-Gamut3.Cine', 'S-Gamut3', 'BT.2020'], stabilisation: ['Off', 'Standard', 'Active'],
    battery: 'NP-FZ100', volts: [7.0, 8.4], ports: [['HDMI out', 'out', 'HDMI', 'video'], mic35, phones, usbc, ['Multi interface shoe', 'out', 'Cold shoe', 'mount'], base], size: [129, 97, 81], weightKg: 0.7,
  },
  {
    id: 'pana-s5ii', manufacturer: 'Panasonic', model: 'Lumix S5 II', type: 'mirrorless', mount: 'L', sensorId: 'full-frame',
    isoRange: [100, 51200], nativeIso: [640, 4000], usesEI: false,
    resolutions: [{ label: '5952 × 3968 (6K open gate)', maxFps: 30 }, { label: '4096 × 2160 (C4K)', maxFps: 60 }, { label: '3840 × 2160 (4K UHD)', maxFps: 60 }, { label: '1920 × 1080 (Full HD)', maxFps: 180 }], fpsOptions: FPS,
    codecs: [H264_8, H265_10, { name: 'ALL-I', format: 'MOV', bitDepths: ['10-bit'], chroma: ['4:2:2'] }],
    profiles: ['standard', 'cinelike-d2', 'vlog', 'hlg'], colourSpaces: ['BT.709', 'V-Gamut', 'BT.2020'], stabilisation: ['Off', 'Body IS', 'Boost IS', 'Active IS'],
    battery: 'DMW-BLK22', volts: [7.0, 8.4], ports: [['HDMI out', 'out', 'HDMI', 'video'], mic35, phones, usbc, shoe, base], size: [134, 102, 90], weightKg: 0.74,
  },
  {
    id: 'fuji-xh2s', manufacturer: 'Fujifilm', model: 'X-H2S', type: 'mirrorless', mount: 'X', sensorId: 'fuji-apsc',
    isoRange: [160, 12800], nativeIso: [1250], usesEI: false,
    resolutions: [{ label: '6240 × 4160 (6.2K)', maxFps: 30 }, { label: '4096 × 2160 (DCI 4K)', maxFps: 120 }, { label: '3840 × 2160 (4K UHD)', maxFps: 120 }, { label: '1920 × 1080 (Full HD)', maxFps: 240 }], fpsOptions: FPS,
    codecs: [{ name: 'Apple ProRes 422 HQ', format: 'MOV', bitDepths: ['10-bit'], chroma: ['4:2:2'] }, H265_10, H264_8],
    profiles: ['standard', 'eterna', 'flog2', 'hlg'], colourSpaces: ['BT.709', 'F-Gamut', 'BT.2020'], stabilisation: ['Off', 'IBIS', 'IBIS + digital IS'],
    battery: 'NP-W235', volts: [7.0, 8.4], ports: [['HDMI out', 'out', 'HDMI', 'video'], mic35, phones, usbc, shoe, base], size: [136, 93, 85], weightKg: 0.66,
  },
  {
    id: 'bmpcc4k', manufacturer: 'Blackmagic', model: 'Pocket Cinema Camera 4K', type: 'cinema', mount: 'MFT', sensorId: 'bmd-mft',
    isoRange: [100, 25600], nativeIso: [400, 3200], usesEI: false,
    resolutions: [{ label: '4096 × 2160 (4K DCI)', maxFps: 60 }, { label: '3840 × 2160 (4K UHD)', maxFps: 60 }, { label: '1920 × 1080 (HD windowed)', maxFps: 120 }], fpsOptions: FPS,
    codecs: [{ name: 'Blackmagic RAW', format: 'BRAW', bitDepths: ['12-bit'], chroma: ['RAW'] }, { name: 'ProRes 422 HQ', format: 'MOV', bitDepths: ['10-bit'], chroma: ['4:2:2'] }, { name: 'ProRes 422 LT', format: 'MOV', bitDepths: ['10-bit'], chroma: ['4:2:2'] }],
    profiles: ['video', 'extended-video', 'bmd-film'], colourSpaces: ['Rec.709', 'Blackmagic Wide Gamut'], stabilisation: ['Off (lens IS only)'],
    battery: 'LP-E6', volts: [6.5, 8.4],
    ports: [['HDMI out', 'out', 'HDMI', 'video'], ['Mini XLR in', 'in', 'Mini XLR', 'audio', { phantom: true }], mic35, phones, ['DC in', 'in', 'DC barrel', 'power', { vMin: 12, vMax: 20 }], usbc, base],
    size: [179, 84, 109], weightKg: 0.72,
  },
  {
    id: 'bmpcc6kpro', manufacturer: 'Blackmagic', model: 'Pocket Cinema Camera 6K Pro', type: 'cinema', mount: 'EF', sensorId: 'bmd-s35',
    isoRange: [100, 25600], nativeIso: [400, 3200], usesEI: false,
    resolutions: [{ label: '6144 × 3456 (6K)', maxFps: 50 }, { label: '4096 × 2160 (4K DCI)', maxFps: 60 }, { label: '1920 × 1080 (HD)', maxFps: 120 }], fpsOptions: FPS,
    codecs: [{ name: 'Blackmagic RAW', format: 'BRAW', bitDepths: ['12-bit'], chroma: ['RAW'] }, { name: 'ProRes 422 HQ', format: 'MOV', bitDepths: ['10-bit'], chroma: ['4:2:2'] }],
    profiles: ['video', 'extended-video', 'bmd-film'], colourSpaces: ['Rec.709', 'Blackmagic Wide Gamut'], stabilisation: ['Off (lens IS only)'],
    battery: 'NP-F', volts: [6.5, 8.4],
    ports: [['HDMI out', 'out', 'HDMI', 'video'], ['Mini XLR in 1', 'in', 'Mini XLR', 'audio', { phantom: true }], ['Mini XLR in 2', 'in', 'Mini XLR', 'audio', { phantom: true }], mic35, phones, ['DC in', 'in', 'DC barrel', 'power', { vMin: 12, vMax: 20 }], usbc, base],
    size: [178, 94, 127], weightKg: 1.24,
  },
  {
    id: 'canon-5d4', manufacturer: 'Canon', model: 'EOS 5D Mark IV', type: 'dslr', mount: 'EF', sensorId: 'full-frame',
    isoRange: [100, 25600], nativeIso: [100], usesEI: false,
    resolutions: [{ label: '4096 × 2160 (4K DCI, cropped)', maxFps: 30 }, { label: '1920 × 1080 (Full HD)', maxFps: 60 }, { label: '1280 × 720 (HD)', maxFps: 120 }], fpsOptions: FPS,
    codecs: [{ name: 'Motion JPEG', format: 'MOV', bitDepths: ['8-bit'], chroma: ['4:2:2'] }, { name: 'H.264 ALL-I', format: 'MOV', bitDepths: ['8-bit'], chroma: ['4:2:0'] }],
    profiles: ['standard', 'neutral', 'clog'], colourSpaces: ['BT.709'], stabilisation: ['Off', 'Movie digital IS'],
    battery: 'LP-E6N', volts: [7.0, 8.4], ports: [['HDMI out', 'out', 'Mini HDMI', 'video'], mic35, phones, usbc, shoe, base], size: [151, 116, 76], weightKg: 0.89,
    note: 'Canon Log needs the paid C-Log upgrade on this body.',
  },
  {
    id: 'generic-mirrorless', manufacturer: 'Generic', model: 'Mirrorless camera', type: 'mirrorless', mount: 'E', sensorId: 'full-frame',
    isoRange: [100, 51200], nativeIso: [100], usesEI: false, resolutions: [{ label: '3840 × 2160 (4K UHD)', maxFps: 60 }, { label: '1920 × 1080 (Full HD)', maxFps: 120 }], fpsOptions: FPS,
    codecs: [H264_8, H265_10], profiles: ['standard', 'neutral', 'hlg'], colourSpaces: ['BT.709'], stabilisation: ['Off', 'On'], battery: 'Camera battery', volts: [7.0, 8.4],
    ports: [['HDMI out', 'out', 'HDMI', 'video'], mic35, phones, usbc, shoe, base], size: [128, 90, 75], weightKg: 0.65,
  },
  {
    id: 'generic-dslr', manufacturer: 'Generic', model: 'DSLR', type: 'dslr', mount: 'EF', sensorId: 'canon-r50v',
    isoRange: [100, 25600], nativeIso: [100], usesEI: false, resolutions: [{ label: '1920 × 1080 (Full HD)', maxFps: 60 }], fpsOptions: FPS,
    codecs: [H264_8], profiles: ['standard', 'neutral'], colourSpaces: ['BT.709'], stabilisation: ['Off'], battery: 'Camera battery', volts: [7.0, 8.4],
    ports: [['HDMI out', 'out', 'Mini HDMI', 'video'], mic35, usbc, shoe, base], size: [131, 101, 76], weightKg: 0.7,
  },
  {
    id: 'generic-cinema', manufacturer: 'Generic', model: 'Cinema camera', type: 'cinema', mount: 'PL', sensorId: 'super35',
    isoRange: [200, 3200], nativeIso: [800], usesEI: true, resolutions: [{ label: '4096 × 2160 (4K DCI)', maxFps: 60 }, { label: '1920 × 1080 (HD)', maxFps: 120 }], fpsOptions: FPS,
    codecs: [{ name: 'ProRes 4444', format: 'MOV', bitDepths: ['12-bit'], chroma: ['4:4:4'] }, { name: 'ProRes 422 HQ', format: 'MOV', bitDepths: ['10-bit'], chroma: ['4:2:2'] }],
    profiles: ['video', 'bmd-film'], colourSpaces: ['Rec.709', 'Wide gamut'], stabilisation: ['Off'], battery: 'V-mount', volts: [11, 34],
    ports: [['SDI out', 'out', 'SDI', 'video'], ['HDMI out', 'out', 'HDMI', 'video'], ['XLR in 1', 'in', 'XLR', 'audio', { phantom: true }], ['XLR in 2', 'in', 'XLR', 'audio', { phantom: true }], ['Timecode in', 'in', 'BNC timecode', 'timecode'], ['D-tap in', 'in', 'D-tap', 'power', { vMin: 11, vMax: 34 }], phones, base],
    size: [150, 140, 200], weightKg: 2.5,
  },
];

export function body(id: string): CameraBody {
  return BODIES.find((b) => b.id === id) ?? BODIES.find((b) => b.id === 'generic-mirrorless')!;
}

/** Guess a body from an older gear item's model name, so earlier projects pick up full settings. */
export function guessBody(model: string): CameraBody {
  const m = model.toLowerCase();
  return BODIES.find((b) => m.includes(b.model.toLowerCase())) ?? (m.includes('cinema') ? body('generic-cinema') : body('generic-mirrorless'));
}
