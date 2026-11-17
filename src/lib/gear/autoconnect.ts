import type { Connection, GearItem, GearPort } from '@/types/project';
import { MECHANICAL, cableFor } from './catalog';
import { uid } from '@/lib/id';

export interface Proposal {
  id: string;
  fromGear: string;
  fromPort: string;
  toGear: string;
  toPort: string;
  score: number;
  reason: string;
  cable: string | null;
}

export interface Check {
  ok: boolean;
  score: number;
  reason: string;
}

/** The camera an item belongs to (a camera belongs to itself). */
export function rigKey(g: GearItem): string | undefined {
  return g.category === 'camera' ? g.id : g.rigOf;
}

function kind(g: GearItem): string {
  const k = g.rigKind ?? g.category;
  return k.startsWith('body') || g.category === 'camera' ? 'body' : k;
}

/** Which hosts an accessory may mount on, best first. Anything not listed is refused. */
const HOSTS: Record<string, Record<string, number>> = {
  cage: { body: 40 },
  'top-handle': { cage: 40, 'nato-rail': 35 },
  'side-handle': { cage: 40, 'nato-rail': 35 },
  'nato-rail': { cage: 40 },
  arm: { 'top-handle': 40, cage: 35 },
  'rod-plate': { cage: 40, body: 25 },
  tripod: { 'rod-plate': 40, cage: 35, body: 25 },
  monopod: { 'rod-plate': 40, cage: 35, body: 25 },
  gimbal: { cage: 35, body: 40 },
  monitor: { arm: 40, 'top-handle': 30, cage: 20 },
  'mic-oncam': { 'top-handle': 40, cage: 35, body: 30 },
  'wireless-rx': { 'top-handle': 35, cage: 40, body: 25 },
  'video-tx': { cage: 40, 'top-handle': 35, body: 20 },
  'follow-focus': { 'rod-plate': 40 },
  'matte-box': { 'rod-plate': 40 },
  'vmount-plate': { 'rod-plate': 40, cage: 30 },
  filter: { lens: 40 },
  'filter-tray': { 'matte-box': 40 },
  lens: { body: 40, adapter: 45 },
  adapter: { body: 40 },
  'mic-shotgun': { boom: 40 },
};

const AUDIO_CABLED: [string, string][] = [
  ['XLR', 'XLR'],
  ['XLR', 'Mini XLR'],
  ['Mini XLR', 'XLR'],
  ['Mini XLR', 'Mini XLR'],
  ['3.5 mm TRS', '3.5 mm TRS'],
  ['3.5 mm TRS', 'XLR'],
  ['3.5 mm TRS', 'Mini XLR'],
  ['XLR', '3.5 mm TRS'],
  ['3.5 mm TRS', '6.35 mm TRS'],
  ['6.35 mm TRS', '3.5 mm TRS'],
];
const HDMI = new Set(['HDMI', 'Micro HDMI', 'Mini HDMI']);

/** Can this output physically and electrically join this input? */
export function check(fg: GearItem, fp: GearPort, tg: GearItem, tp: GearPort): Check {
  const no = (reason: string): Check => ({ ok: false, score: 0, reason });
  if (fg.id === tg.id) return no('Same item');
  if (fp.dir !== 'out' || tp.dir !== 'in') return no('Connections run from an output to an input');
  const ra = rigKey(fg);
  const rb = rigKey(tg);
  const sameRig = !!ra && ra === rb;
  if (ra && rb && ra !== rb) return no('These belong to different cameras');

  const mech = MECHANICAL.has(fp.connector) || MECHANICAL.has(tp.connector);
  if (mech) {
    if (fp.connector !== tp.connector && !(fp.connector === 'Shoe' && tp.connector === 'Cold shoe') && !(fp.connector === 'Cold shoe' && tp.connector === 'Shoe')) return no(`${fp.connector} does not fit ${tp.connector}`);
    if (fp.standard && tp.standard && fp.standard !== tp.standard) return no(`${fp.standard} does not fit ${tp.standard}`);
    if (fp.connector === 'Battery plate') {
      if (fp.vOut && (tp.vMin != null || tp.vMax != null) && (fp.vOut < (tp.vMin ?? 0) - 0.5 || fp.vOut > (tp.vMax ?? 99) + 0.5)) return no(`${fp.vOut} V is outside ${tp.vMin}–${tp.vMax} V`);
      if (ra && rb && !sameRig) return no('Different rigs');
      return { ok: true, score: 95 + (sameRig ? 5 : 0), reason: `${fp.standard ?? 'Battery'} battery${fp.vOut ? ` (${fp.vOut} V)` : ''} into ${tg.name}` };
    }
    if (fp.connector === 'Mic mount') return { ok: true, score: 70, reason: 'Mic in the boom shock mount' };
    // Rig parts must be on the same camera, unless the host is the camera of the accessory's rig.
    if (!(sameRig || (rb === undefined && ra === undefined))) return no('Assign both to the same camera rig first');
    const hosts = HOSTS[kind(tg)];
    const bonus = hosts ? hosts[kind(fg)] : undefined;
    if (hosts && bonus === undefined) return no(`${tg.name} does not mount on ${fg.name}`);
    // Supports go under the rig; handles, monitors and receivers go on top or at the side.
    const isBase = (pt: GearPort) => /base|bottom|tripod/i.test(pt.name);
    const k = kind(tg);
    if (['tripod', 'monopod', 'gimbal', 'rod-plate'].includes(k) && fg.ports.some(isBase) && !isBase(fp)) return no(`${tg.name} goes under ${fg.name}, on its base`);
    if (['monitor', 'top-handle', 'side-handle', 'nato-rail', 'arm', 'mic-oncam', 'wireless-rx', 'video-tx'].includes(k) && isBase(fp)) return no(`${fp.name} is underneath; ${tg.name} goes on top or at the side`);
    if (k === 'vmount-plate' && /top/i.test(fp.name)) return no(`A battery plate goes on the side or back, not on ${fp.name}`);
    const what = fp.connector === 'Lens mount' ? `${fp.standard ?? ''} mount` : fp.connector === 'Filter thread' ? `${fp.standard} thread` : fp.connector;
    return { ok: true, score: 60 + (bonus ?? 10), reason: `${tg.name} on ${fg.name} (${what})` };
  }

  if (fp.signal !== tp.signal) return no(`${fp.signal} output into a ${tp.signal} input`);
  if (fp.phantom && !tp.phantom) return no(`${fg.name} needs 48 V phantom power, which ${tp.name} on ${tg.name} does not supply`);

  const sig = fp.signal;
  let score: number;
  let reason: string;
  if (fp.connector === 'Wireless' || tp.connector === 'Wireless') {
    if (fp.connector !== tp.connector) return no('Wireless only pairs with wireless');
    if ((fp.standard ?? '') !== (tp.standard ?? '')) return no('Different wireless systems');
    score = 90;
    reason = `Pair ${fg.name} with ${tg.name}`;
  } else if (sig === 'audio') {
    if (!AUDIO_CABLED.some(([a, b]) => a === fp.connector && b === tp.connector)) return no(`${fp.connector} cannot feed ${tp.connector}`);
    const k = kind(fg);
    const tk = kind(tg);
    score = 50;
    if (k === 'mic-lav' && tk === 'wireless-tx') score = 95;
    else if (k === 'mic-lav') score = tk === 'recorder' ? 45 : 30;
    else if (k === 'mic-shotgun' || k === 'mic-handheld') score = tk === 'recorder' ? 90 : tk === 'body' ? 70 : 40;
    else if (k === 'mic-oncam') score = tk === 'body' && sameRig ? 92 : tk === 'body' ? 60 : 30;
    else if (k === 'wireless-rx') score = tk === 'body' && sameRig ? 92 : tk === 'recorder' ? 80 : tk === 'body' ? 60 : 30;
    else if (tk === 'headphones') score = k === 'recorder' ? 75 : 45;
    else if (fp.name.toLowerCase().includes('headphone')) return no('Headphone outputs feed headphones');
    if (tk === 'headphones' && !fp.name.toLowerCase().includes('headphone')) return no('Headphones take a headphone output');
    if (tk === 'wireless-tx' && k !== 'mic-lav' && k !== 'mic-oncam') score = 20;
    reason = `${fg.name} into ${tg.name} ${tp.name}`;
  } else if (sig === 'video') {
    const ok = (HDMI.has(fp.connector) && HDMI.has(tp.connector)) || (fp.connector === 'SDI' && tp.connector === 'SDI');
    if (!ok) return no(`${fp.connector} cannot feed ${tp.connector}`);
    const tk = kind(tg);
    score = kind(fg) === 'body' ? (tk === 'monitor' ? (sameRig ? 90 : 70) : tk === 'video-tx' ? (sameRig ? 85 : 60) : 50) : 55;
    reason = `${fg.name} picture to ${tg.name}`;
  } else if (sig === 'timecode') {
    if (fp.connector !== tp.connector) return no(`${fp.connector} cannot feed ${tp.connector}`);
    score = 60;
    reason = `Timecode from ${fg.name} to ${tg.name}`;
  } else if (sig === 'power') {
    const pair = `${fp.connector}>${tp.connector}`;
    if (!['D-tap>DC barrel', 'D-tap>D-tap', 'Mains>Mains', 'USB-C>USB-C'].includes(pair)) return no(`${fp.connector} cannot power ${tp.connector}`);
    if (fp.vOut != null && (tp.vMin != null || tp.vMax != null) && (fp.vOut < (tp.vMin ?? 0) || fp.vOut > (tp.vMax ?? 999))) return no(`${fp.vOut} V is outside ${tp.vMin}–${tp.vMax} V`);
    score = fp.connector === 'Mains' ? 35 : 55;
    reason = `Power ${tg.name} from ${fg.name}${fp.vOut ? ` (${fp.vOut} V)` : ''}`;
  } else {
    return no('Data links are not made automatically');
  }
  if (sameRig) score += 5;
  return { ok: true, score, reason };
}

export function usedPorts(connections: Connection[]): Set<string> {
  const used = new Set<string>();
  for (const c of connections) {
    used.add(`${c.fromGear}:${c.fromPort}`);
    used.add(`${c.toGear}:${c.toPort}`);
  }
  return used;
}

/** Suggest connections between free ports. Each port is used once; the best matches win. */
export function proposeConnections(gear: GearItem[], existing: Connection[], scopeCameraId?: string): Proposal[] {
  const inScope = (g: GearItem) => !scopeCameraId || rigKey(g) === scopeCameraId || (!rigKey(g) && g.category !== 'camera');
  const items = gear.filter(inScope);
  const used = usedPorts(existing);
  // A camera with a lens (direct or through an adapter) takes no other lens.
  const cands: Proposal[] = [];
  for (const fg of items)
    for (const fp of fg.ports) {
      if (fp.dir !== 'out' || used.has(`${fg.id}:${fp.id}`)) continue;
      for (const tg of items)
        for (const tp of tg.ports) {
          if (tp.dir !== 'in' || used.has(`${tg.id}:${tp.id}`)) continue;
          const c = check(fg, fp, tg, tp);
          if (!c.ok || c.score < 30) continue;
          cands.push({ id: uid(), fromGear: fg.id, fromPort: fp.id, toGear: tg.id, toPort: tp.id, score: c.score, reason: c.reason, cable: cableFor(fp.connector, tp.connector) });
        }
    }
  cands.sort((a, b) => b.score - a.score);
  const taken = new Set(used);
  const pairedItems = new Map<string, Set<string>>(); // avoid two links between the same pair of items for one signal
  const out: Proposal[] = [];
  for (const p of cands) {
    const a = `${p.fromGear}:${p.fromPort}`;
    const b = `${p.toGear}:${p.toPort}`;
    if (taken.has(a) || taken.has(b)) continue;
    const key = `${p.fromGear}>${p.toGear}`;
    const sig = gear.find((g) => g.id === p.fromGear)?.ports.find((x) => x.id === p.fromPort)?.signal ?? '';
    const seen = pairedItems.get(key) ?? new Set<string>();
    if (sig !== 'mount' && seen.has(sig)) continue;
    // An item hangs from one host only.
    if (sig === 'mount' && out.some((o) => o.toGear === p.toGear && gear.find((g) => g.id === o.fromGear)?.ports.find((x) => x.id === o.fromPort)?.signal === 'mount')) continue;
    if (sig === 'mount' && existing.some((c) => c.toGear === p.toGear && gear.find((g) => g.id === c.fromGear)?.ports.find((x) => x.id === c.fromPort)?.signal === 'mount')) continue;
    seen.add(sig);
    pairedItems.set(key, seen);
    taken.add(a);
    taken.add(b);
    out.push(p);
  }
  return out;
}

export interface Issue {
  level: 'error' | 'warn' | 'info';
  text: string;
  gearIds: string[];
}

/** Everything that is wrong or missing across the production. */
export function checkProduction(gear: GearItem[], connections: Connection[]): Issue[] {
  const issues: Issue[] = [];
  const byId = new Map(gear.map((g) => [g.id, g]));
  const portOf = (g: GearItem | undefined, id: string) => g?.ports.find((p) => p.id === id);
  for (const c of connections) {
    const fg = byId.get(c.fromGear);
    const tg = byId.get(c.toGear);
    const fp = portOf(fg, c.fromPort);
    const tp = portOf(tg, c.toPort);
    if (!fg || !tg || !fp || !tp) {
      issues.push({ level: 'error', text: 'A connection points at gear or a port that no longer exists.', gearIds: [c.fromGear, c.toGear] });
      continue;
    }
    const r = check(fg, fp, tg, tp);
    if (!r.ok) issues.push({ level: 'error', text: `${fg.name} ${fp.name} to ${tg.name} ${tp.name}: ${r.reason}.`, gearIds: [fg.id, tg.id] });
  }
  const used = usedPorts(connections);
  const isUsed = (g: GearItem, pred: (p: GearPort) => boolean) => g.ports.some((p) => pred(p) && used.has(`${g.id}:${p.id}`));
  for (const g of gear) {
    const k = kind(g);
    if (k === 'body') {
      if (g.ports.some((p) => p.connector === 'Lens mount') && !isUsed(g, (p) => p.connector === 'Lens mount')) issues.push({ level: 'warn', text: `${g.name} has no lens attached.`, gearIds: [g.id] });
      if (!isUsed(g, (p) => p.signal === 'power')) issues.push({ level: 'warn', text: `${g.name} has no battery or power connected.`, gearIds: [g.id] });
      const rig = gear.filter((x) => rigKey(x) === g.id);
      if (!rig.some((x) => ['tripod', 'monopod', 'gimbal'].includes(kind(x)))) issues.push({ level: 'info', text: `${g.name} has no tripod, monopod or gimbal on its rig. Fine if you are shooting handheld.`, gearIds: [g.id] });
      const support = rig.find((x) => x.payloadKg && ['tripod', 'monopod', 'gimbal'].includes(kind(x)));
      if (support) {
        const weight = [g, ...rig.filter((x) => x !== support)].reduce((a, x) => a + (x.weightKg ?? 0) * Math.max(1, x.qty), 0);
        if (weight > (support.payloadKg ?? 99)) issues.push({ level: 'error', text: `${g.name} rig weighs about ${weight.toFixed(1)} kg, over the ${support.payloadKg} kg payload of ${support.name}.`, gearIds: [g.id, support.id] });
      }
    }
    if (k === 'monitor') {
      if (!isUsed(g, (p) => p.signal === 'video' && p.dir === 'in')) issues.push({ level: 'warn', text: `${g.name} has no picture going into it.`, gearIds: [g.id] });
      if (g.ports.some((p) => p.signal === 'power' && p.dir === 'in') && !isUsed(g, (p) => p.signal === 'power' && p.dir === 'in')) issues.push({ level: 'warn', text: `${g.name} has no battery or power.`, gearIds: [g.id] });
    }
    if (k.startsWith('mic') && !isUsed(g, (p) => p.signal === 'audio' && p.dir === 'out')) issues.push({ level: 'warn', text: `${g.name} is not connected to anything that records it.`, gearIds: [g.id] });
    if (k === 'wireless-tx' && !isUsed(g, (p) => p.connector === 'Wireless')) issues.push({ level: 'warn', text: `${g.name} has no receiver paired.`, gearIds: [g.id] });
    if (k === 'wireless-rx' && !isUsed(g, (p) => p.signal === 'audio' && p.dir === 'out')) issues.push({ level: 'warn', text: `${g.name} output does not go anywhere.`, gearIds: [g.id] });
    if (k === 'lens' && !isUsed(g, (p) => p.connector === 'Lens mount')) issues.push({ level: 'info', text: `${g.name} is not on a camera.`, gearIds: [g.id] });
    if (['cage', 'top-handle', 'side-handle', 'nato-rail', 'arm', 'rod-plate', 'follow-focus', 'matte-box', 'filter', 'filter-tray'].includes(k) && !g.ports.some((p) => p.dir === 'in' && p.signal === 'mount' && used.has(`${g.id}:${p.id}`))) issues.push({ level: 'info', text: `${g.name} is not mounted on anything yet.`, gearIds: [g.id] });
  }
  // Cables the connections need that the gear list does not have.
  const need = new Map<string, number>();
  for (const c of connections) {
    const fp = portOf(byId.get(c.fromGear), c.fromPort);
    const tp = portOf(byId.get(c.toGear), c.toPort);
    if (!fp || !tp) continue;
    const cable = fp.connector === 'Mains' ? null : cableFor(fp.connector, tp.connector);
    if (cable) need.set(cable, (need.get(cable) ?? 0) + 1);
  }
  for (const [cable, n] of need) {
    const have = gear.filter((g) => g.category === 'cable' && g.name.toLowerCase() === cable.toLowerCase()).reduce((a, g) => a + g.qty, 0);
    if (have < n) issues.push({ level: 'info', text: `Need ${n} × ${cable}; your gear list has ${have}.`, gearIds: [] });
  }
  const order = { error: 0, warn: 1, info: 2 };
  return issues.sort((a, b) => order[a.level] - order[b.level]);
}

/** Inputs and outputs of an item with what each one is connected to. */
export function portUsage(g: GearItem, gear: GearItem[], connections: Connection[]) {
  return g.ports.map((p) => {
    const c = connections.find((x) => (x.fromGear === g.id && x.fromPort === p.id) || (x.toGear === g.id && x.toPort === p.id));
    const otherId = c ? (c.fromGear === g.id ? c.toGear : c.fromGear) : undefined;
    const other = otherId ? gear.find((x) => x.id === otherId) : undefined;
    const otherPort = c && other ? other.ports.find((x) => x.id === (c.fromGear === g.id ? c.toPort : c.fromPort)) : undefined;
    return { port: p, connection: c, other, otherPort };
  });
}
