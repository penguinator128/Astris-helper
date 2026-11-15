import type { Connector, DiagramObject, GearCategory, GearItem, GearPort, SignalKind } from '@/types/project';
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
  { id: 'monitor', label: 'Monitors', layer: 'camera', code: 'MON' },
  { id: 'mic', label: 'Microphones', layer: 'audio', code: 'MIC' },
  { id: 'wireless', label: 'Wireless audio', layer: 'audio', code: 'RF' },
  { id: 'recorder', label: 'Recorders', layer: 'audio', code: 'REC' },
  { id: 'audio-acc', label: 'Audio accessories', layer: 'audio', code: 'AUD' },
  { id: 'light', label: 'Lights', layer: 'lighting', code: 'LGT' },
  { id: 'grip', label: 'Grip and support', layer: 'lighting', code: 'GRP' },
  { id: 'power', label: 'Power', layer: 'base', code: 'PWR' },
  { id: 'media', label: 'Media and data', layer: 'base', code: 'MED' },
  { id: 'other', label: 'Other', layer: 'base', code: 'OTH' },
];

export function categoryInfo(id: GearCategory) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

export const CONNECTORS: Connector[] = ['XLR', '3.5 mm TRS', '3.5 mm TRRS', '6.35 mm TRS', 'HDMI', 'Micro HDMI', 'Mini HDMI', 'SDI', 'USB-C', 'BNC timecode', 'Wireless', 'Shoe', 'Mains', 'DC barrel', 'D-tap', 'Other'];
export const SIGNALS: { id: SignalKind; label: string }[] = [
  { id: 'audio', label: 'Audio' },
  { id: 'video', label: 'Video' },
  { id: 'timecode', label: 'Timecode' },
  { id: 'power', label: 'Power' },
  { id: 'data', label: 'Data' },
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
      return 'base';
    default:
      return 'set';
  }
}

export function inView(o: DiagramObject, view: PlanView): boolean {
  const l = layerOf(o);
  return view === 'all' || l === 'set' || l === view;
}

type PortSpec = [name: string, dir: 'in' | 'out', connector: Connector, signal: SignalKind];

export interface GearTemplate {
  id: string;
  category: GearCategory;
  name: string;
  power: string;
  ports: PortSpec[];
  note?: string;
}

export const TEMPLATES: GearTemplate[] = [
  { id: 'canon-r50v', category: 'camera', name: 'Canon EOS R50 V', power: 'LP-E17', ports: [['Mic in', 'in', '3.5 mm TRS', 'audio'], ['Multi-function shoe', 'in', 'Shoe', 'audio'], ['HDMI out', 'out', 'Micro HDMI', 'video'], ['Headphones', 'out', '3.5 mm TRS', 'audio'], ['USB-C', 'out', 'USB-C', 'data']], note: 'Check ports against your body.' },
  { id: 'mirrorless', category: 'camera', name: 'Mirrorless camera', power: 'Camera battery', ports: [['Mic in', 'in', '3.5 mm TRS', 'audio'], ['HDMI out', 'out', 'HDMI', 'video'], ['Headphones', 'out', '3.5 mm TRS', 'audio'], ['USB-C', 'out', 'USB-C', 'data']] },
  { id: 'cinema', category: 'camera', name: 'Cinema camera', power: 'V-mount', ports: [['XLR in 1', 'in', 'XLR', 'audio'], ['XLR in 2', 'in', 'XLR', 'audio'], ['Timecode in', 'in', 'BNC timecode', 'timecode'], ['SDI out', 'out', 'SDI', 'video'], ['HDMI out', 'out', 'HDMI', 'video'], ['Headphones', 'out', '3.5 mm TRS', 'audio'], ['D-tap in', 'in', 'D-tap', 'power']] },
  { id: 'phone', category: 'camera', name: 'Phone camera', power: 'Internal', ports: [['USB-C audio in', 'in', 'USB-C', 'audio']] },
  { id: 'action', category: 'camera', name: 'Action camera', power: 'Internal', ports: [['USB-C', 'in', 'USB-C', 'audio']] },
  { id: 'lens', category: 'lens', name: 'Lens', power: '', ports: [] },
  { id: 'monitor', category: 'monitor', name: 'On-camera monitor', power: 'NP-F', ports: [['HDMI in', 'in', 'HDMI', 'video'], ['HDMI loop out', 'out', 'HDMI', 'video']] },
  { id: 'director-monitor', category: 'monitor', name: "Director's monitor", power: 'Mains', ports: [['HDMI in', 'in', 'HDMI', 'video'], ['SDI in', 'in', 'SDI', 'video'], ['Power', 'in', 'Mains', 'power']] },
  { id: 'video-tx', category: 'monitor', name: 'Wireless video transmitter', power: 'NP-F', ports: [['HDMI in', 'in', 'HDMI', 'video'], ['Wireless out', 'out', 'Wireless', 'video']] },
  { id: 'video-rx', category: 'monitor', name: 'Wireless video receiver', power: 'NP-F', ports: [['Wireless in', 'in', 'Wireless', 'video'], ['HDMI out', 'out', 'HDMI', 'video']] },
  { id: 'shotgun', category: 'mic', name: 'Shotgun mic', power: 'Phantom 48 V', ports: [['Output', 'out', 'XLR', 'audio']] },
  { id: 'onboard', category: 'mic', name: 'On-camera mic', power: 'Internal', ports: [['Output', 'out', '3.5 mm TRS', 'audio']] },
  { id: 'lav', category: 'mic', name: 'Lavalier mic', power: 'Plug-in power', ports: [['Output', 'out', '3.5 mm TRS', 'audio']] },
  { id: 'handheld', category: 'mic', name: 'Handheld mic', power: '', ports: [['Output', 'out', 'XLR', 'audio']] },
  { id: 'wl-tx', category: 'wireless', name: 'Wireless transmitter', power: 'Internal', ports: [['Mic in', 'in', '3.5 mm TRS', 'audio'], ['RF out', 'out', 'Wireless', 'audio']] },
  { id: 'wl-rx', category: 'wireless', name: 'Wireless receiver', power: 'Internal', ports: [['RF in', 'in', 'Wireless', 'audio'], ['Audio out', 'out', '3.5 mm TRS', 'audio']] },
  { id: 'recorder-4', category: 'recorder', name: 'Field recorder (4 input)', power: 'AA', ports: [['XLR in 1', 'in', 'XLR', 'audio'], ['XLR in 2', 'in', 'XLR', 'audio'], ['XLR in 3', 'in', 'XLR', 'audio'], ['XLR in 4', 'in', 'XLR', 'audio'], ['Headphones', 'out', '3.5 mm TRS', 'audio'], ['Line out', 'out', '3.5 mm TRS', 'audio'], ['Timecode out', 'out', 'BNC timecode', 'timecode']] },
  { id: 'recorder-2', category: 'recorder', name: 'Compact recorder (2 input)', power: 'AA', ports: [['XLR in 1', 'in', 'XLR', 'audio'], ['XLR in 2', 'in', 'XLR', 'audio'], ['Mic in', 'in', '3.5 mm TRS', 'audio'], ['Headphones', 'out', '3.5 mm TRS', 'audio']] },
  { id: 'headphones', category: 'audio-acc', name: 'Headphones', power: '', ports: [['Input', 'in', '3.5 mm TRS', 'audio']] },
  { id: 'boom', category: 'audio-acc', name: 'Boom pole', power: '', ports: [] },
  { id: 'tc-box', category: 'audio-acc', name: 'Timecode generator', power: 'Internal', ports: [['Timecode out', 'out', 'BNC timecode', 'timecode']] },
  { id: 'led-cob', category: 'light', name: 'LED COB light', power: 'Mains', ports: [['Power', 'in', 'Mains', 'power']] },
  { id: 'led-panel', category: 'light', name: 'LED panel', power: 'NP-F', ports: [] },
  { id: 'tube', category: 'light', name: 'RGB tube light', power: 'Internal', ports: [] },
  { id: 'pocket-led', category: 'light', name: 'Pocket LED', power: 'Internal', ports: [] },
  { id: 'softbox', category: 'grip', name: 'Softbox', power: '', ports: [] },
  { id: 'reflector', category: 'grip', name: '5-in-1 reflector', power: '', ports: [] },
  { id: 'tripod', category: 'grip', name: 'Tripod', power: '', ports: [] },
  { id: 'gimbal', category: 'grip', name: 'Gimbal', power: 'Internal', ports: [] },
  { id: 'slider', category: 'grip', name: 'Slider', power: '', ports: [] },
  { id: 'c-stand', category: 'grip', name: 'C-stand', power: '', ports: [] },
  { id: 'v-mount', category: 'power', name: 'V-mount battery', power: '', ports: [['D-tap out', 'out', 'D-tap', 'power']] },
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
  return {
    id: uid(),
    category: t.category,
    name: nameOverride ?? t.name,
    model: t.name,
    qty: 1,
    power: t.power,
    ports: t.ports.map(([name, dir, connector, signal]): GearPort => ({ id: uid(), name, dir, connector, signal })),
    notes: t.note ?? '',
  };
}

export function blankGear(category: GearCategory): GearItem {
  return { id: uid(), category, name: `New ${categoryInfo(category).label.toLowerCase().replace(/s$/, '')}`, model: '', qty: 1, power: '', ports: [], notes: '' };
}

/** Cable needed to join two connectors, or null when no cable is needed (wireless, shoe mount). */
export function cableFor(a: string, b: string): string | null {
  if (a === 'Wireless' || b === 'Wireless') return null;
  if (a === 'Shoe' || b === 'Shoe') return null;
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
