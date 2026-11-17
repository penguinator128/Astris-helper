import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { CameraBodySpec, Connection, GearItem, GearPort, SignalKind } from '@/types/project';
import { bodyOf } from '@/lib/camera/bodies';
import { LENSES } from '@/lib/camera/lenses';
import { cameraConfig } from '@/lib/camera/settings';
import { check, rigKey } from '@/lib/gear/autoconnect';

/**
 * The camera rig in 3D, in metres: x to the camera's right, y up, z out of the lens.
 * Every part is a small model with named mounting points (one per port). Parts are placed by
 * the real connections: a part sits on the mounting point of the port it is connected to,
 * so the 3D rig always matches the connection list. Unmounted parts wait on a tray beside it.
 */

export type RigStyle = 'real' | 'blueprint';

export const RIG_INK = { bg: 0x0b0b0c, fill: 0x1d1d20, edge: 0xe9e6dc, sel: 0xffc400, grid: 0x2a2a2e };
const SIGNAL: Record<SignalKind, number> = { audio: 0x3f7fc0, video: 0xffc400, timecode: 0xa7a59d, power: 0xd0453b, data: 0x8a8a90, mount: 0xe9e6dc };

interface Anchor {
  pos: THREE.Vector3;
  normal: THREE.Vector3;
  /** Inside the host (a battery in its slot). */
  inside?: boolean;
}

interface Model {
  group: THREE.Group;
  /** Mounting point per port name. */
  anchors: Record<string, Anchor>;
}

export interface RigPart {
  id: string;
  name: string;
  object: THREE.Object3D;
  label: THREE.Vector3;
  mounted: boolean;
  /** Support legs and the like: left out when framing the camera. */
  support: boolean;
}

/** A free mounting point a part could go on. */
export interface MountSpot {
  hostId: string;
  portId: string;
  label: string;
  pos: THREE.Vector3;
}

/* ---------- Materials ---------- */

interface Mats {
  body: THREE.Material;
  metal: THREE.Material;
  rubber: THREE.Material;
  glass: THREE.Material;
  screen: THREE.Material;
  accent: THREE.Material;
  red: THREE.Material;
  foam: THREE.Material;
  plastic: THREE.Material;
  edges: boolean;
}

function materials(style: RigStyle, light = false): Mats {
  if (style === 'blueprint') {
    const fill = new THREE.MeshLambertMaterial({ color: light ? 0xe4e1d6 : RIG_INK.fill });
    const glass = new THREE.MeshLambertMaterial({ color: light ? 0xc9d3dc : 0x22303a });
    return { body: fill, metal: fill, rubber: fill, glass, screen: glass, accent: new THREE.MeshLambertMaterial({ color: 0xffc400 }), red: new THREE.MeshLambertMaterial({ color: 0xb3261e }), foam: fill, plastic: fill, edges: true };
  }
  const std = (color: number, roughness: number, metalness = 0, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  return {
    body: std(0x1b1b1d, 0.55, 0.15),
    metal: std(0x2b2b2f, 0.38, 0.75),
    rubber: std(0x111112, 0.92, 0),
    glass: std(0x0e1a24, 0.05, 0.6, { envMapIntensity: 1.6 }),
    screen: std(0x10151a, 0.2, 0.1, { emissive: 0x1a2a38, emissiveIntensity: 0.6 }),
    accent: std(0xffc400, 0.4, 0.2),
    red: std(0xc0262d, 0.4, 0.1),
    foam: std(0x3a3a3c, 1, 0),
    plastic: std(0x232326, 0.6, 0.05),
    edges: false,
  };
}

/* ---------- Shape helpers ---------- */

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const mm = (v: number) => v / 1000;

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, m: Mats): THREE.Mesh {
  const o = new THREE.Mesh(geo, mat);
  o.castShadow = true;
  o.receiveShadow = true;
  if (m.edges) {
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), new THREE.LineBasicMaterial({ color: RIG_INK.edge }));
    e.userData.edge = true;
    o.add(e);
  }
  return o;
}

function rbox(g: THREE.Group, m: Mats, mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, r = 0.004): THREE.Mesh {
  const radius = Math.min(r, w / 2.2, h / 2.2, d / 2.2);
  const o = mesh(new RoundedBoxGeometry(w, h, d, 3, Math.max(0.0005, radius)), mat, m);
  o.position.set(x, y, z);
  g.add(o);
  return o;
}

/** Cylinder along an axis. */
function cyl(g: THREE.Group, m: Mats, mat: THREE.Material, r: number, len: number, at: THREE.Vector3, axis: 'x' | 'y' | 'z' = 'y', r2 = r, seg = 32): THREE.Mesh {
  const o = mesh(new THREE.CylinderGeometry(r, r2, len, seg), mat, m);
  o.position.copy(at);
  if (axis === 'z') o.rotation.x = Math.PI / 2;
  if (axis === 'x') o.rotation.z = Math.PI / 2;
  g.add(o);
  return o;
}

/** A rod between two points. */
function rod(g: THREE.Group, m: Mats, mat: THREE.Material, a: THREE.Vector3, b: THREE.Vector3, r: number, r2 = r): THREE.Mesh {
  const len = a.distanceTo(b);
  const o = mesh(new THREE.CylinderGeometry(r2, r, len, 16), mat, m);
  o.position.copy(a).lerp(b, 0.5);
  o.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  g.add(o);
  return o;
}

/** Turned shape around the z axis from (radius, z) points: lenses, filters, mics. */
function lathe(g: THREE.Group, m: Mats, mat: THREE.Material, pts: [number, number][], seg = 48): THREE.Mesh {
  const geo = new THREE.LatheGeometry(pts.map(([r, z]) => new THREE.Vector2(Math.max(0.0001, r), z)), seg);
  geo.rotateX(Math.PI / 2);
  const o = mesh(geo, mat, m);
  g.add(o);
  return o;
}

/** Grip ridges on a ring: thin raised bands around the z axis. */
function ridges(g: THREE.Group, m: Mats, mat: THREE.Material, r: number, z0: number, z1: number, n: number) {
  for (let i = 0; i < n; i++) {
    const t = mesh(new THREE.TorusGeometry(r, 0.0011, 6, 48), mat, m);
    t.position.z = z0 + ((i + 0.5) / n) * (z1 - z0);
    g.add(t);
  }
}

const A = (pos: THREE.Vector3, normal: THREE.Vector3, inside = false): Anchor => ({ pos, normal: normal.normalize(), inside });

/* ---------- Part models ---------- */

interface Ctx {
  m: Mats;
  body: CameraBodySpec;
  /** Body size in metres. */
  W: number;
  H: number;
  D: number;
  lensAxisY: number;
}

function bodyModel(cam: GearItem, c: Ctx): Model {
  const { m, W, H, D, body } = c;
  const g = new THREE.Group();
  const anchors: Record<string, Anchor> = {};
  const front = D * 0.25;
  if (body.type === 'mirrorless' || body.type === 'dslr') {
    const shellH = H * (body.type === 'dslr' ? 0.74 : 0.8);
    const shellD = D * 0.5;
    rbox(g, m, m.body, W, shellH, shellD, 0, shellH / 2, front - shellD / 2, 0.008);
    // Grip, deeper than the shell, on the right.
    rbox(g, m, m.rubber, W * 0.24, shellH * 0.98, D * 0.92, W / 2 - W * 0.12, shellH * 0.49, front - D * 0.46 + 0.004, 0.012);
    // Viewfinder or prism hump over the lens axis.
    const humpH = H - shellH;
    rbox(g, m, m.body, W * (body.type === 'dslr' ? 0.36 : 0.3), humpH, shellD * 0.8, 0, shellH + humpH / 2 - 0.002, front - shellD * 0.45, 0.006);
    // Eyecup and rear screen.
    rbox(g, m, m.rubber, W * 0.2, humpH * 0.8, 0.012, 0, shellH + humpH * 0.4, front - shellD - 0.004, 0.004);
    rbox(g, m, m.screen, W * 0.58, shellH * 0.58, 0.006, -W * 0.08, shellH * 0.45, front - shellD - 0.002, 0.003);
    // Dials and shutter button.
    cyl(g, m, m.metal, 0.011, 0.007, V(W / 2 - W * 0.22, shellH + 0.004, front - shellD * 0.5));
    cyl(g, m, m.metal, 0.012, 0.006, V(-W / 2 + W * 0.18, shellH + 0.003, front - shellD * 0.55));
    cyl(g, m, m.metal, 0.005, 0.006, V(W / 2 - W * 0.12, shellH + 0.002, front - 0.012));
    cyl(g, m, m.red, 0.0025, 0.004, V(W / 2 - W * 0.3, shellH + 0.003, front - shellD * 0.25));
    // Shoe on the hump.
    rbox(g, m, m.metal, 0.02, 0.003, 0.02, 0, H + 0.0015, front - shellD * 0.45, 0.001);
    anchors['shoe'] = A(V(0, H + 0.003, front - shellD * 0.45), V(0, 1, 0));
    // Port doors on the left side.
    rbox(g, m, m.rubber, 0.003, shellH * 0.55, shellD * 0.5, -W / 2 - 0.0012, shellH * 0.5, front - shellD * 0.5, 0.002);
  } else if (body.type === 'cinema') {
    rbox(g, m, m.body, W, H, D, 0, H / 2, front - D / 2, 0.012);
    for (let i = 0; i < 6; i++) rbox(g, m, m.rubber, 0.003, H * 0.5, 0.004, W / 2 + 0.001, H * 0.5, front - D * 0.3 - i * 0.012, 0.001);
    rbox(g, m, m.screen, 0.004, H * 0.45, D * 0.4, -W / 2 - 0.002, H * 0.55, front - D * 0.5, 0.002);
    cyl(g, m, m.red, 0.006, 0.004, V(W / 2 - 0.02, H + 0.002, front - 0.03));
    for (const z of [-D * 0.25, -D * 0.7]) cyl(g, m, m.metal, 0.006, 0.002, V(0, H + 0.001, front + z));
    anchors['shoe'] = A(V(0, H, front - D * 0.25), V(0, 1, 0));
  } else if (body.type === 'camcorder') {
    rbox(g, m, m.body, W, H * 0.62, D * 0.7, 0, H * 0.31, front - D * 0.4, 0.015);
    rbox(g, m, m.body, W * 0.25, 0.02, D * 0.7, 0, H * 0.94, front - D * 0.4, 0.006);
    rod(g, m, m.body, V(0, H * 0.62, front - D * 0.7), V(0, H * 0.94, front - D * 0.7), 0.01);
    rod(g, m, m.body, V(0, H * 0.62, front - D * 0.1), V(0, H * 0.94, front - D * 0.1), 0.01);
    rbox(g, m, m.screen, 0.006, H * 0.3, D * 0.3, -W / 2 - 0.003, H * 0.55, front - D * 0.3, 0.003);
    anchors['shoe'] = A(V(0, H * 0.95 + 0.01, front - D * 0.2), V(0, 1, 0));
  } else if (body.type === 'phone') {
    rbox(g, m, m.body, W, H, Math.max(0.008, D), 0, H / 2, 0, 0.008);
    rbox(g, m, m.glass, W * 0.4, W * 0.4, 0.003, -W * 0.2, H * 0.82, D / 2 + 0.0015, 0.006);
    anchors['shoe'] = A(V(0, H, 0), V(0, 1, 0));
  } else {
    rbox(g, m, m.body, W, H, D, 0, H / 2, front - D / 2, 0.008);
    anchors['shoe'] = A(V(0, H, front - D / 2), V(0, 1, 0));
  }
  const mountR = body.mount === 'PL' || body.mount === 'LPL' ? 0.034 : body.mount === 'MFT' ? 0.024 : body.mount === 'Fixed' ? 0.018 : 0.028;
  if (body.type !== 'phone') {
    cyl(g, m, m.metal, mountR, 0.004, V(0, c.lensAxisY, front + 0.002), 'z');
    cyl(g, m, m.rubber, mountR * 0.82, 0.0045, V(0, c.lensAxisY, front + 0.0025), 'z');
  }
  anchors['Lens mount'] = A(V(0, c.lensAxisY, front + 0.004), V(0, 0, 1));
  anchors['Tripod socket'] = A(V(0, 0, front - D * 0.3), V(0, -1, 0));
  // Battery: a V-mount or Gold mount plate on the back; anything else slides up into the grip.
  anchors['Battery'] = /v-?mount|gold/i.test(body.battery) ? A(V(0, H * 0.5, front - D - 0.002), V(0, 0, -1)) : A(V(body.type === 'mirrorless' || body.type === 'dslr' ? W / 2 - W * 0.12 : 0, Math.max(0.058, H * 0.8), front - D * 0.4), V(0, -1, 0), true);
  // Signal ports along the left side (the usual place), from the top down.
  const side = cam.ports.filter((p) => p.signal !== 'mount' && p.connector !== 'Battery plate');
  side.forEach((p, i) => {
    anchors[p.name] = A(V(-W / 2 - 0.002, H * 0.7 - i * Math.min(0.012, (H * 0.6) / Math.max(1, side.length)), front - D * 0.35), V(-1, 0, 0));
  });
  for (const p of cam.ports) if (p.connector === 'Cold shoe' || p.connector === 'Shoe') anchors[p.name] = anchors['shoe'];
  return { group: g, anchors };
}

function lensModel(g0: GearItem, c: Ctx): Model {
  const { m } = c;
  const g = new THREE.Group();
  const spec = g0.lens;
  const db = LENSES.find((l) => spec && l.model === spec.model);
  const focal = spec?.focalMax ?? 50;
  const L = mm(spec?.length ?? db?.length ?? Math.min(220, 45 + focal * 0.45));
  const R = mm(spec?.diameter ?? db?.diameter ?? (spec && spec.focalMax !== spec.focalMin ? 82 : 70)) / 2;
  const thread = mm(spec?.filterThread || 0) / 2;
  const frontR = Math.max(thread + 0.002, R * 0.92);
  const r0 = Math.min(R, 0.03);
  lathe(g, m, m.metal, [[0, 0], [r0, 0], [r0, 0.006], [R * 0.86, 0.008]]);
  lathe(g, m, m.body, [[R * 0.86, 0.008], [R * 0.95, L * 0.15], [R, L * 0.3], [R, L * 0.92], [frontR + 0.001, L], [thread || frontR * 0.85, L], [thread || frontR * 0.85, L - 0.004]]);
  if (spec && spec.focalMax !== spec.focalMin) {
    lathe(g, m, m.rubber, [[R + 0.0015, L * 0.32], [R + 0.0015, L * 0.52]]);
    ridges(g, m, m.rubber, R + 0.0015, L * 0.33, L * 0.51, 7);
  }
  lathe(g, m, m.rubber, [[R + 0.0012, L * 0.62], [R + 0.0012, L * 0.86]]);
  ridges(g, m, m.rubber, R + 0.0012, L * 0.63, L * 0.85, 9);
  lathe(g, m, m.accent, [[R + 0.0004, L * 0.95], [R + 0.0004, L * 0.955]]);
  const glass = mesh(new THREE.SphereGeometry((thread || frontR) * 0.95, 32, 12, 0, Math.PI * 2, 0, 0.5), m.glass, m);
  glass.rotation.x = Math.PI / 2;
  glass.position.z = L - 0.006;
  g.add(glass);
  return {
    group: g,
    anchors: {
      Mount: A(V(0, 0, 0), V(0, 0, -1)),
      'Filter thread': A(V(0, 0, L), V(0, 0, 1)),
      'Focus ring': A(V(R, 0, L * 0.74), V(1, 0, 0)),
      _front: A(V(0, 0, L), V(0, 0, 1)),
    },
  };
}

function adapterModel(g0: GearItem, c: Ctx): Model {
  const { m } = c;
  const g = new THREE.Group();
  const len = /speed/i.test(g0.name) ? 0.03 : 0.024;
  lathe(g, m, m.metal, [[0.026, 0], [0.031, 0], [0.031, len], [0.026, len]]);
  lathe(g, m, m.rubber, [[0.0315, len * 0.3], [0.0315, len * 0.7]]);
  return { group: g, anchors: { 'Camera side': A(V(0, 0, 0), V(0, 0, -1)), 'Lens side': A(V(0, 0, len), V(0, 0, 1)) } };
}

function filterModel(g0: GearItem, c: Ctx): Model {
  const { m } = c;
  const g = new THREE.Group();
  const t = g0.ports.find((p) => p.connector === 'Filter thread')?.standard;
  const r = mm(parseFloat(t ?? '82') || 82) / 2;
  lathe(g, m, m.metal, [[r, 0], [r + 0.004, 0], [r + 0.004, 0.011], [r, 0.011]]);
  ridges(g, m, m.metal, r + 0.004, 0.002, 0.009, 4);
  const glass = mesh(new THREE.CylinderGeometry(r, r, 0.002, 48), m.glass, m);
  glass.rotation.x = Math.PI / 2;
  glass.position.z = 0.006;
  g.add(glass);
  return { group: g, anchors: { Thread: A(V(0, 0, 0), V(0, 0, -1)) } };
}

function cageModel(c: Ctx): Model {
  const { m, W, H, D } = c;
  const g = new THREE.Group();
  const t = 0.008;
  const front = D * 0.25;
  const depth = D * 0.62;
  const zc = front - D * 0.3;
  // Base plate, left wall, top bar; the grip side stays open.
  rbox(g, m, m.metal, W + 2 * t + 0.01, t, depth, 0.004, -t / 2, zc, 0.002);
  rbox(g, m, m.metal, t, H + 2 * t, depth, -W / 2 - t / 2 - 0.002, H / 2, zc, 0.002);
  rbox(g, m, m.metal, W * 0.75, t, 0.028, -W * 0.12, H + t / 2 + 0.002, zc - depth * 0.15, 0.002);
  rod(g, m, m.metal, V(W / 2 - 0.01, -t, zc + depth / 2 - 0.006), V(W / 2 - 0.01, H * 0.25, zc + depth / 2 - 0.006), 0.004);
  for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) cyl(g, m, m.rubber, 0.0025, 0.002, V(-W / 2 - t - 0.0025, H * (0.2 + i * 0.2), zc - depth * 0.25 + k * depth * 0.5), 'x');
  rbox(g, m, m.metal, 0.02, 0.006, 0.06, -W * 0.12, H + t + 0.005, zc, 0.001);
  rbox(g, m, m.metal, 0.02, 0.003, 0.02, -W * 0.12, H + t + 0.0035, zc + depth * 0.35, 0.001);
  return {
    group: g,
    anchors: {
      'Camera screw': A(V(0, 0, zc), V(0, 1, 0)),
      'Top cold shoe': A(V(-W * 0.12, H + t + 0.005, zc + depth * 0.35), V(0, 1, 0)),
      'NATO rail (top)': A(V(-W * 0.12, H + t + 0.008, zc), V(0, 1, 0)),
      'Top 1/4-20': A(V(-W * 0.12, H + t + 0.002, zc - depth * 0.35), V(0, 1, 0)),
      'Side cold shoe': A(V(-W / 2 - t - 0.002, H * 0.85, zc + depth * 0.25), V(-1, 0, 0)),
      'NATO rail (left)': A(V(-W / 2 - t - 0.002, H * 0.5, zc), V(-1, 0, 0)),
      'Side 1/4-20': A(V(-W / 2 - t - 0.002, H * 0.25, zc - depth * 0.25), V(-1, 0, 0)),
      'Base 1/4-20': A(V(0, -t, zc), V(0, -1, 0)),
    },
  };
}

function topHandleModel(c: Ctx): Model {
  const { m } = c;
  const g = new THREE.Group();
  rbox(g, m, m.metal, 0.024, 0.008, 0.05, 0, 0.004, 0, 0.002);
  rod(g, m, m.metal, V(0, 0.008, -0.02), V(0, 0.05, -0.05), 0.006);
  rod(g, m, m.metal, V(0, 0.008, 0.02), V(0, 0.05, 0.05), 0.006);
  cyl(g, m, m.rubber, 0.016, 0.13, V(0, 0.058, 0), 'z');
  rbox(g, m, m.metal, 0.02, 0.004, 0.025, 0, 0.076, -0.03, 0.001);
  return { group: g, anchors: { 'NATO clamp': A(V(0, 0, 0), V(0, -1, 0)), 'Cold shoe': A(V(0, 0.078, -0.03), V(0, 1, 0)), '1/4-20 front': A(V(0, 0.074, 0.05), V(0, 1, 0)) } };
}

function sideHandleModel(c: Ctx): Model {
  const { m } = c;
  const g = new THREE.Group();
  rbox(g, m, m.metal, 0.012, 0.04, 0.03, -0.006, 0, 0, 0.002);
  rod(g, m, m.metal, V(-0.012, 0.012, 0), V(-0.035, 0.012, 0), 0.005);
  const grip = cyl(g, m, m.rubber, 0.017, 0.12, V(-0.04, -0.035, 0), 'y', 0.019);
  grip.rotation.z = 0.12;
  cyl(g, m, m.red, 0.004, 0.006, V(-0.035, 0.03, 0.012), 'z');
  return { group: g, anchors: { 'NATO clamp': A(V(0, 0, 0), V(1, 0, 0)) } };
}

function natoModel(c: Ctx): Model {
  const g = new THREE.Group();
  rbox(g, c.m, c.m.metal, 0.02, 0.008, 0.07, 0, 0.004, 0, 0.001);
  return { group: g, anchors: { Screw: A(V(0, 0, 0), V(0, -1, 0)), Rail: A(V(0, 0.008, 0), V(0, 1, 0)) } };
}

function armModel(c: Ctx): Model {
  const { m } = c;
  const g = new THREE.Group();
  const j1 = V(0, 0.012, 0);
  const j2 = V(0.02, 0.07, -0.025);
  const j3 = V(0.01, 0.12, -0.045);
  for (const j of [j1, j2, j3]) {
    const s = mesh(new THREE.SphereGeometry(0.009, 16, 12), m.metal, m);
    s.position.copy(j);
    g.add(s);
  }
  rod(g, m, m.metal, j1, j2, 0.006);
  rod(g, m, m.metal, j2, j3, 0.006);
  cyl(g, m, m.rubber, 0.01, 0.014, V(j2.x, j2.y, j2.z + 0.012), 'z');
  return { group: g, anchors: { Base: A(V(0, 0, 0), V(0, -1, 0)), Head: A(V(j3.x, j3.y + 0.009, j3.z), V(0, 1, 0)) } };
}

function rodPlateModel(c: Ctx): Model {
  const { m } = c;
  const g = new THREE.Group();
  rbox(g, m, m.metal, 0.1, 0.018, 0.12, 0, -0.009, 0, 0.003);
  for (const x of [-0.03, 0.03]) {
    cyl(g, m, m.metal, 0.0075, 0.45, V(x, -0.034, 0.08), 'z');
    rbox(g, m, m.metal, 0.03, 0.02, 0.03, x, -0.03, 0, 0.003);
  }
  return {
    group: g,
    anchors: {
      Screw: A(V(0, 0, 0), V(0, 1, 0)),
      'Rods (left)': A(V(-0.03, -0.034, 0.2), V(0, 1, 0)),
      'Rods (right)': A(V(0.03, -0.034, 0.27), V(0, 1, 0)),
      'Rods (rear)': A(V(0, -0.034, -0.145), V(0, 0, -1)),
      'Base 1/4-20': A(V(0, -0.044, 0), V(0, -1, 0)),
    },
  };
}

function followFocusModel(c: Ctx): Model {
  const { m } = c;
  const g = new THREE.Group();
  rbox(g, m, m.metal, 0.03, 0.03, 0.03, 0, 0.012, 0, 0.003);
  rbox(g, m, m.body, 0.04, 0.05, 0.035, 0, 0.05, 0, 0.004);
  cyl(g, m, m.plastic, 0.032, 0.012, V(0.028, 0.05, 0), 'x');
  cyl(g, m, m.accent, 0.033, 0.002, V(0.035, 0.05, 0), 'x');
  cyl(g, m, m.metal, 0.012, 0.012, V(-0.02, 0.07, 0), 'x');
  return { group: g, anchors: { 'Rod clamp': A(V(0, 0, 0), V(0, -1, 0)), Gear: A(V(-0.02, 0.08, 0), V(-1, 0, 0)) } };
}

function matteBoxModel(c: Ctx, lensR: number): Model {
  const { m } = c;
  const g = new THREE.Group();
  const s = Math.max(0.12, lensR * 2 + 0.05);
  const geo = new THREE.CylinderGeometry(s * 0.72, s * 0.5, 0.09, 4, 1, true);
  geo.rotateY(Math.PI / 4);
  geo.rotateX(Math.PI / 2);
  const hoodMat = (m.rubber as THREE.MeshStandardMaterial).clone();
  hoodMat.side = THREE.DoubleSide;
  const hood = mesh(geo, hoodMat, m);
  hood.position.z = 0.05;
  g.add(hood);
  rbox(g, m, m.metal, s * 0.75, s * 0.75, 0.03, 0, 0, 0, 0.004);
  rbox(g, m, m.rubber, s * 1.02, 0.003, 0.09, 0, s * 0.52, 0.06, 0.001);
  rbox(g, m, m.rubber, 0.003, s * 0.8, 0.08, s * 0.52, 0, 0.055, 0.001);
  rbox(g, m, m.rubber, 0.003, s * 0.8, 0.08, -s * 0.52, 0, 0.055, 0.001);
  return { group: g, anchors: { 'Rod clamp': A(V(0, -s * 0.4, 0), V(0, -1, 0)), 'Filter tray 1': A(V(0, s * 0.4, -0.006), V(0, 1, 0)), 'Filter tray 2': A(V(0, s * 0.4, 0.006), V(0, 1, 0)) } };
}

/** Tripod or monopod, the right way up: the plate on top, legs splaying out to the floor. */
function supportModel(c: Ctx, kind: 'tripod' | 'monopod'): Model {
  const { m } = c;
  const g = new THREE.Group();
  rbox(g, m, m.metal, 0.05, 0.008, 0.08, 0, -0.004, 0, 0.002);
  const floorY = -1.38;
  if (kind === 'tripod') {
    // Fluid head with tilt body, pan bar and a 75 mm bowl.
    rbox(g, m, m.body, 0.07, 0.05, 0.08, 0, -0.035, 0, 0.008);
    cyl(g, m, m.metal, 0.03, 0.03, V(0.04, -0.035, 0), 'x');
    cyl(g, m, m.body, 0.045, 0.035, V(0, -0.075, 0));
    rod(g, m, m.rubber, V(0, -0.04, -0.04), V(0.03, -0.11, -0.36), 0.009);
    const apexY = -0.1;
    const spread = 0.48;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
      const top = V(Math.cos(a) * 0.045, apexY, Math.sin(a) * 0.045);
      const foot = V(Math.cos(a) * spread, floorY, Math.sin(a) * spread);
      const knee = top.clone().lerp(foot, 0.48);
      rod(g, m, m.metal, top, knee, 0.012, 0.011);
      rod(g, m, m.metal, knee, foot, 0.009, 0.008);
      const clamp = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 12), m.rubber, m);
      clamp.position.copy(knee);
      clamp.quaternion.setFromUnitVectors(V(0, 1, 0), foot.clone().sub(top).normalize());
      g.add(clamp);
      const toe = mesh(new THREE.SphereGeometry(0.014, 12, 8), m.rubber, m);
      toe.position.copy(foot);
      g.add(toe);
      // Mid-level spreader to the centre.
      const spreadAt = top.clone().lerp(foot, 0.62);
      rod(g, m, m.metal, V(0, spreadAt.y, 0), spreadAt, 0.004);
    }
    cyl(g, m, m.metal, 0.02, 0.03, V(0, -0.11, 0));
  } else {
    cyl(g, m, m.body, 0.02, 0.04, V(0, -0.03, 0));
    rod(g, m, m.metal, V(0, -0.05, 0), V(0, -0.6, 0), 0.016, 0.015);
    rod(g, m, m.metal, V(0, -0.6, 0), V(0, -1.0, 0), 0.013, 0.012);
    rod(g, m, m.metal, V(0, -1.0, 0), V(0, floorY + 0.12, 0), 0.01, 0.009);
    cyl(g, m, m.rubber, 0.018, 0.14, V(0, -0.2, 0));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      rod(g, m, m.metal, V(0, floorY + 0.12, 0), V(Math.cos(a) * 0.1, floorY, Math.sin(a) * 0.1), 0.005);
    }
  }
  return { group: g, anchors: { 'Plate screw': A(V(0, 0, 0), V(0, 1, 0)) } };
}

function gimbalModel(c: Ctx): Model {
  const { m, W, D } = c;
  const g = new THREE.Group();
  const front = D * 0.25;
  const zc = front - D * 0.3;
  const back = zc - D * 0.45;
  rbox(g, m, m.metal, 0.05, 0.008, 0.09, 0, -0.004, 0, 0.002);
  // Tilt arm on the left at lens height, roll arm behind, pan motor and handle below.
  const tiltY = c.lensAxisY;
  rbox(g, m, m.body, 0.016, tiltY + 0.03, 0.03, -W / 2 - 0.035, (tiltY - 0.03) / 2, 0, 0.004);
  cyl(g, m, m.body, 0.025, 0.02, V(-W / 2 - 0.04, tiltY, 0), 'x');
  rbox(g, m, m.body, W / 2 + 0.05, 0.016, 0.03, -W / 4 - 0.02, -0.04, back - zc, 0.004);
  cyl(g, m, m.body, 0.026, 0.024, V(0.01, -0.04, back - zc - 0.005), 'z');
  rbox(g, m, m.body, 0.016, 0.06, 0.016, 0.01, -0.07, back - zc, 0.004);
  cyl(g, m, m.body, 0.028, 0.022, V(0.01, -0.1, back - zc));
  cyl(g, m, m.rubber, 0.021, 0.2, V(0.01, -0.22, back - zc), 'y', 0.019);
  cyl(g, m, m.accent, 0.005, 0.004, V(0.01, -0.13, back - zc + 0.02), 'z');
  return { group: g, anchors: { 'Quick-release plate': A(V(0, 0, 0), V(0, 1, 0)) } };
}

function monitorModel(g0: GearItem, c: Ctx): Model {
  const { m } = c;
  const g = new THREE.Group();
  const big = /7/.test(g0.model || g0.name);
  const [w, h] = big ? [0.18, 0.118] : [0.135, 0.088];
  const y = 0.016 + h / 2;
  rbox(g, m, m.body, w, h, 0.024, 0, y, 0, 0.006);
  rbox(g, m, m.screen, w * 0.9, h * 0.84, 0.002, 0, y, -0.0125, 0.002);
  for (let i = 0; i < 4; i++) cyl(g, m, m.plastic, 0.003, 0.003, V(-w * 0.35 + i * 0.012, y + h / 2 + 0.0015, 0.004));
  const ball = mesh(new THREE.SphereGeometry(0.009, 16, 12), m.metal, m);
  ball.position.y = 0.007;
  g.add(ball);
  const a: Record<string, Anchor> = { Mount: A(V(0, 0, 0), V(0, -1, 0)), Battery: A(V(0, y, 0.013), V(0, 0, 1)) };
  g0.ports.forEach((p, i) => {
    if (!a[p.name]) a[p.name] = A(V(w / 2, y - h * 0.3 + i * 0.012, 0), V(1, 0, 0));
  });
  return { group: g, anchors: a };
}

function batteryModel(g0: GearItem, c: Ctx): Model {
  const { m } = c;
  const g = new THREE.Group();
  if (g0.rigKind === 'battery-vmount') {
    rbox(g, m, m.body, 0.095, 0.135, 0.045, 0, 0, -0.0225, 0.008);
    for (let i = 0; i < 4; i++) rbox(g, m, m.accent, 0.012, 0.003, 0.002, -0.025 + i * 0.016, 0.05, -0.046, 0.0005);
    rbox(g, m, m.metal, 0.012, 0.008, 0.004, 0.03, -0.05, -0.046, 0.001);
    return { group: g, anchors: { Battery: A(V(0, 0, 0), V(0, 0, 1)), 'D-tap out': A(V(0.03, -0.05, -0.047), V(0, 0, -1)) } };
  }
  if (g0.rigKind === 'dummy-battery') {
    rbox(g, m, m.plastic, 0.035, 0.05, 0.02, 0, -0.025, 0, 0.003);
    return { group: g, anchors: { Battery: A(V(0, 0, 0), V(0, 1, 0)), 'D-tap in': A(V(0, -0.05, 0), V(0, -1, 0)) } };
  }
  rbox(g, m, m.body, 0.038, 0.055, 0.021, 0, -0.0275, 0, 0.003);
  return { group: g, anchors: { Battery: A(V(0, 0, 0), V(0, 1, 0)) } };
}

function vmountPlateModel(c: Ctx): Model {
  const { m } = c;
  const g = new THREE.Group();
  rbox(g, m, m.metal, 0.1, 0.14, 0.014, 0, 0, 0, 0.004);
  rbox(g, m, m.body, 0.06, 0.1, 0.004, 0, 0, -0.009, 0.002);
  for (const x of [-0.03, 0.03]) rbox(g, m, m.metal, 0.012, 0.01, 0.008, x, -0.062, -0.01, 0.001);
  rbox(g, m, m.metal, 0.03, 0.025, 0.03, 0, -0.085, 0.01, 0.003);
  return { group: g, anchors: { 'Rod clamp': A(V(0, -0.098, 0.01), V(0, 0, 1)), 'Cage screw': A(V(0, 0, 0.007), V(0, 0, 1)), Battery: A(V(0, 0, -0.011), V(0, 0, -1)), 'D-tap out 1': A(V(0.05, 0.04, 0), V(1, 0, 0)), 'D-tap out 2': A(V(0.05, 0.02, 0), V(1, 0, 0)) } };
}

function micModel(g0: GearItem, c: Ctx): Model {
  const { m } = c;
  const g = new THREE.Group();
  const len = g0.rigKind === 'mic-shotgun' ? 0.22 : 0.12;
  const y = 0.04;
  const mic = new THREE.Group();
  lathe(mic, m, m.body, [[0, -len / 2], [0.0095, -len / 2], [0.0105, -len / 2 + 0.01], [0.0105, len / 2 - 0.03], [0, len / 2 - 0.03]]);
  const foam = mesh(new THREE.CapsuleGeometry(0.018, 0.035, 6, 16), m.foam, m);
  foam.rotation.x = Math.PI / 2;
  foam.position.z = len / 2 - 0.02;
  mic.add(foam);
  mic.position.set(0, y, len / 2 - 0.04);
  g.add(mic);
  for (const z of [-0.025, 0.02]) {
    const ring = mesh(new THREE.TorusGeometry(0.016, 0.0018, 8, 24), m.plastic, m);
    ring.position.set(0, y, z + len / 2 - 0.04);
    g.add(ring);
  }
  rbox(g, m, m.plastic, 0.012, y - 0.004, 0.02, 0, (y - 0.004) / 2 + 0.002, 0, 0.002);
  rbox(g, m, m.metal, 0.018, 0.003, 0.018, 0, 0.0015, 0, 0.001);
  const a: Record<string, Anchor> = {};
  for (const p of g0.ports) a[p.name] = p.signal === 'mount' ? A(V(0, 0, 0), V(0, -1, 0)) : A(V(0, y, -0.03), V(0, 0, -1));
  return { group: g, anchors: a };
}

function boxyModel(g0: GearItem, c: Ctx, size: [number, number, number], antenna = false): Model {
  const { m } = c;
  const g = new THREE.Group();
  const [w, h, d] = size;
  rbox(g, m, m.body, w, h, d, 0, h / 2 + 0.004, 0, 0.004);
  rbox(g, m, m.screen, w * 0.6, h * 0.35, 0.002, 0, h * 0.62, -d / 2 - 0.001, 0.001);
  if (antenna) for (const x of [-w * 0.3, w * 0.3]) rod(g, m, m.rubber, V(x, h + 0.004, -d * 0.2), V(x * 1.4, h + 0.06, -d * 0.3), 0.003);
  rbox(g, m, m.metal, Math.min(0.018, w), 0.004, 0.018, 0, 0.002, 0, 0.001);
  const a: Record<string, Anchor> = {};
  g0.ports.forEach((p, i) => {
    a[p.name] = p.signal === 'mount' ? A(V(0, 0, 0), V(0, -1, 0)) : A(V(-w / 2, h * (0.3 + 0.15 * (i % 4)), 0), V(-1, 0, 0));
  });
  return { group: g, anchors: a };
}

function coilModel(c: Ctx, colour: number): Model {
  const g = new THREE.Group();
  const mat = c.m.edges ? c.m.body : new THREE.MeshStandardMaterial({ color: 0x151517, roughness: 0.7 });
  for (let i = 0; i < 3; i++) {
    const t = mesh(new THREE.TorusGeometry(0.04 - i * 0.004, 0.004, 8, 40), mat, c.m);
    t.rotation.x = Math.PI / 2;
    t.position.y = 0.004 + i * 0.006;
    g.add(t);
  }
  rbox(g, c.m, new THREE.MeshStandardMaterial({ color: colour, roughness: 0.5 }), 0.012, 0.008, 0.02, 0.04, 0.008, 0, 0.002);
  return { group: g, anchors: {} };
}

/** The 3D model of a part, with its mounting points. */
function modelFor(g: GearItem, c: Ctx, lensR: number): Model {
  const k = g.rigKind ?? '';
  if (g.category === 'lens') return lensModel(g, c);
  if (g.category === 'adapter') return adapterModel(g, c);
  if (k === 'filter') return filterModel(g, c);
  if (k === 'filter-tray') {
    const gg = new THREE.Group();
    rbox(gg, c.m, c.m.glass, 0.1, 0.143, 0.004, 0, 0.0715, 0, 0.001);
    return { group: gg, anchors: { Tray: A(V(0, 0, 0), V(0, -1, 0)) } };
  }
  if (k === 'cage') return cageModel(c);
  if (k === 'top-handle') return topHandleModel(c);
  if (k === 'side-handle') return sideHandleModel(c);
  if (k === 'nato-rail') return natoModel(c);
  if (k === 'arm') return armModel(c);
  if (k === 'rod-plate') return rodPlateModel(c);
  if (k === 'follow-focus') return followFocusModel(c);
  if (k === 'matte-box') return matteBoxModel(c, lensR);
  if (k === 'tripod' || k === 'monopod') return supportModel(c, k);
  if (k === 'gimbal') return gimbalModel(c);
  if (g.category === 'monitor') return monitorModel(g, c);
  if (k === 'vmount-plate') return vmountPlateModel(c);
  if (g.category === 'battery') return batteryModel(g, c);
  if (k === 'mic-oncam' || k === 'mic-shotgun') return micModel(g, c);
  if (k === 'wireless-rx' || k === 'wireless-tx') return boxyModel(g, c, [0.045, 0.06, 0.018], true);
  if (k === 'video-tx' || k === 'video-rx') return boxyModel(g, c, [0.075, 0.03, 0.1], true);
  if (k === 'recorder') return boxyModel(g, c, [0.12, 0.045, 0.08]);
  if (g.category === 'cable') return coilModel(c, /hdmi|sdi/i.test(g.name) ? SIGNAL.video : /xlr|trs/i.test(g.name) ? SIGNAL.audio : SIGNAL.power);
  return boxyModel(g, c, [0.06, 0.04, 0.05]);
}

/* ---------- Placement ---------- */

/** Parts on this camera's rig (and its lens). */
export function rigParts(cam: GearItem, gear: GearItem[]): GearItem[] {
  return gear.filter((g) => g.id !== cam.id && (g.rigOf === cam.id || cameraConfig(cam).lensGearId === g.id));
}

/** For a mechanical connection, which side is the host? Batteries plug into their host from the "out" side. */
function hostChild(c: Connection, byId: Map<string, GearItem>): { host: string; hostPort: string; child: string; childPort: string } | null {
  const from = byId.get(c.fromGear);
  const fp = from?.ports.find((p) => p.id === c.fromPort);
  if (!fp) return null;
  if (fp.connector === 'Battery plate') return { host: c.toGear, hostPort: c.toPort, child: c.fromGear, childPort: c.fromPort };
  if (fp.signal !== 'mount') return null;
  if (fp.connector === 'Focus ring') return null; // the follow focus engages the lens but hangs from the rods
  return { host: c.fromGear, hostPort: c.fromPort, child: c.toGear, childPort: c.toPort };
}

const UPRIGHT = new Set(['monitor', 'top-handle', 'mic-oncam', 'mic-shotgun', 'wireless-rx', 'video-tx', 'video-rx', 'recorder', 'arm', 'nato-rail']);

export interface BuiltRig {
  root: THREE.Group;
  parts: RigPart[];
  /** Free mounting points, in rig space. */
  spots: { hostId: string; port: GearPort; pos: THREE.Vector3; normal: THREE.Vector3 }[];
  /** Box around the camera and everything on it, without legs. */
  focus: THREE.Box3;
  floorY: number;
}

export function buildRig(cam: GearItem, gear: GearItem[], connections: Connection[], style: RigStyle = 'real', light = false): BuiltRig {
  const root = new THREE.Group();
  const cfg = cameraConfig(cam);
  const body = bodyOf(cfg);
  const m = materials(style, light);
  const [W, H, D] = body.size.map(mm);
  const lensAxisY = body.type === 'phone' ? H * 0.82 : body.type === 'cinema' || body.type === 'camcorder' ? H * 0.5 : H * 0.42;
  const ctx: Ctx = { m, body, W, H, D, lensAxisY };
  const items = rigParts(cam, gear);
  const all = [cam, ...items];
  const byId = new Map(all.map((g) => [g.id, g]));
  const lensItem = items.find((g) => g.id === cfg.lensGearId) ?? items.find((g) => g.category === 'lens');
  const lensR = lensItem ? mm(lensItem.lens?.diameter ?? LENSES.find((l) => l.model === lensItem.lens?.model)?.diameter ?? 74) / 2 : 0.035;

  const models = new Map<string, Model>();
  models.set(cam.id, bodyModel(cam, ctx));
  for (const g of items) models.set(g.id, modelFor(g, ctx, lensR));

  // Who hangs from whom, from the real connections.
  const links = connections.map((c) => hostChild(c, byId)).filter((x): x is NonNullable<typeof x> => !!x && byId.has(x.host) && byId.has(x.child));
  const parentOf = new Map<string, (typeof links)[number]>();
  for (const l of links) if (!parentOf.has(l.child) && l.child !== cam.id) parentOf.set(l.child, l);

  const placed = new Map<string, THREE.Object3D>();
  const camObj = models.get(cam.id)!.group;
  root.add(camObj);
  placed.set(cam.id, camObj);

  const portName = (gid: string, pid: string) => byId.get(gid)?.ports.find((p) => p.id === pid)?.name ?? '';
  const anchorWorld = (gid: string, name: string): Anchor | null => {
    const o = placed.get(gid);
    const a = models.get(gid)?.anchors[name];
    if (!o || !a) return null;
    o.updateMatrixWorld(true);
    const q = new THREE.Quaternion();
    o.getWorldQuaternion(q);
    return { pos: a.pos.clone().applyMatrix4(o.matrixWorld), normal: a.normal.clone().applyQuaternion(q), inside: a.inside };
  };

  const place = (id: string, depth = 0): boolean => {
    if (placed.has(id)) return true;
    const l = parentOf.get(id);
    if (!l || depth > 12) return false;
    if (!place(l.host, depth + 1)) return false;
    const g = byId.get(id)!;
    const model = models.get(id)!;
    const o = model.group;
    const k = g.rigKind ?? '';
    const host = anchorWorld(l.host, portName(l.host, l.hostPort)) ?? anchorWorld(l.host, 'shoe');
    if (!host) return false;
    const own = model.anchors[portName(id, l.childPort)] ?? Object.values(model.anchors)[0] ?? A(V(0, 0, 0), V(0, -1, 0));
    // Turn the part so its mounting face meets the host's, unless it should stay upright.
    const q = new THREE.Quaternion().setFromUnitVectors(own.normal.clone(), host.normal.clone().negate());
    const tilted = 2 * Math.acos(Math.min(1, Math.abs(q.w))) > 0.01;
    const upright = UPRIGHT.has(k) && tilted;
    if (upright) q.identity();
    const turn = THREE.MathUtils.degToRad(g.rigPos?.ry ?? 0);
    if (turn) q.premultiply(new THREE.Quaternion().setFromAxisAngle(host.normal.clone(), turn));
    o.quaternion.copy(q);
    if (upright) {
      // Upright parts on a side mount sit beside the face, centred on the mounting point.
      o.position.set(0, 0, 0);
      o.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(o);
      const centre = bb.getCenter(V(0, 0, 0));
      const half = bb.getSize(V(0, 0, 0)).multiplyScalar(0.5);
      const n = host.normal;
      const face = centre.clone().sub(V(n.x * half.x, n.y * half.y, n.z * half.z));
      o.position.copy(host.pos).sub(face);
    } else {
      o.position.copy(host.pos).sub(own.pos.clone().applyQuaternion(q));
    }
    if (host.inside)
      o.traverse((n) => {
        if (n instanceof THREE.Mesh) {
          const mat = (n.material as THREE.Material).clone();
          mat.transparent = true;
          mat.opacity = 0.35;
          n.material = mat;
        }
      });
    root.add(o);
    placed.set(id, o);
    return true;
  };
  for (const g of items) place(g.id);

  // Lens-aligned accessories follow the lens, wherever their clamp is.
  const lensFront = lensItem ? anchorWorld(lensItem.id, '_front') : null;
  if (lensFront)
    for (const g of items) {
      const o = placed.get(g.id);
      if (!o) continue;
      if (g.rigKind === 'follow-focus') o.position.set(lensR + 0.035, lensFront.pos.y - 0.065, lensFront.pos.z - 0.05);
      if (g.rigKind === 'matte-box') o.position.set(0, lensFront.pos.y, lensFront.pos.z + 0.02);
    }

  // Everything not mounted waits on a tray to the right.
  let trayX = W / 2 + 0.2;
  for (const g of items) {
    if (placed.has(g.id)) continue;
    const o = models.get(g.id)!.group;
    o.userData.tray = true;
    root.add(o);
    o.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(o);
    const w = Math.max(0.05, bb.max.x - bb.min.x);
    o.position.set(trayX - bb.min.x, -bb.min.y, 0.05 - (bb.min.z + bb.max.z) / 2);
    trayX += w + 0.05;
    placed.set(g.id, o);
  }

  // Parts with label points.
  const parts: RigPart[] = [];
  const focus = new THREE.Box3();
  let floorY = 0;
  root.updateMatrixWorld(true);
  for (const g of all) {
    const o = placed.get(g.id)!;
    o.traverse((n) => (n.userData.gearId = g.id));
    const bb = new THREE.Box3().setFromObject(o);
    const support = ['tripod', 'monopod'].includes(g.rigKind ?? '');
    if (!support && !o.userData.tray) focus.union(bb);
    floorY = Math.min(floorY, bb.min.y);
    const label = support ? V(bb.max.x + 0.02, Math.max(bb.min.y, -0.45), (bb.min.z + bb.max.z) / 2) : V((bb.min.x + bb.max.x) / 2, bb.max.y + 0.012, (bb.min.z + bb.max.z) / 2);
    parts.push({ id: g.id, name: g.name.replace(/^Camera [A-Z] · /, ''), object: o, label, mounted: g.id === cam.id || !o.userData.tray, support });
  }

  // Free mounting points (where something could go).
  const spots: BuiltRig['spots'] = [];
  const used = new Set(connections.flatMap((c) => [`${c.fromGear}:${c.fromPort}`, `${c.toGear}:${c.toPort}`]));
  for (const g of all) {
    const o = placed.get(g.id)!;
    if (o.userData.tray) continue;
    for (const p of g.ports) {
      if (used.has(`${g.id}:${p.id}`)) continue;
      const mountOut = p.dir === 'out' && p.signal === 'mount' && p.connector !== 'Focus ring';
      const slot = p.dir === 'in' && p.connector === 'Battery plate';
      if (!mountOut && !slot) continue;
      const a = anchorWorld(g.id, p.name);
      if (a) spots.push({ hostId: g.id, port: p, pos: a.pos, normal: a.normal });
    }
  }

  // Cables between ports: coloured plugs on a dark cable (or coloured lines in blueprint).
  for (const c of connections) {
    const from = byId.get(c.fromGear);
    const to = byId.get(c.toGear);
    const fp = from?.ports.find((p) => p.id === c.fromPort);
    const tp = to?.ports.find((p) => p.id === c.toPort);
    if (!from || !to || !fp || !tp || fp.signal === 'mount' || fp.connector === 'Battery plate' || fp.connector === 'Wireless') continue;
    const a = anchorWorld(from.id, fp.name) ?? centreOf(placed.get(from.id));
    const b = anchorWorld(to.id, tp.name) ?? centreOf(placed.get(to.id));
    if (!a || !b) continue;
    const out = Math.max(0.04, a.pos.distanceTo(b.pos) * 0.3);
    const p1 = a.pos.clone().add(a.normal.clone().multiplyScalar(out));
    const p2 = b.pos.clone().add(b.normal.clone().multiplyScalar(out));
    p1.y -= 0.02;
    p2.y -= 0.02;
    const curve = new THREE.CubicBezierCurve3(a.pos, p1, p2, b.pos);
    const colour = SIGNAL[fp.signal];
    const cableMat = style === 'blueprint' ? new THREE.MeshBasicMaterial({ color: colour }) : new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.6 });
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.0025, 8), cableMat);
    tube.castShadow = true;
    root.add(tube);
    if (style !== 'blueprint')
      for (const [pt, n] of [[a.pos, a.normal], [b.pos, b.normal]] as const) {
        const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.014, 12), new THREE.MeshStandardMaterial({ color: colour, roughness: 0.45 }));
        plug.position.copy(pt).add(n.clone().multiplyScalar(0.007));
        plug.quaternion.setFromUnitVectors(V(0, 1, 0), n.clone());
        root.add(plug);
      }
  }
  if (focus.isEmpty()) focus.setFromObject(camObj);
  return { root, parts, spots, focus, floorY };
}

function centreOf(o?: THREE.Object3D): Anchor | null {
  if (!o) return null;
  const bb = new THREE.Box3().setFromObject(o);
  return { pos: bb.getCenter(V(0, 0, 0)), normal: V(-1, 0, 0) };
}

/** Free mounting points a part could move to. */
export function mountOptions(partId: string, cam: GearItem, gear: GearItem[], built: BuiltRig): MountSpot[] {
  const part = gear.find((g) => g.id === partId);
  if (!part || part.id === cam.id) return [];
  const all = [cam, ...rigParts(cam, gear)];
  const probe = { ...part, rigOf: part.rigOf ?? cam.id };
  const out: MountSpot[] = [];
  for (const s of built.spots) {
    if (s.hostId === partId) continue;
    const host = all.find((g) => g.id === s.hostId);
    if (!host) continue;
    const ok = part.ports.some((p) => (s.port.dir === 'out' && p.dir === 'in' ? check(host, s.port, probe, p).ok : s.port.dir === 'in' && p.dir === 'out' && p.connector === 'Battery plate' ? check(probe, p, host, s.port).ok : false));
    if (ok) out.push({ hostId: s.hostId, portId: s.port.id, label: `${host.name.replace(/^Camera [A-Z] · /, '')} · ${s.port.name}`, pos: s.pos });
  }
  return out;
}

/** The connection list after moving a part onto a mounting point (its old mount comes off, its cables stay). */
export function moveTo(partId: string, spot: Pick<MountSpot, 'hostId' | 'portId'>, gear: GearItem[], connections: Connection[], newId: () => string): Connection[] {
  const part = gear.find((g) => g.id === partId);
  const host = gear.find((g) => g.id === spot.hostId);
  const hostPort = host?.ports.find((p) => p.id === spot.portId);
  if (!part || !host || !hostPort) return connections;
  const byId = new Map(gear.map((g) => [g.id, g]));
  const kept = connections.filter((c) => hostChild(c, byId)?.child !== partId);
  if (hostPort.dir === 'in') {
    const bp = part.ports.find((p) => p.dir === 'out' && p.connector === 'Battery plate');
    return bp ? [...kept, { id: newId(), fromGear: partId, fromPort: bp.id, toGear: host.id, toPort: hostPort.id, notes: '' }] : connections;
  }
  const probe = { ...part, rigOf: part.rigOf ?? rigKey(host) };
  const pp = part.ports.find((p) => p.dir === 'in' && check(host, hostPort, probe, p).ok);
  return pp ? [...kept, { id: newId(), fromGear: host.id, fromPort: hostPort.id, toGear: partId, toPort: pp.id, notes: '' }] : connections;
}

/** Take a part off its mount (back to the tray) along with anything mounted on it; cables stay. */
export function unmount(partId: string, gear: GearItem[], connections: Connection[]): Connection[] {
  const byId = new Map(gear.map((g) => [g.id, g]));
  return connections.filter((c) => {
    const hc = hostChild(c, byId);
    return !(hc && hc.child === partId);
  });
}

/* ---------- Scene setup ---------- */

export function setupRigScene(scene: THREE.Scene, renderer: THREE.WebGLRenderer, style: RigStyle, light = false): THREE.Object3D[] {
  const added: THREE.Object3D[] = [];
  scene.background = new THREE.Color(style === 'blueprint' ? (light ? 0xf4f2ea : RIG_INK.bg) : light ? 0xf4f2ea : 0x161618);
  if (style === 'real') {
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-1.2, 2.2, 1.6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -1, right: 1, top: 1, bottom: -1.6, near: 0.1, far: 6 });
    key.shadow.bias = -0.0004;
    added.push(key, new THREE.HemisphereLight(0xffffff, 0x303030, 0.4));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  } else {
    scene.environment = null;
    const d = new THREE.DirectionalLight(0xffffff, 1.6);
    d.position.set(1, 2, 1.5);
    added.push(new THREE.HemisphereLight(0xffffff, 0x404040, 2.2), d);
    renderer.toneMapping = THREE.NoToneMapping;
  }
  for (const o of added) scene.add(o);
  return added;
}

/** Floor under the rig: a grid in blueprint, a soft shadow-catching floor in the realistic style. */
export function makeFloor(style: RigStyle, y: number, light = false): THREE.Object3D {
  const g = new THREE.Group();
  if (style === 'blueprint') {
    g.add(new THREE.GridHelper(4, 80, light ? 0xc9c5b8 : RIG_INK.grid, light ? 0xdcd8cc : RIG_INK.grid));
  } else {
    const floor = new THREE.Mesh(new THREE.CircleGeometry(3, 64), new THREE.MeshStandardMaterial({ color: light ? 0xe9e6dd : 0x1f1f22, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);
    const grid = new THREE.GridHelper(4, 40, light ? 0xd6d2c4 : 0x2a2a2e, light ? 0xd6d2c4 : 0x2a2a2e);
    grid.position.y = 0.0005;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.35;
    g.add(grid);
  }
  g.position.y = y - 0.001;
  return g;
}

/** Frame a box from a three-quarter front view. */
export function frameBox(camera: THREE.PerspectiveCamera, box: THREE.Box3, target: THREE.Vector3, fill = 1.45) {
  const c = box.getCenter(V(0, 0, 0));
  const size = box.getSize(V(0, 0, 0)).length();
  target.copy(c);
  const dist = Math.max(0.25, size * fill) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  camera.position.copy(c).add(V(-0.75, 0.45, 1).normalize().multiplyScalar(dist));
  camera.lookAt(c);
}

/** A still of the rig with labels, for the PDF. Returns a PNG data URL, or null without WebGL. */
export function renderRigPng(cam: GearItem, gear: GearItem[], connections: Connection[], w = 1200, h = 800, light = true): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(w, h, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    setupRigScene(scene, renderer, 'real', light);
    const built = buildRig(cam, gear, connections, 'real', light);
    scene.add(built.root);
    scene.add(makeFloor('real', built.floorY, light));
    const camera = new THREE.PerspectiveCamera(30, w / h, 0.01, 50);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Frame the camera and everything on it; legs run out of frame below.
    const box = built.focus.clone();
    for (const p of built.parts) if (!p.mounted) box.union(new THREE.Box3().setFromObject(p.object));
    frameBox(camera, box, V(0, 0, 0), 1.2);
    renderer.render(scene, camera);
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ctx = out.getContext('2d')!;
    ctx.drawImage(canvas, 0, 0);
    ctx.font = `${Math.round(w / 72)}px "IBM Plex Mono", monospace`;
    ctx.textBaseline = 'middle';
    // Callouts in two columns, left and right of the rig, with elbow leaders to each part's centre.
    const pts = built.parts
      .map((p) => {
        const c = new THREE.Box3().setFromObject(p.object).getCenter(V(0, 0, 0));
        if (p.support) c.copy(p.label);
        const v = c.project(camera);
        return { p, x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, ok: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 };
      })
      .filter((q) => q.ok);
    const mid = pts.reduce((a, q) => a + q.x, 0) / Math.max(1, pts.length);
    const rowH = w / 42;
    for (const side of ['left', 'right'] as const) {
      const col = pts.filter((q) => (side === 'left' ? q.x <= mid : q.x > mid)).sort((a, b) => a.y - b.y);
      // Spread rows so they never overlap, staying near each part's height.
      const ys: number[] = [];
      for (const q of col) ys.push(Math.max(q.y, (ys[ys.length - 1] ?? -Infinity) + rowH));
      const over = (ys[ys.length - 1] ?? 0) - (h - rowH);
      if (over > 0) for (let i = 0; i < ys.length; i++) ys[i] -= over;
      col.forEach((q, i) => {
        const text = q.p.mounted ? q.p.name : `${q.p.name} (not mounted)`;
        const tw = ctx.measureText(text).width + 10;
        const y = Math.max(rowH, ys[i]);
        const x = side === 'left' ? w * 0.03 : w * 0.97 - tw;
        const elbow = side === 'left' ? x + tw + w * 0.03 : x - w * 0.03;
        ctx.strokeStyle = '#0b0b0c';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(side === 'left' ? x + tw : x, y);
        ctx.lineTo(elbow, y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
        ctx.fillStyle = '#0b0b0c';
        ctx.beginPath();
        ctx.arc(q.x, q.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = q.p.mounted ? '#ffc400' : '#e4e1d6';
        ctx.fillRect(x, y - rowH * 0.42, tw, rowH * 0.84);
        ctx.fillStyle = '#0b0b0c';
        ctx.fillText(text, x + 5, y);
      });
    }
    renderer.dispose();
    renderer.forceContextLoss();
    return out.toDataURL('image/png');
  } catch {
    return null;
  }
}
