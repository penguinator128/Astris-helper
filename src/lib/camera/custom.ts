import type { BodyPortSpec, CameraBodySpec, CodecSpec, LensFormat, LensSpec } from '@/types/project';
import { SENSORS } from '@/lib/calc/sensors';
import { uid } from '@/lib/id';

export type BodyType = CameraBodySpec['type'];

export const BODY_TYPES: { id: BodyType; label: string }[] = [
  { id: 'mirrorless', label: 'Mirrorless' },
  { id: 'dslr', label: 'DSLR' },
  { id: 'cinema', label: 'Cinema camera' },
  { id: 'camcorder', label: 'Camcorder' },
  { id: 'action', label: 'Action camera' },
  { id: 'phone', label: 'Phone' },
];

export const RESOLUTIONS = ['8192 × 4320 (8K DCI)', '7680 × 4320 (8K UHD)', '6144 × 3240 (6K)', '4096 × 2160 (4K DCI)', '3840 × 2160 (4K UHD)', '2704 × 1520 (2.7K)', '1920 × 1080 (Full HD)', '1280 × 720 (HD)'];

export const CODECS: { id: string; codec: CodecSpec }[] = [
  { id: 'h264', codec: { name: 'H.264', format: 'MP4', bitDepths: ['8-bit'], chroma: ['4:2:0'] } },
  { id: 'h265', codec: { name: 'H.265 (HEVC)', format: 'MP4', bitDepths: ['10-bit', '8-bit'], chroma: ['4:2:2', '4:2:0'] } },
  { id: 'alli', codec: { name: 'All-Intra 10-bit', format: 'MP4', bitDepths: ['10-bit'], chroma: ['4:2:2'] } },
  { id: 'prores422', codec: { name: 'ProRes 422 HQ', format: 'MOV', bitDepths: ['10-bit'], chroma: ['4:2:2'] } },
  { id: 'prores4444', codec: { name: 'ProRes 4444', format: 'MOV', bitDepths: ['12-bit'], chroma: ['4:4:4'] } },
  { id: 'raw', codec: { name: 'RAW (BRAW, ProRes RAW, Cinema RAW and others)', format: 'RAW', bitDepths: ['12-bit'], chroma: ['RAW'] } },
];

/** Ports you can tick for a described camera. Count ports (XLR) take a number. */
export const PORT_OPTIONS: { id: string; label: string; spec: BodyPortSpec; count?: boolean }[] = [
  { id: 'hdmi', label: 'Full-size HDMI out', spec: ['HDMI out', 'out', 'HDMI', 'video'] },
  { id: 'microhdmi', label: 'Micro HDMI out', spec: ['HDMI out', 'out', 'Micro HDMI', 'video'] },
  { id: 'minihdmi', label: 'Mini HDMI out', spec: ['HDMI out', 'out', 'Mini HDMI', 'video'] },
  { id: 'sdi', label: 'SDI out', spec: ['SDI out', 'out', 'SDI', 'video'] },
  { id: 'mic', label: '3.5 mm mic in', spec: ['Mic in', 'in', '3.5 mm TRS', 'audio'] },
  { id: 'phones', label: 'Headphones out', spec: ['Headphones', 'out', '3.5 mm TRS', 'audio'] },
  { id: 'xlr', label: 'XLR inputs', spec: ['XLR in', 'in', 'XLR', 'audio', { phantom: true }], count: true },
  { id: 'miniXlr', label: 'Mini XLR inputs', spec: ['Mini XLR in', 'in', 'Mini XLR', 'audio', { phantom: true }], count: true },
  { id: 'usbc', label: 'USB-C', spec: ['USB-C', 'out', 'USB-C', 'data'] },
  { id: 'tc', label: 'Timecode in', spec: ['Timecode in', 'in', 'BNC timecode', 'timecode'] },
  { id: 'dc', label: 'DC power in', spec: ['DC in', 'in', 'DC barrel', 'power', { vMin: 12, vMax: 20 }] },
  { id: 'dtap', label: 'D-tap power in', spec: ['D-tap in', 'in', 'D-tap', 'power', { vMin: 11, vMax: 34 }] },
  { id: 'shoe', label: 'Hot or cold shoe', spec: ['Hot shoe', 'out', 'Cold shoe', 'mount'] },
  { id: 'base', label: 'Tripod socket (1/4-20)', spec: ['Tripod socket', 'out', '1/4-20', 'mount'] },
];

export interface BodyInput {
  manufacturer: string;
  model: string;
  type: BodyType;
  mount: string;
  sensorId: string; // a preset id, or 'custom'
  sensorW: number;
  sensorH: number;
  isoMin: number;
  isoMax: number;
  nativeIso: string; // "100" or "800, 3200"
  usesEI: boolean;
  topRes: string;
  topFps: number;
  hdFps: number;
  codecs: string[];
  profiles: string[];
  ibis: boolean;
  battery: string;
  voltsMin: number;
  voltsMax: number;
  ports: Record<string, number>;
  size: [number, number, number];
  weightKg: number;
}

const FPS = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 100, 119.88, 120, 180, 240];

/** Sensible starting values for each kind of camera; every one can be changed. */
export function startingInput(type: BodyType): BodyInput {
  const base: BodyInput = {
    manufacturer: '', model: '', type, mount: 'RF', sensorId: 'full-frame', sensorW: 36, sensorH: 24, isoMin: 100, isoMax: 25600, nativeIso: '100', usesEI: false,
    topRes: '3840 × 2160 (4K UHD)', topFps: 60, hdFps: 120, codecs: ['h264', 'h265'], profiles: ['standard', 'neutral', 'log-generic', 'hlg'], ibis: true,
    battery: 'Camera battery', voltsMin: 7, voltsMax: 8.4, ports: { microhdmi: 1, mic: 1, phones: 1, usbc: 1, shoe: 1, base: 1 }, size: [130, 90, 75], weightKg: 0.6,
  };
  switch (type) {
    case 'dslr':
      return { ...base, mount: 'EF', sensorId: 'canon-r50v', topRes: '3840 × 2160 (4K UHD)', topFps: 30, hdFps: 60, codecs: ['h264'], profiles: ['standard', 'neutral'], ibis: false, ports: { minihdmi: 1, mic: 1, usbc: 1, shoe: 1, base: 1 }, size: [140, 105, 78], weightKg: 0.8 };
    case 'cinema':
      return { ...base, mount: 'PL', sensorId: 'super35', sensorW: 24.89, sensorH: 18.66, isoMin: 200, isoMax: 12800, nativeIso: '800', usesEI: true, topRes: '4096 × 2160 (4K DCI)', topFps: 60, hdFps: 120, codecs: ['prores422', 'prores4444', 'raw'], profiles: ['video', 'log-generic', 'raw'], ibis: false, battery: 'V-mount', voltsMin: 11, voltsMax: 34, ports: { sdi: 1, hdmi: 1, xlr: 2, phones: 1, tc: 1, dtap: 1, base: 1 }, size: [150, 140, 190], weightKg: 2.2 };
    case 'camcorder':
      return { ...base, mount: 'Fixed', sensorId: 'one-inch', sensorW: 13.2, sensorH: 8.8, isoMin: 100, isoMax: 12800, ibis: true, battery: 'Camcorder battery', ports: { hdmi: 1, xlr: 2, phones: 1, usbc: 1, shoe: 1, base: 1 }, size: [180, 190, 330], weightKg: 1.9 };
    case 'action':
      return { ...base, mount: 'Fixed', sensorId: 'custom', sensorW: 7.6, sensorH: 5.7, isoMin: 100, isoMax: 6400, topRes: '3840 × 2160 (4K UHD)', topFps: 120, hdFps: 240, codecs: ['h264', 'h265'], profiles: ['standard', 'neutral', 'log-generic'], battery: 'Action camera battery', voltsMin: 3.6, voltsMax: 4.4, ports: { usbc: 1, base: 1 }, size: [71, 50, 34], weightKg: 0.15 };
    case 'phone':
      return { ...base, mount: 'Fixed', sensorId: 'custom', sensorW: 9.8, sensorH: 7.3, isoMin: 50, isoMax: 6400, topRes: '3840 × 2160 (4K UHD)', topFps: 60, hdFps: 240, codecs: ['h265', 'prores422'], profiles: ['standard', 'log-generic', 'hlg'], battery: 'Internal', voltsMin: 3.7, voltsMax: 4.4, ports: { usbc: 1 }, size: [72, 150, 8], weightKg: 0.2 };
    default:
      return base;
  }
}

/** Turn a filled-in form into a full body description. */
export function describeBody(i: BodyInput, id = `custom-${uid()}`): CameraBodySpec {
  const native = i.nativeIso.split(/[^0-9]+/).map(Number).filter((n) => n >= 25).sort((a, b) => a - b);
  const top = RESOLUTIONS.indexOf(i.topRes);
  const resolutions = RESOLUTIONS.slice(Math.max(0, top)).filter((r, k) => k === 0 || r.includes('Full HD') || r.includes('4K UHD') || r.includes('(HD)')).map((label) => ({ label, maxFps: label === i.topRes ? i.topFps : label.includes('Full HD') || label.includes('(HD)') ? Math.max(i.hdFps, i.topFps) : Math.max(i.topFps, Math.min(i.hdFps, 60)) }));
  const ports: BodyPortSpec[] = [];
  for (const o of PORT_OPTIONS) {
    const n = i.ports[o.id] ?? 0;
    if (!n) continue;
    if (o.count) for (let k = 1; k <= n; k++) ports.push([`${o.spec[0]} ${k}`, o.spec[1], o.spec[2], o.spec[3], o.spec[4]]);
    else ports.push(o.spec);
  }
  const preset = SENSORS.find((s) => s.id === i.sensorId);
  const codecs = CODECS.filter((c) => i.codecs.includes(c.id)).map((c) => c.codec);
  const profiles = i.profiles.length ? i.profiles : ['standard'];
  return {
    id,
    manufacturer: i.manufacturer.trim() || 'My',
    model: i.model.trim() || 'camera',
    type: i.type,
    mount: i.mount.trim() || 'Other',
    sensorId: preset ? preset.id : 'custom',
    sensor: preset ? undefined : { name: `${i.sensorW} × ${i.sensorH} mm`, width: i.sensorW, height: i.sensorH },
    isoRange: [Math.min(i.isoMin, i.isoMax), Math.max(i.isoMin, i.isoMax)],
    nativeIso: native.length ? native : [i.isoMin],
    usesEI: i.usesEI,
    resolutions: resolutions.length ? resolutions : [{ label: i.topRes, maxFps: i.topFps }],
    fpsOptions: FPS,
    codecs: codecs.length ? codecs : [CODECS[0].codec],
    profiles,
    colourSpaces: ['BT.709', ...(profiles.some((p) => p === 'hlg') ? ['BT.2020'] : []), ...(profiles.some((p) => p === 'log-generic' || p === 'raw') ? ['Native wide gamut'] : [])],
    stabilisation: i.ibis ? ['Off', 'In-body (IBIS)', 'In-body plus digital'] : ['Off', 'Lens IS only'],
    battery: i.battery.trim() || 'Camera battery',
    volts: [i.voltsMin, i.voltsMax],
    ports,
    size: i.size,
    weightKg: i.weightKg,
    custom: true,
  };
}

/** Back from a description to the form, for editing. */
export function inputFromBody(b: CameraBodySpec): BodyInput {
  const ports: Record<string, number> = {};
  for (const p of b.ports) {
    const o = PORT_OPTIONS.find((x) => x.spec[2] === p[2] && x.spec[1] === p[1] && (x.count ? p[0].startsWith(x.spec[0]) : x.spec[0] === p[0] || x.spec[2] === p[2]));
    if (o) ports[o.id] = o.count ? (ports[o.id] ?? 0) + 1 : 1;
  }
  const top = b.resolutions[0];
  const hd = b.resolutions.find((r) => r.label.includes('Full HD'));
  return {
    manufacturer: b.manufacturer,
    model: b.model,
    type: b.type,
    mount: b.mount,
    sensorId: b.sensor ? 'custom' : b.sensorId,
    sensorW: b.sensor?.width ?? SENSORS.find((s) => s.id === b.sensorId)?.width ?? 36,
    sensorH: b.sensor?.height ?? SENSORS.find((s) => s.id === b.sensorId)?.height ?? 24,
    isoMin: b.isoRange[0],
    isoMax: b.isoRange[1],
    nativeIso: b.nativeIso.join(', '),
    usesEI: b.usesEI,
    topRes: RESOLUTIONS.includes(top?.label) ? top.label : RESOLUTIONS[4],
    topFps: top?.maxFps ?? 30,
    hdFps: hd?.maxFps ?? top?.maxFps ?? 60,
    codecs: CODECS.filter((c) => b.codecs.some((k) => k.name === c.codec.name)).map((c) => c.id),
    profiles: b.profiles,
    ibis: b.stabilisation.some((x) => /in-body|ibis/i.test(x)),
    battery: b.battery,
    voltsMin: b.volts[0],
    voltsMax: b.volts[1],
    ports,
    size: b.size,
    weightKg: b.weightKg,
  };
}

export interface LensInput extends LensSpec {
  prime: boolean;
}

export function startingLens(mount: string): LensInput {
  return { manufacturer: '', model: '', mount, focalMin: 50, focalMax: 50, maxAperture: 1.8, maxApertureTele: 1.8, minAperture: 22, minFocus: 0.45, filterThread: 52, format: 'full-frame', length: 60, diameter: 70, weightKg: 0.25, prime: true };
}

export function describeLens(i: LensInput): LensSpec {
  const fMin = Math.max(1, Math.min(i.focalMin, i.focalMax));
  const fMax = i.prime ? fMin : Math.max(i.focalMin, i.focalMax);
  const wide = Math.max(0.7, i.maxAperture);
  return {
    manufacturer: i.manufacturer.trim(),
    model: i.model.trim() || `${fMin === fMax ? fMin : `${fMin}-${fMax}`}mm f/${wide}`,
    mount: i.mount.trim() || 'Other',
    focalMin: fMin,
    focalMax: fMax,
    maxAperture: wide,
    maxApertureTele: i.prime ? wide : Math.max(wide, i.maxApertureTele),
    minAperture: Math.max(wide, i.minAperture),
    minFocus: Math.max(0.01, i.minFocus),
    filterThread: Math.max(0, Math.round(i.filterThread)),
    format: i.format as LensFormat,
    length: i.length,
    diameter: i.diameter,
    weightKg: i.weightKg,
  };
}
