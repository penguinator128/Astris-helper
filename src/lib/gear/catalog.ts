import type { Connector, DiagramObject, GearCategory, GearItem, GearPort, GearSpec, LensFormat, LensSpec, SignalKind } from '@/types/project';
import { isFurniture } from '@/lib/scene/pose';
import { BODIES, body as bodyById, type CameraBody, type PortSpec as BodyPortSpec } from '@/lib/camera/bodies';
import { LENSES, ADAPTERS, type AdapterInfo, type LensDef } from '@/lib/camera/lenses';
import { defaultConfig } from '@/lib/camera/settings';
import { uid } from '@/lib/id';

export type PlanLayer = 'camera' | 'lighting' | 'audio' | 'base';
export type PlanView = 'all' | PlanLayer;

export const PLAN_VIEWS: { id: PlanView; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'camera', label: 'Camera' },
  { id: 'lighting', label: 'Lighting' },
  { id: 'audio', label: 'Audio' },
  { id: 'base', label: 'Base' },
];

export const CATEGORIES: { id: GearCategory; label: string; layer: PlanLayer; code: string }[] = [
  { id: 'camera', label: 'Cameras', layer: 'camera', code: 'CAM' },
  { id: 'lens', label: 'Lenses', layer: 'camera', code: 'LNS' },
  { id: 'adapter', label: 'Lens adapters', layer: 'camera', code: 'ADP' },
  { id: 'rigging', label: 'Rigging', layer: 'camera', code: 'RIG' },
  { id: 'filter', label: 'Filters', layer: 'camera', code: 'FLT' },
  { id: 'support', label: 'Tripods and gimbals', layer: 'camera', code: 'SUP' },
  { id: 'monitor', label: 'Monitors', layer: 'camera', code: 'MON' },
  { id: 'mic', label: 'Microphones', layer: 'audio', code: 'MIC' },
  { id: 'wireless', label: 'Wireless audio', layer: 'audio', code: 'RF' },
  { id: 'recorder', label: 'Recorders', layer: 'audio', code: 'REC' },
  { id: 'audio-acc', label: 'Audio accessories', layer: 'audio', code: 'AUD' },
  { id: 'light', label: 'Lights', layer: 'lighting', code: 'LGT' },
  { id: 'grip', label: 'Grip and support', layer: 'lighting', code: 'GRP' },
  { id: 'battery', label: 'Batteries', layer: 'base', code: 'BAT' },
  { id: 'power', label: 'Power', layer: 'base', code: 'PWR' },
  { id: 'cable', label: 'Cables', layer: 'base', code: 'CBL' },
  { id: 'media', label: 'Media and data', layer: 'base', code: 'MED' },
  { id: 'other', label: 'Other', layer: 'base', code: 'OTH' },
];

export function categoryInfo(id: GearCategory) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

export const CONNECTORS: Connector[] = ['XLR', 'Mini XLR', '3.5 mm TRS', '3.5 mm TRRS', '6.35 mm TRS', 'HDMI', 'Micro HDMI', 'Mini HDMI', 'SDI', 'USB-C', 'BNC timecode', 'Wireless', 'Shoe', 'Mains', 'DC barrel', 'D-tap', 'Battery plate', 'Lens mount', 'Filter thread', 'Filter tray', 'NATO', 'Cold shoe', '1/4-20', '15 mm rods', 'Focus ring', 'Mic mount', 'Other'];

/** Physical mounting points: these join directly, with no cable. */
export const MECHANICAL = new Set<string>(['Shoe', 'Battery plate', 'Lens mount', 'Filter thread', 'Filter tray', 'NATO', 'Cold shoe', '1/4-20', '15 mm rods', 'Focus ring', 'Mic mount']);
export const SIGNALS: { id: SignalKind; label: string }[] = [
  { id: 'audio', label: 'Audio' },
  { id: 'video', label: 'Video' },
  { id: 'timecode', label: 'Timecode' },
  { id: 'power', label: 'Power' },
  { id: 'data', label: 'Data' },
  { id: 'mount', label: 'Mounting' },
];

/** Which plan layer an object belongs to. Talent, walls and marks show in every view. */
export function layerOf(o: DiagramObject): PlanLayer | 'set' {
  switch (o.type) {
    case 'camera':
      return 'camera';
    case 'light':
      return 'lighting';
    case 'gear':
      return categoryInfo(o.category).layer;
    case 'zone':
      return isFurniture(o.zoneKind) ? 'set' : 'base';
    default:
      return 'set';
  }
}

export function inView(o: DiagramObject, view: PlanView): boolean {
  const l = layerOf(o);
  return view === 'all' || l === 'set' || l === view;
}

type PortSpec = BodyPortSpec;

export interface GearTemplate {
  id: string;
  category: GearCategory;
  name: string;
  power: string;
  ports: PortSpec[];
  note?: string;
  rigKind?: string;
  weightKg?: number;
  payloadKg?: number;
  specs?: GearSpec[];
  bodyId?: string;
  lensId?: string;
  /** A described body (not in the database). */
  body?: CameraBody;
  lensSpec?: LensSpec;
}

const T = (id: string, category: GearCategory, name: string, rigKind: string, ports: PortSpec[], extra: Partial<GearTemplate> = {}): GearTemplate => ({ id, category, name, power: '', ports, rigKind, ...extra });
const BAT = (id: string, name: string, std: string, volts: number, wh: number, kg: number): GearTemplate =>
  T(id, 'battery', name, std === 'V-mount' ? 'battery-vmount' : 'battery', [['Battery', 'out', 'Battery plate', 'power', { standard: std, vOut: volts }], ...(std === 'V-mount' ? ([['D-tap out', 'out', 'D-tap', 'power', { vOut: volts }]] as PortSpec[]) : [])], { weightKg: kg, specs: [{ label: 'Voltage', value: `${volts} V` }, { label: 'Capacity', value: `${wh} Wh` }] });

/** A gear template for any camera body, from the database or described by you, with its lens mount and battery slot. */
export function bodyTemplate(b: CameraBody): GearTemplate {
  return {
  id: `body-${b.id}`,
  category: 'camera',
  name: b.manufacturer === 'Generic' ? b.model : `${b.manufacturer} ${b.model}`,
  power: b.battery,
  rigKind: `body-${b.type}`,
  bodyId: b.id,
  weightKg: b.weightKg,
  note: b.note,
  ports: [['Lens mount', 'out', 'Lens mount', 'mount', { standard: b.mount }], ['Battery', 'in', 'Battery plate', 'power', { standard: b.battery, vMin: b.volts[0], vMax: b.volts[1] }], ...b.ports],
  specs: [
    { label: 'Mount', value: b.mount },
    { label: 'Battery', value: b.battery },
    { label: 'Weight', value: `${b.weightKg} kg` },
  ],
  body: b.custom ? b : undefined,
  };
}

const BODY_TEMPLATES: GearTemplate[] = BODIES.map(bodyTemplate);

/** Adapter gear for a lens mount on a camera mount (named or generic). */
export function adapterTemplate(a: AdapterInfo): GearTemplate {
  return T(`adapter-${a.id}`, 'adapter', a.name, 'adapter', [['Camera side', 'in', 'Lens mount', 'mount', { standard: a.cameraMount }], ['Lens side', 'out', 'Lens mount', 'mount', { standard: a.lensMount }]], { note: a.note, weightKg: a.focalFactor !== 1 ? 0.2 : 0.12, specs: [{ label: 'Fits camera', value: a.cameraMount }, { label: 'Takes lens', value: a.lensMount }] });
}

/** A lens template from any lens description. */
export function lensTemplate(l: LensSpec & { id?: string }): GearTemplate {
  const prime = l.focalMin === l.focalMax;
  return {
    id: `lens-${l.id ?? 'custom'}`,
    category: 'lens',
    name: `${l.manufacturer} ${l.model}`.trim(),
    power: '',
    rigKind: 'lens',
    weightKg: l.weightKg,
    ports: [['Mount', 'in', 'Lens mount', 'mount', { standard: l.mount }], ...(l.filterThread ? ([['Filter thread', 'out', 'Filter thread', 'mount', { standard: `${l.filterThread} mm` }]] as PortSpec[]) : []), ['Focus ring', 'out', 'Focus ring', 'mount']],
    specs: [
      { label: 'Mount', value: l.mount },
      { label: 'Focal length', value: prime ? `${l.focalMin} mm` : `${l.focalMin}–${l.focalMax} mm` },
      { label: 'Widest aperture', value: l.maxAperture === l.maxApertureTele ? `f/${l.maxAperture}` : `f/${l.maxAperture}–${l.maxApertureTele}` },
      { label: 'Filter thread', value: l.filterThread ? `${l.filterThread} mm` : 'None' },
      { label: 'Close focus', value: `${l.minFocus} m` },
    ],
    lensSpec: { manufacturer: l.manufacturer, model: l.model, mount: l.mount, focalMin: l.focalMin, focalMax: l.focalMax, maxAperture: l.maxAperture, maxApertureTele: l.maxApertureTele, minAperture: l.minAperture, minFocus: l.minFocus, filterThread: l.filterThread, format: l.format, length: l.length, diameter: l.diameter, weightKg: l.weightKg },
  };
}

/** Format a database lens was made for, from its mount and name. */
function formatOf(l: LensDef): LensFormat {
  if (l.mount === 'MFT') return 'mft';
  if (l.mount === 'X' || /RF-S|EF-S|\bDC\b|\bDT\b/.test(l.model)) return 'aps-c';
  return 'full-frame';
}

const LENS_TEMPLATES: GearTemplate[] = LENSES.map((l) => lensTemplate({ ...l, format: formatOf(l), length: l.length, diameter: l.diameter, weightKg: l.weightKg }));

const ADAPTER_TEMPLATES: GearTemplate[] = ADAPTERS.map(adapterTemplate);

const RIG_TEMPLATES: GearTemplate[] = [
  T('cage', 'rigging', 'Camera cage', 'cage', [['Camera screw', 'in', '1/4-20', 'mount'], ['Top cold shoe', 'out', 'Cold shoe', 'mount'], ['Side cold shoe', 'out', 'Cold shoe', 'mount'], ['NATO rail (top)', 'out', 'NATO', 'mount'], ['NATO rail (left)', 'out', 'NATO', 'mount'], ['Top 1/4-20', 'out', '1/4-20', 'mount'], ['Side 1/4-20', 'out', '1/4-20', 'mount'], ['Base 1/4-20', 'out', '1/4-20', 'mount']], { weightKg: 0.25, specs: [{ label: 'Fits', value: 'Body-specific; check your model' }] }),
  T('top-handle', 'rigging', 'Top handle (NATO)', 'top-handle', [['NATO clamp', 'in', 'NATO', 'mount'], ['Cold shoe', 'out', 'Cold shoe', 'mount'], ['1/4-20 front', 'out', '1/4-20', 'mount']], { weightKg: 0.15 }),
  T('side-handle', 'rigging', 'Side handle (NATO)', 'side-handle', [['NATO clamp', 'in', 'NATO', 'mount']], { weightKg: 0.18 }),
  T('nato-rail', 'rigging', 'NATO rail', 'nato-rail', [['Screw', 'in', '1/4-20', 'mount'], ['Rail', 'out', 'NATO', 'mount']], { weightKg: 0.03 }),
  T('arm', 'rigging', 'Articulating arm', 'arm', [['Base', 'in', '1/4-20', 'mount'], ['Head', 'out', '1/4-20', 'mount']], { weightKg: 0.1, specs: [{ label: 'Length', value: '7 in' }] }),
  T('rod-plate', 'rigging', '15 mm baseplate and rods', 'rod-plate', [['Screw', 'in', '1/4-20', 'mount'], ['Rods (left)', 'out', '15 mm rods', 'mount'], ['Rods (right)', 'out', '15 mm rods', 'mount'], ['Rods (rear)', 'out', '15 mm rods', 'mount'], ['Base 1/4-20', 'out', '1/4-20', 'mount']], { weightKg: 0.35, specs: [{ label: 'Rods', value: '15 mm LWS' }] }),
  T('follow-focus', 'rigging', 'Follow focus', 'follow-focus', [['Rod clamp', 'in', '15 mm rods', 'mount'], ['Gear', 'in', 'Focus ring', 'mount']], { weightKg: 0.3, specs: [{ label: 'Gear pitch', value: '0.8 MOD (fit a lens gear ring to photo lenses)' }] }),
  T('matte-box', 'rigging', 'Matte box (rod mounted)', 'matte-box', [['Rod clamp', 'in', '15 mm rods', 'mount'], ['Filter tray 1', 'out', 'Filter tray', 'mount', { standard: '4 × 5.65' }], ['Filter tray 2', 'out', 'Filter tray', 'mount', { standard: '4 × 5.65' }]], { weightKg: 0.45 }),
  T('vnd-82', 'filter', 'Variable ND 2–5 stop (82 mm)', 'filter', [['Thread', 'in', 'Filter thread', 'mount', { standard: '82 mm' }]], { weightKg: 0.06, note: 'Change the thread size to match your lens, or use a step-up ring.' }),
  T('vnd-77', 'filter', 'Variable ND 2–5 stop (77 mm)', 'filter', [['Thread', 'in', 'Filter thread', 'mount', { standard: '77 mm' }]], { weightKg: 0.05 }),
  T('vnd-67', 'filter', 'Variable ND 2–5 stop (67 mm)', 'filter', [['Thread', 'in', 'Filter thread', 'mount', { standard: '67 mm' }]], { weightKg: 0.04 }),
  T('mist-82', 'filter', 'Black mist 1/4 (82 mm)', 'filter', [['Thread', 'in', 'Filter thread', 'mount', { standard: '82 mm' }]], { weightKg: 0.04 }),
  T('nd-tray', 'filter', 'ND 0.6 (4 × 5.65)', 'filter-tray', [['Tray', 'in', 'Filter tray', 'mount', { standard: '4 × 5.65' }]], { weightKg: 0.06 }),
  T('tripod-fluid', 'support', 'Tripod with fluid head', 'tripod', [['Plate screw', 'in', '1/4-20', 'mount']], { weightKg: 3.2, payloadKg: 5, specs: [{ label: 'Payload', value: '5 kg' }] }),
  T('monopod', 'support', 'Monopod', 'monopod', [['Plate screw', 'in', '1/4-20', 'mount']], { weightKg: 1.1, payloadKg: 5 }),
  T('gimbal', 'support', 'Gimbal stabiliser', 'gimbal', [['Quick-release plate', 'in', '1/4-20', 'mount']], { power: 'Internal', weightKg: 1.3, payloadKg: 3, specs: [{ label: 'Payload', value: '3 kg' }] }),
  T('monitor-5', 'monitor', '5 in HDMI monitor', 'monitor', [['Mount', 'in', '1/4-20', 'mount'], ['HDMI in', 'in', 'HDMI', 'video'], ['HDMI loop out', 'out', 'HDMI', 'video'], ['Battery', 'in', 'Battery plate', 'power', { standard: 'NP-F', vMin: 6.2, vMax: 16.8 }]], { power: 'NP-F', weightKg: 0.3 }),
  T('monitor-7', 'monitor', '7 in SDI and HDMI monitor', 'monitor', [['Mount', 'in', '1/4-20', 'mount'], ['SDI in', 'in', 'SDI', 'video'], ['SDI out', 'out', 'SDI', 'video'], ['HDMI in', 'in', 'HDMI', 'video'], ['Battery', 'in', 'Battery plate', 'power', { standard: 'NP-F', vMin: 6.2, vMax: 16.8 }], ['DC in', 'in', 'DC barrel', 'power', { vMin: 7, vMax: 17 }]], { power: 'NP-F', weightKg: 0.45 }),
  T('vmount-plate', 'rigging', 'V-mount battery plate', 'vmount-plate', [['Rod clamp', 'in', '15 mm rods', 'mount'], ['Battery', 'in', 'Battery plate', 'power', { standard: 'V-mount', vMin: 12, vMax: 17 }], ['D-tap out 1', 'out', 'D-tap', 'power', { vOut: 14.4 }], ['D-tap out 2', 'out', 'D-tap', 'power', { vOut: 14.4 }]], { weightKg: 0.2 }),
  BAT('bat-lpe17', 'Canon LP-E17', 'LP-E17', 7.2, 7.5, 0.05),
  BAT('bat-lpe6nh', 'Canon LP-E6NH', 'LP-E6NH', 7.2, 16, 0.08),
  BAT('bat-lpe6', 'Canon LP-E6', 'LP-E6', 7.2, 13, 0.08),
  BAT('bat-lpe6n', 'Canon LP-E6N', 'LP-E6N', 7.2, 13, 0.08),
  BAT('bat-bpa30', 'Canon BP-A30', 'BP-A', 14.4, 45, 0.3),
  BAT('bat-npfz100', 'Sony NP-FZ100', 'NP-FZ100', 7.2, 16, 0.08),
  BAT('bat-npf970', 'NP-F970', 'NP-F', 7.2, 47, 0.3),
  BAT('bat-blk22', 'Panasonic DMW-BLK22', 'DMW-BLK22', 7.2, 16, 0.08),
  BAT('bat-npw235', 'Fujifilm NP-W235', 'NP-W235', 7.2, 16, 0.08),
  BAT('bat-vmount', 'V-mount battery 98 Wh', 'V-mount', 14.4, 98, 0.65),
  T('cable-hdmi', 'cable', 'HDMI cable', 'cable', []),
  T('cable-hdmi-micro', 'cable', 'HDMI to Micro HDMI cable', 'cable', []),
  T('cable-hdmi-mini', 'cable', 'HDMI to Mini HDMI cable', 'cable', []),
  T('cable-sdi', 'cable', 'SDI cable', 'cable', []),
  T('cable-xlr', 'cable', 'XLR cable', 'cable', []),
  T('cable-minixlr', 'cable', 'Mini XLR to XLR cable', 'cable', []),
  T('cable-trs', 'cable', '3.5 mm TRS cable', 'cable', []),
  T('cable-trs-xlr', 'cable', '3.5 mm TRS to XLR cable', 'cable', []),
  T('cable-dtap-dc', 'cable', 'D-tap to DC barrel cable', 'cable', []),
  T('cable-usbc', 'cable', 'USB-C cable', 'cable', []),
];

export const TEMPLATES: GearTemplate[] = [
  ...BODY_TEMPLATES,
  ...LENS_TEMPLATES,
  ...ADAPTER_TEMPLATES,
  ...RIG_TEMPLATES,
  { id: 'video-tx', category: 'monitor', name: 'Wireless video transmitter', power: 'NP-F', rigKind: 'video-tx', ports: [['HDMI in', 'in', 'HDMI', 'video'], ['Wireless out', 'out', 'Wireless', 'video', { standard: 'Video RF' }], ['Shoe mount', 'in', 'Cold shoe', 'mount'], ['Battery', 'in', 'Battery plate', 'power', { standard: 'NP-F', vMin: 6, vMax: 17 }]] },
  { id: 'video-rx', category: 'monitor', name: 'Wireless video receiver', power: 'NP-F', rigKind: 'video-rx', ports: [['Wireless in', 'in', 'Wireless', 'video', { standard: 'Video RF' }], ['HDMI out', 'out', 'HDMI', 'video'], ['Battery', 'in', 'Battery plate', 'power', { standard: 'NP-F', vMin: 6, vMax: 17 }]] },
  { id: 'shotgun', category: 'mic', name: 'Shotgun mic', power: 'Phantom 48 V', rigKind: 'mic-shotgun', weightKg: 0.13, ports: [['Output', 'out', 'XLR', 'audio', { phantom: true }], ['Shock mount', 'in', 'Mic mount', 'mount']] },
  { id: 'onboard', category: 'mic', name: 'On-camera mic', power: 'Internal', rigKind: 'mic-oncam', weightKg: 0.09, ports: [['Output', 'out', '3.5 mm TRS', 'audio'], ['Shoe mount', 'in', 'Cold shoe', 'mount']] },
  { id: 'lav', category: 'mic', name: 'Lavalier mic', power: 'Plug-in power', rigKind: 'mic-lav', ports: [['Output', 'out', '3.5 mm TRS', 'audio']] },
  { id: 'handheld', category: 'mic', name: 'Handheld mic (dynamic)', power: '', rigKind: 'mic-handheld', ports: [['Output', 'out', 'XLR', 'audio']] },
  { id: 'wl-tx', category: 'wireless', name: 'Wireless transmitter', power: 'Internal', rigKind: 'wireless-tx', ports: [['Mic in', 'in', '3.5 mm TRS', 'audio'], ['RF out', 'out', 'Wireless', 'audio', { standard: 'Audio RF' }]] },
  { id: 'wl-rx', category: 'wireless', name: 'Wireless receiver', power: 'Internal', rigKind: 'wireless-rx', weightKg: 0.06, ports: [['RF in', 'in', 'Wireless', 'audio', { standard: 'Audio RF' }], ['Audio out', 'out', '3.5 mm TRS', 'audio'], ['Shoe mount', 'in', 'Cold shoe', 'mount']] },
  { id: 'recorder-4', category: 'recorder', name: 'Field recorder (4 input)', power: 'AA', rigKind: 'recorder', ports: [['XLR in 1', 'in', 'XLR', 'audio', { phantom: true }], ['XLR in 2', 'in', 'XLR', 'audio', { phantom: true }], ['XLR in 3', 'in', 'XLR', 'audio', { phantom: true }], ['XLR in 4', 'in', 'XLR', 'audio', { phantom: true }], ['Headphones', 'out', '3.5 mm TRS', 'audio'], ['Line out', 'out', '3.5 mm TRS', 'audio'], ['Timecode out', 'out', 'BNC timecode', 'timecode']] },
  { id: 'recorder-2', category: 'recorder', name: 'Compact recorder (2 input)', power: 'AA', rigKind: 'recorder', ports: [['XLR in 1', 'in', 'XLR', 'audio', { phantom: true }], ['XLR in 2', 'in', 'XLR', 'audio', { phantom: true }], ['Mic in', 'in', '3.5 mm TRS', 'audio'], ['Headphones', 'out', '3.5 mm TRS', 'audio']] },
  { id: 'headphones', category: 'audio-acc', name: 'Headphones', power: '', rigKind: 'headphones', ports: [['Input', 'in', '3.5 mm TRS', 'audio']] },
  { id: 'boom', category: 'audio-acc', name: 'Boom pole', power: '', rigKind: 'boom', ports: [['Mic mount', 'out', 'Mic mount', 'mount']] },
  { id: 'tc-box', category: 'audio-acc', name: 'Timecode generator', power: 'Internal', ports: [['Timecode out', 'out', 'BNC timecode', 'timecode']] },
  { id: 'led-cob', category: 'light', name: 'LED COB light', power: 'Mains', ports: [['Power', 'in', 'Mains', 'power']] },
  { id: 'led-panel', category: 'light', name: 'LED panel', power: 'NP-F', ports: [['Battery', 'in', 'Battery plate', 'power', { standard: 'NP-F', vMin: 6.5, vMax: 8.4 }]] },
  { id: 'tube', category: 'light', name: 'RGB tube light', power: 'Internal', ports: [] },
  { id: 'pocket-led', category: 'light', name: 'Pocket LED', power: 'Internal', ports: [] },
  { id: 'softbox', category: 'grip', name: 'Softbox', power: '', ports: [] },
  { id: 'reflector', category: 'grip', name: '5-in-1 reflector', power: '', ports: [] },
  { id: 'slider', category: 'grip', name: 'Slider', power: '', ports: [] },
  { id: 'c-stand', category: 'grip', name: 'C-stand', power: '', ports: [] },

  { id: 'power-board', category: 'power', name: 'Power board', power: 'Mains', ports: [['Outlet 1', 'out', 'Mains', 'power'], ['Outlet 2', 'out', 'Mains', 'power'], ['Outlet 3', 'out', 'Mains', 'power'], ['Outlet 4', 'out', 'Mains', 'power']] },
  { id: 'power-station', category: 'power', name: 'Portable power station', power: 'Internal', ports: [['AC outlet 1', 'out', 'Mains', 'power'], ['AC outlet 2', 'out', 'Mains', 'power'], ['USB-C out', 'out', 'USB-C', 'power']] },
  { id: 'sd', category: 'media', name: 'SD card', power: '', ports: [] },
  { id: 'ssd', category: 'media', name: 'Backup SSD', power: '', ports: [['USB-C', 'in', 'USB-C', 'data']] },
  { id: 'laptop', category: 'media', name: 'Laptop', power: 'Internal', ports: [['USB-C', 'in', 'USB-C', 'data']] },
];

export function templatesFor(category: GearCategory) {
  return TEMPLATES.filter((t) => t.category === category);
}

export function gearFromTemplate(t: GearTemplate, nameOverride?: string): GearItem {
  const lensDb = t.lensId ? LENSES.find((l) => l.id === t.lensId) : undefined;
  return {
    id: uid(),
    category: t.category,
    name: nameOverride ?? t.name,
    model: t.name,
    qty: 1,
    power: t.power,
    ports: t.ports.map(([name, dir, connector, signal, extra]): GearPort => ({ id: uid(), name, dir, connector, signal, ...(extra ?? {}) })),
    notes: t.note ?? '',
    rigKind: t.rigKind,
    weightKg: t.weightKg,
    payloadKg: t.payloadKg,
    specs: t.specs,
    camera: t.body ? defaultConfig(t.body) : t.bodyId ? defaultConfig(bodyById(t.bodyId)) : undefined,
    lens: t.lensSpec ?? (lensDb ? { manufacturer: lensDb.manufacturer, model: lensDb.model, mount: lensDb.mount, focalMin: lensDb.focalMin, focalMax: lensDb.focalMax, maxAperture: lensDb.maxAperture, maxApertureTele: lensDb.maxApertureTele, minAperture: lensDb.minAperture, minFocus: lensDb.minFocus, filterThread: lensDb.filterThread } : undefined),
  };
}

export function blankGear(category: GearCategory): GearItem {
  return { id: uid(), category, name: `New ${categoryInfo(category).label.toLowerCase().replace(/s$/, '')}`, model: '', qty: 1, power: '', ports: [], notes: '' };
}

/** Cable needed to join two connectors, or null when no cable is needed (wireless, shoe mount). */
export function cableFor(a: string, b: string): string | null {
  if (a === 'Wireless' || b === 'Wireless') return null;
  if (MECHANICAL.has(a) || MECHANICAL.has(b)) return null;
  if (a === b) return `${a} cable`;
  const [x, y] = [a, b].sort();
  return `${x} to ${y} cable`;
}

/** Short, unique default names for a new item (A cam, B cam; Mic 1, Mic 2). */
export function nextName(existing: GearItem[], category: GearCategory, base: string): string {
  if (category === 'camera') return `${String.fromCharCode(65 + existing.filter((g) => g.category === 'camera').length)} cam · ${base}`;
  const same = existing.filter((g) => g.model === base).length;
  return same === 0 ? base : `${base} ${same + 1}`;
}

/** Connection lines between objects placed on one set-up. */
export function planLinks(objects: DiagramObject[], gear: GearItem[], connections: { fromGear: string; fromPort: string; toGear: string; toPort: string }[]) {
  const objFor = (gearId: string) => objects.find((o) => 'gearId' in o && o.gearId === gearId);
  const out: { from: string; to: string; signal: SignalKind; wireless: boolean }[] = [];
  for (const c of connections) {
    const a = objFor(c.fromGear);
    const b = objFor(c.toGear);
    if (!a || !b) continue;
    const port = gear.find((g) => g.id === c.fromGear)?.ports.find((p) => p.id === c.fromPort);
    const toPort = gear.find((g) => g.id === c.toGear)?.ports.find((p) => p.id === c.toPort);
    if (!port) continue;
    out.push({ from: a.id, to: b.id, signal: port.signal, wireless: port.connector === 'Wireless' || toPort?.connector === 'Wireless' });
  }
  return out;
}
