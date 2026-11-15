import type { Connection, DiagramLight, GearItem, LightKind, Project } from '@/types/project';
import { LIGHT_KINDS, ZONE_KINDS } from '@/types/project';
import { cableFor, categoryInfo } from './catalog';

export interface EquipRow {
  group: string;
  name: string;
  qty: number;
  why: string;
}

const STAND: Partial<Record<LightKind, string>> = {
  key: 'Light stand',
  fill: 'Light stand',
  back: 'Light stand',
  hair: 'Light stand',
  kicker: 'Light stand',
  bounce: 'C-stand',
  flag: 'C-stand',
  diffusion: 'C-stand',
  negfill: 'C-stand',
};

const MODIFIER_NAME: Partial<Record<LightKind, string>> = {
  bounce: 'Bounce board or reflector',
  flag: 'Flag',
  diffusion: 'Diffusion frame',
  negfill: 'Negative fill (black board)',
};

const ZONE_KIT: Partial<Record<string, [string, number][]>> = {
  base: [
    ['Table and chairs', 1],
    ['Shade or pop-up shelter', 1],
  ],
  village: [["Director's chair", 1]],
  power: [['Power distribution', 1]],
  makeup: [['Make-up kit and mirror', 1]],
  nogo: [['Hazard tape or cones', 1]],
};

/** Highest count of each key in any one set-up (set-ups are shot one after another, so kit moves between them). */
function peak(perSetup: Map<string, number>[]): Map<string, { n: number; setup: number }> {
  const out = new Map<string, { n: number; setup: number }>();
  perSetup.forEach((m, i) => {
    for (const [k, n] of m) {
      const cur = out.get(k);
      if (!cur || n > cur.n) out.set(k, { n, setup: i });
    }
  });
  return out;
}

function add(m: Map<string, number>, k: string, n = 1) {
  m.set(k, (m.get(k) ?? 0) + n);
}

export function cablesFor(gear: GearItem[], connections: Connection[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of connections) {
    const from = gear.find((g) => g.id === c.fromGear)?.ports.find((p) => p.id === c.fromPort);
    const to = gear.find((g) => g.id === c.toGear)?.ports.find((p) => p.id === c.toPort);
    if (!from || !to) continue;
    const cable = from.signal === 'power' && from.connector === 'Mains' ? 'Power cable or extension lead' : cableFor(from.connector, to.connector);
    if (cable) add(out, cable);
  }
  return out;
}

/** Everything the plan and gear list imply you need to bring. */
export function equipmentList(project: Project): EquipRow[] {
  const rows: EquipRow[] = [];
  const setups = project.diagrams;
  const usedIn = (gearId: string) => setups.filter((d) => d.objects.some((o) => 'gearId' in o && o.gearId === gearId)).map((d) => d.name);

  // 1. Your gear list.
  for (const g of project.gear) {
    const where = usedIn(g.id);
    rows.push({ group: categoryInfo(g.category).label, name: g.name + (g.model && !g.name.includes(g.model) ? ` (${g.model})` : ''), qty: Math.max(1, g.qty), why: where.length ? `On the plan: ${where.join(', ')}` : 'In your gear list' });
  }

  // 2. Items drawn on the plan that are not linked to gear, plus stands and sandbags.
  const unlinked: Map<string, number>[] = [];
  const stands: Map<string, number>[] = [];
  const support: Map<string, number>[] = [];
  const zones: Map<string, number>[] = [];
  for (const d of setups) {
    const u = new Map<string, number>();
    const s = new Map<string, number>();
    const sp = new Map<string, number>();
    const z = new Map<string, number>();
    for (const o of d.objects) {
      if (o.type === 'light') {
        const l = o as DiagramLight;
        if (l.kind === 'sun' || l.kind === 'window') continue;
        if (!l.gearId) add(u, `${MODIFIER_NAME[l.kind] ? 'Grip and support' : 'Lights'}|${MODIFIER_NAME[l.kind] ?? LIGHT_KINDS.find((k) => k.id === l.kind)?.label ?? l.kind}`);
        const stand = STAND[l.kind];
        if (stand) add(s, stand);
      } else if (o.type === 'camera') {
        if (!o.gearId) add(u, 'Cameras|Camera body');
        add(sp, 'Tripod or camera support');
      } else if (o.type === 'gear' && !o.gearId) {
        add(u, `${categoryInfo(o.category).label}|${o.label || categoryInfo(o.category).label}`);
      } else if (o.type === 'zone') {
        for (const [name, n] of ZONE_KIT[o.zoneKind] ?? []) add(z, name, n);
      }
    }
    unlinked.push(u);
    stands.push(s);
    support.push(sp);
    zones.push(z);
  }
  for (const [key, { n, setup }] of peak(unlinked)) {
    const [group, name] = key.split('|');
    rows.push({ group, name, qty: n, why: `Drawn on the plan without gear assigned (peak in ${setups[setup].name})` });
  }
  const gripOwned = (name: string) => project.gear.filter((g) => g.category === 'grip' && g.name.toLowerCase().includes(name)).reduce((a, g) => a + g.qty, 0);
  const standPeak = Math.max(0, ...stands.map((m) => Array.from(m.values()).reduce((a, n) => a + n, 0)));
  for (const [name, { n, setup }] of peak(stands)) {
    const need = Math.max(0, n - gripOwned(name.toLowerCase()));
    if (need > 0) rows.push({ group: 'Grip and support', name, qty: need, why: `One per light or modifier (peak in ${setups[setup].name})` });
  }
  for (const [name, { n, setup }] of peak(support)) {
    const need = Math.max(0, n - gripOwned('tripod') - gripOwned('gimbal'));
    if (need > 0) rows.push({ group: 'Grip and support', name, qty: need, why: `One per camera position (peak in ${setups[setup].name})` });
  }
  if (standPeak > 0) rows.push({ group: 'Grip and support', name: 'Sandbag', qty: standPeak, why: 'One per stand' });
  for (const [name, { n }] of peak(zones)) rows.push({ group: 'Base', name, qty: n, why: `For the ${ZONE_KINDS.find((z) => ZONE_KIT[z.id]?.some(([x]) => x === name))?.label.toLowerCase() ?? 'area'} on the plan` });

  // 3. Cables from the connection list, less any already on the gear list.
  for (const [name, n] of cablesFor(project.gear, project.connections)) {
    const owned = project.gear.filter((g) => g.category === 'cable' && g.name.toLowerCase() === name.toLowerCase()).reduce((a, g) => a + g.qty, 0);
    if (n > owned) rows.push({ group: 'Cables and adaptors', name, qty: n - owned, why: owned ? `Connections need ${n}; your gear list has ${owned}` : 'From the connection list' });
  }

  // 4. Batteries, mains power and media.
  const byPower = new Map<string, number>();
  let mains = 0;
  for (const g of project.gear) {
    if (g.category === 'battery' || g.category === 'cable') continue;
    const p = g.power.trim();
    if (!p || /^(internal|phantom|plug-in)/i.test(p)) continue;
    if (/^mains$/i.test(p)) mains += g.qty;
    else byPower.set(p, (byPower.get(p) ?? 0) + Math.max(1, g.qty));
  }
  const ownedBatteries = (type: string) => project.gear.filter((g) => g.category === 'battery' && g.ports.some((p) => p.connector === 'Battery plate' && p.standard === type)).reduce((a, g) => a + g.qty, 0);
  for (const [type, n] of byPower) {
    if (/^(camera battery|aa)$/i.test(type) === false && ownedBatteries(type) >= n * 2) continue;
    const owned = ownedBatteries(type);
    rows.push({ group: 'Power', name: `${type} battery`, qty: Math.max(0, n * 2 - owned), why: owned ? `${n} device${n === 1 ? '' : 's'} need ${n * 2} (one in each and a spare); you list ${owned}` : `${n} device${n === 1 ? '' : 's'}: one in each and one spare` });
  }
  if (byPower.size) rows.push({ group: 'Power', name: 'Battery chargers', qty: byPower.size, why: 'One per battery type' });
  if (mains > 0) {
    rows.push({ group: 'Power', name: 'Power board', qty: Math.ceil(mains / 4), why: `${mains} mains device${mains === 1 ? '' : 's'}` });
    rows.push({ group: 'Power', name: 'Extension lead', qty: Math.ceil(mains / 4), why: 'To reach the power boards' });
  }
  const recording = project.gear.filter((g) => g.category === 'camera' || g.category === 'recorder').reduce((a, g) => a + Math.max(1, g.qty), 0);
  const cards = project.gear.filter((g) => g.category === 'media' && /card/i.test(g.name)).reduce((a, g) => a + g.qty, 0);
  if (recording > 0 && cards < recording * 2) rows.push({ group: 'Media and data', name: 'Memory card', qty: recording * 2 - cards, why: `Two per recording device (${recording})` });
  if (project.gear.some((g) => g.category === 'mic' || g.category === 'recorder') && !project.gear.some((g) => /headphone/i.test(g.name))) rows.push({ group: 'Audio accessories', name: 'Headphones', qty: 1, why: 'To monitor sound' });

  const order = ['Cameras', 'Lenses', 'Monitors', 'Microphones', 'Wireless audio', 'Recorders', 'Audio accessories', 'Lights', 'Grip and support', 'Cables and adaptors', 'Power', 'Media and data', 'Base', 'Other'];
  return rows.sort((a, b) => (order.indexOf(a.group) + 1 || 99) - (order.indexOf(b.group) + 1 || 99) || a.name.localeCompare(b.name));
}
