import * as THREE from 'three';
import type { Connection, GearItem, SignalKind } from '@/types/project';
import { bodyOf } from '@/lib/camera/bodies';
import { LENSES } from '@/lib/camera/lenses';
import { cameraConfig } from '@/lib/camera/settings';

/** Colours of the blueprint rig drawing. */
export const RIG_INK = { bg: 0x0b0b0c, fill: 0x1d1d20, edge: 0xe9e6dc, sel: 0xffc400, grid: 0x2a2a2e };
const SIGNAL: Record<SignalKind, number> = { audio: 0x6f9fd0, video: 0xffc400, timecode: 0xa7a59d, power: 0xe0564c, data: 0x9a9a9e, mount: 0xe9e6dc };

export interface RigPart {
  id: string;
  name: string;
  object: THREE.Object3D;
  /** Where its label sits, in rig space. */
  label: THREE.Vector3;
  /** Default spot before anyone moves it. */
  home: THREE.Vector3;
  loose: boolean;
}

const mm = (v: number) => v / 1000;

function solid(geo: THREE.BufferGeometry, edgeColour = RIG_INK.edge, opacity = 1): THREE.Mesh {
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: RIG_INK.fill, transparent: opacity < 1, opacity }));
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: edgeColour }));
  e.userData.edge = true;
  m.add(e);
  return m;
}
const box = (w: number, h: number, d: number, op = 1) => solid(new THREE.BoxGeometry(w, h, d), RIG_INK.edge, op);
/** A cylinder along z (lenses, filters, rods). */
function tube(r: number, len: number, seg = 28) {
  const m = solid(new THREE.CylinderGeometry(r, r, len, seg));
  m.rotation.x = Math.PI / 2;
  const g = new THREE.Group();
  g.add(m);
  return g;
}

export function rigParts(cam: GearItem, gear: GearItem[]): GearItem[] {
  return gear.filter((g) => g.id !== cam.id && (g.rigOf === cam.id || cameraConfig(cam).lensGearId === g.id));
}

/**
 * Build the rig in metres: x to camera right, y up, z towards the subject (out of the lens).
 * Sizes come from the body and lens databases; accessories use typical real sizes.
 */
export function buildRig(cam: GearItem, gear: GearItem[], connections: Connection[]) {
  const root = new THREE.Group();
  const parts: RigPart[] = [];
  const cfg = cameraConfig(cam);
  const b = bodyOf(cfg);
  const [W, H, D] = b.size.map(mm);
  const items = rigParts(cam, gear);
  const has = (k: string) => items.some((g) => (g.rigKind ?? '') === k);
  const count: Record<string, number> = {};
  let looseX = W / 2 + 0.22;

  // Body with a lens-mount ring.
  const bodyObj = new THREE.Group();
  const shell = box(W, H, D);
  shell.position.set(0, H / 2, 0);
  bodyObj.add(shell);
  const ring = tube(mm(b.mount === 'MFT' ? 26 : b.mount === 'EF' ? 30 : 29), 0.006);
  ring.position.set(0, H * 0.48, D / 2 + 0.003);
  bodyObj.add(ring);
  if (b.type === 'dslr' || b.type === 'mirrorless') {
    const grip = box(mm(30), H * 0.9, D * 1.25);
    grip.position.set(W / 2 - mm(15), H * 0.45, D * 0.12);
    bodyObj.add(grip);
  }
  root.add(bodyObj);
  parts.push({ id: cam.id, name: cam.name, object: bodyObj, label: new THREE.Vector3(-W / 2, H + 0.02, 0), home: new THREE.Vector3(), loose: false });

  // Lens chain along z.
  let front = D / 2 + 0.006;
  const lensAxisY = H * 0.48;
  let lensR = 0.035;
  for (const g of items.filter((x) => x.category === 'adapter')) {
    const len = g.model.toLowerCase().includes('speed') ? 0.03 : 0.026;
    const o = tube(0.032, len);
    o.position.set(0, lensAxisY, front + len / 2);
    front += len;
    add(g, o, new THREE.Vector3(0.04, lensAxisY + 0.04, 0));
  }
  const lensItem = items.find((x) => x.category === 'lens' && x.id === cfg.lensGearId) ?? items.find((x) => x.category === 'lens');
  if (lensItem) {
    const def = LENSES.find((l) => lensItem.lens && l.model === lensItem.lens.model);
    const len = mm(def?.length ?? 90);
    lensR = mm(def?.diameter ?? 74) / 2;
    const o = new THREE.Group();
    const barrel = tube(lensR, len);
    barrel.position.z = len / 2;
    o.add(barrel);
    const focus = tube(lensR + 0.002, len * 0.18);
    focus.position.z = len * 0.62;
    o.add(focus);
    o.position.set(0, lensAxisY, front);
    front += len;
    add(lensItem, o, new THREE.Vector3(0, lensAxisY + lensR + 0.025, front - len / 2));
  }
  for (const g of items.filter((x) => x.category === 'filter')) {
    if (g.rigKind === 'filter-tray') continue;
    const o = tube(lensR + 0.004, 0.012);
    o.position.set(0, lensAxisY, front + 0.006);
    front += 0.012;
    add(g, o, new THREE.Vector3(-lensR - 0.03, lensAxisY - 0.05, front));
  }

  const cageT = has('cage') ? 0.012 : 0;
  const top = H + cageT;
  for (const g of items) {
    if (['lens', 'adapter'].includes(g.category) || (g.category === 'filter' && g.rigKind !== 'filter-tray')) continue;
    const k = g.rigKind ?? g.category;
    const n = (count[k] = (count[k] ?? 0) + 1) - 1;
    let o: THREE.Object3D | undefined;
    let label: THREE.Vector3 | null = null;
    switch (k) {
      case 'cage': {
        const geo = new THREE.BoxGeometry(W + cageT * 2, H + cageT * 2, D + 0.014);
        const c = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: RIG_INK.edge }));
        c.userData.edge = true;
        const frame = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: RIG_INK.edge, transparent: true, opacity: 0.06, depthWrite: false }));
        frame.add(c);
        frame.position.set(0, H / 2, 0);
        o = new THREE.Group();
        o.add(frame);
        label = new THREE.Vector3(W / 2 + cageT, H, -D / 2);
        break;
      }
      case 'nato-rail':
        o = box(0.02, 0.008, 0.07);
        o.position.set(-0.03 + n * 0.035, top + 0.004, 0);
        break;
      case 'top-handle': {
        const g2 = new THREE.Group();
        const grip = box(0.03, 0.03, 0.15);
        grip.position.y = 0.05;
        const leg1 = box(0.02, 0.04, 0.02);
        leg1.position.set(0, 0.02, -0.05);
        const leg2 = box(0.02, 0.04, 0.02);
        leg2.position.set(0, 0.02, 0.05);
        g2.add(grip, leg1, leg2);
        g2.position.set(0, top + (has('nato-rail') ? 0.008 : 0), 0);
        o = g2;
        break;
      }
      case 'side-handle':
        o = box(0.035, 0.12, 0.045);
        o.position.set(-(W / 2 + cageT + 0.03), H * 0.5, 0);
        break;
      case 'arm': {
        const a = tube(0.008, 0.12);
        a.rotation.x = -Math.PI / 3;
        a.position.set(W / 2 - 0.01, top + 0.055, -0.02);
        o = a;
        break;
      }
      case 'monitor': {
        const big = g.model.includes('7');
        const [mw, mh] = big ? [0.18, 0.12] : [0.13, 0.085];
        const grp = new THREE.Group();
        grp.add(box(mw, mh, 0.025));
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(mw * 0.88, mh * 0.82), new THREE.MeshBasicMaterial({ color: 0x3a3a3e }));
        screen.position.z = -0.0131;
        screen.rotation.y = Math.PI;
        grp.add(screen);
        const lift = has('arm') ? 0.11 : has('top-handle') ? 0.1 : 0.03;
        grp.position.set(has('arm') ? W / 2 + 0.03 : 0, top + lift + mh / 2, -D / 2 - 0.01);
        grp.rotation.x = -0.12;
        o = grp;
        break;
      }
      case 'rod-plate': {
        const grp = new THREE.Group();
        const plate = box(0.1, 0.02, 0.12);
        plate.position.y = -0.01;
        grp.add(plate);
        for (const sx of [-0.03, 0.03]) {
          const r = tube(0.0075, 0.35);
          r.position.set(sx, -0.03, 0.1);
          grp.add(r);
        }
        grp.position.y = -cageT;
        o = grp;
        label = new THREE.Vector3(-0.06, -0.06, 0.25);
        break;
      }
      case 'follow-focus': {
        const grp = new THREE.Group();
        grp.add(box(0.045, 0.07, 0.04));
        const wheel = tube(0.03, 0.008);
        wheel.rotation.z = Math.PI / 2;
        wheel.rotation.y = Math.PI / 2;
        wheel.position.x = 0.03;
        grp.add(wheel);
        grp.position.set(lensR + 0.025, lensAxisY - lensR * 0.6, D / 2 + 0.06);
        o = grp;
        break;
      }
      case 'matte-box': {
        const grp = new THREE.Group();
        const s = Math.max(0.12, lensR * 2 + 0.05);
        const back = box(s, s * 0.8, 0.03);
        grp.add(back);
        const flagT = box(s, 0.004, 0.08);
        flagT.position.set(0, s * 0.4, 0.05);
        grp.add(flagT);
        grp.position.set(0, lensAxisY, front + 0.03);
        o = grp;
        break;
      }
      case 'filter-tray':
        o = box(0.1, 0.143, 0.004);
        o.position.set(0, lensAxisY + 0.02, front + 0.04);
        break;
      case 'vmount-plate':
        o = box(0.09, 0.12, 0.015);
        o.position.set(0, H * 0.5, -D / 2 - cageT - 0.03);
        break;
      case 'battery-vmount':
        o = box(0.09, 0.13, 0.05);
        o.position.set(0, H * 0.5, -D / 2 - cageT - (has('vmount-plate') ? 0.065 : 0.04));
        break;
      case 'battery':
        // Sits inside the body: drawn faint where the slot is.
        o = box(0.038, 0.055, 0.02, 0.5);
        o.position.set(W / 2 - 0.022 - n * 0.045, H * 0.32, 0);
        label = new THREE.Vector3(W / 2 + 0.03, H * 0.15, -D / 2);
        break;
      case 'tripod': {
        const grp = new THREE.Group();
        const head = box(0.11, 0.08, 0.11);
        head.position.y = -0.04;
        grp.add(head);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.009, 0.6, 10), new THREE.MeshLambertMaterial({ color: RIG_INK.fill }));
          leg.add(Object.assign(new THREE.LineSegments(new THREE.EdgesGeometry(leg.geometry, 40), new THREE.LineBasicMaterial({ color: RIG_INK.edge })), { userData: { edge: true } }));
          leg.position.set(Math.cos(a) * 0.1, -0.38, Math.sin(a) * 0.1);
          leg.rotation.set(Math.sin(a) * 0.33, 0, -Math.cos(a) * 0.33);
          grp.add(leg);
        }
        grp.position.y = -cageT - (has('rod-plate') ? 0.04 : 0);
        o = grp;
        label = new THREE.Vector3(0.13, -0.3, 0);
        break;
      }
      case 'monopod': {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.6, 12), new THREE.MeshLambertMaterial({ color: RIG_INK.fill }));
        m.position.y = -0.3 - cageT;
        o = m;
        break;
      }
      case 'gimbal': {
        const grp = new THREE.Group();
        const v = box(0.03, H + 0.15, 0.04);
        v.position.set(-(W / 2 + 0.05), H / 2, -0.02);
        const t = box(W / 2 + 0.05, 0.03, 0.04);
        t.position.set(-(W / 4 + 0.025), -0.03, -0.02);
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 16), new THREE.MeshLambertMaterial({ color: RIG_INK.fill }));
        handle.position.set(0, -0.18, -0.02);
        grp.add(v, t, handle);
        o = grp;
        label = new THREE.Vector3(-(W / 2 + 0.07), H + 0.1, 0);
        break;
      }
      case 'mic-oncam':
      case 'mic-shotgun': {
        const len = k === 'mic-shotgun' ? 0.22 : 0.12;
        const grp = new THREE.Group();
        grp.add(tube(0.011, len));
        const mount = box(0.02, 0.025, 0.02);
        mount.position.y = -0.02;
        grp.add(mount);
        grp.position.set(-0.025 + n * 0.03, top + (has('top-handle') ? 0.1 : 0.035), len / 2 - 0.02);
        o = grp;
        break;
      }
      case 'wireless-rx':
      case 'video-tx':
      case 'video-rx': {
        const [bw, bh, bd] = k === 'wireless-rx' ? [0.045, 0.06, 0.02] : [0.07, 0.03, 0.1];
        o = box(bw, bh, bd);
        o.position.set(-W / 2 + 0.03 - n * 0.05, top + bh / 2 + 0.01, k === 'wireless-rx' ? -0.03 : -D / 2);
        break;
      }
      case 'recorder':
        o = box(0.1, 0.045, 0.07);
        o.position.set(W / 2 + cageT + 0.06, H * 0.3, 0);
        break;
      default: {
        // Carried with the camera but not bolted on: laid out to the side.
        if (g.category === 'cable') {
          const t = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.005, 8, 32), new THREE.MeshLambertMaterial({ color: RIG_INK.fill }));
          t.add(Object.assign(new THREE.LineSegments(new THREE.EdgesGeometry(t.geometry, 30), new THREE.LineBasicMaterial({ color: RIG_INK.edge })), { userData: { edge: true } }));
          t.rotation.x = Math.PI / 2;
          o = new THREE.Group();
          o.add(t);
        } else o = box(0.05, 0.05, 0.05);
        o.position.set(looseX, 0.03, 0.15);
        looseX += 0.11;
        add(g, o, new THREE.Vector3(o.position.x, 0.1, 0.15), true);
        continue;
      }
    }
    if (o) add(g, o, label ?? undefined);
  }

  function add(g: GearItem, o: THREE.Object3D, label?: THREE.Vector3, loose = false) {
    const home = o.position.clone();
    if (g.rigPos) {
      o.position.set(g.rigPos.x, g.rigPos.y, g.rigPos.z);
      o.rotation.y += g.rigPos.ry * (Math.PI / 180);
    }
    o.userData.gearId = g.id;
    o.traverse((c) => (c.userData.gearId = g.id));
    root.add(o);
    const bb = new THREE.Box3().setFromObject(o);
    const lp = label ? label.clone().add(o.position.clone().sub(home)) : new THREE.Vector3((bb.min.x + bb.max.x) / 2, bb.max.y + 0.015, (bb.min.z + bb.max.z) / 2);
    parts.push({ id: g.id, name: g.name, object: o, label: lp, home, loose });
  }

  // Cables and mounting points between parts that are connected.
  const cables = new THREE.Group();
  const centre = (id: string) => {
    const p = parts.find((x) => x.id === id);
    if (!p) return null;
    return new THREE.Box3().setFromObject(p.object).getCenter(new THREE.Vector3());
  };
  for (const c of connections) {
    const a = centre(c.fromGear);
    const z = centre(c.toGear);
    if (!a || !z) continue;
    const fromItem = c.fromGear === cam.id ? cam : gear.find((g) => g.id === c.fromGear);
    const sig = fromItem?.ports.find((p) => p.id === c.fromPort)?.signal ?? 'data';
    if (sig === 'mount') {
      const dot = new THREE.Mesh(new THREE.OctahedronGeometry(0.006), new THREE.MeshBasicMaterial({ color: RIG_INK.sel }));
      dot.position.copy(a.clone().lerp(z, 0.5));
      cables.add(dot);
      continue;
    }
    const mid = a.clone().lerp(z, 0.5);
    mid.y -= Math.min(0.12, a.distanceTo(z) * 0.4);
    mid.x += 0.04;
    const curve = new THREE.CatmullRomCurve3([a, mid, z]);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.003, 6), new THREE.MeshBasicMaterial({ color: SIGNAL[sig] }));
    cables.add(m);
  }
  root.add(cables);
  return { root, parts, cables };
}

export function makeGrid(): THREE.Object3D {
  const g = new THREE.GridHelper(2, 40, RIG_INK.grid, RIG_INK.grid);
  g.position.y = -0.0001;
  return g;
}

export function rigLights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 2.2));
  const d = new THREE.DirectionalLight(0xffffff, 1.6);
  d.position.set(1, 2, 1.5);
  scene.add(d);
}

/** A still of the rig with labels, for the PDF. Returns a PNG data URL, or null without WebGL. */
export function renderRigPng(cam: GearItem, gear: GearItem[], connections: Connection[], w = 1200, h = 800, light = true): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(w, h, false);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(light ? 0xf4f2ea : RIG_INK.bg);
    rigLights(scene);
    const { root, parts } = buildRig(cam, gear, connections);
    if (light)
      root.traverse((o) => {
        if (o instanceof THREE.LineSegments && o.userData.edge) (o.material as THREE.LineBasicMaterial).color.set(0x0b0b0c);
        if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshLambertMaterial) o.material.color.set(0xe4e1d6);
      });
    scene.add(root);
    const bb = new THREE.Box3().setFromObject(root);
    const c = bb.getCenter(new THREE.Vector3());
    const size = bb.getSize(new THREE.Vector3()).length();
    const camera = new THREE.PerspectiveCamera(30, w / h, 0.01, 50);
    camera.position.copy(c.clone().add(new THREE.Vector3(-0.9, 0.55, 1).normalize().multiplyScalar(size * 1.55)));
    camera.lookAt(c);
    renderer.render(scene, camera);
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ctx = out.getContext('2d')!;
    ctx.drawImage(canvas, 0, 0);
    ctx.font = `${Math.round(w / 70)}px "IBM Plex Mono", monospace`;
    ctx.textBaseline = 'middle';
    // Labels with leaders, nudged apart so they do not overlap.
    const placed: { x: number; y: number }[] = [];
    for (const p of parts) {
      const v = p.label.clone().project(camera);
      const x = (v.x * 0.5 + 0.5) * w;
      let y = (-v.y * 0.5 + 0.5) * h - h * 0.04;
      while (placed.some((q) => Math.abs(q.y - y) < w / 55 && Math.abs(q.x - x) < w / 4)) y -= w / 55;
      placed.push({ x, y });
      const text = p.name.replace(/^Camera [A-Z] · /, '');
      const tw = ctx.measureText(text).width;
      ctx.strokeStyle = light ? '#0b0b0c' : '#ffc400';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, (-v.y * 0.5 + 0.5) * h);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = light ? '#ffc400' : '#0b0b0c';
      ctx.fillRect(x - 3, y - w / 110, tw + 6, w / 55);
      ctx.fillStyle = '#0b0b0c';
      ctx.fillText(text, x, y);
    }
    renderer.dispose();
    renderer.forceContextLoss();
    return out.toDataURL('image/png');
  } catch {
    return null;
  }
}
