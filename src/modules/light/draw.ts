import type { DiagramObject, DiagramLight, DiagramCamera } from '@/types/project';
import { kelvinToHex } from '@/lib/colour/kelvin';
import { EMITTING } from '@/lib/light/photometry';
import { dirFromRotation } from '@/lib/light/photometry';

export interface View {
  ox: number; // screen x of world origin (css px)
  oy: number;
  scale: number; // css px per metre
}

export interface DrawOptions {
  objects: DiagramObject[];
  view: View;
  width: number;
  height: number;
  selectedId: string | null;
  gridSize: number;
  cameraFovDeg: number;
  theme: 'light' | 'dark';
  sunPath?: { azimuths: { az: number; label: string; alt: number }[]; nowAz: number | null; nowAlt: number } | null;
  showHandles?: boolean;
}

export const HANDLE_DIST = 42; // px from object centre to the rotate handle

export function toScreen(v: View, x: number, y: number): [number, number] {
  return [v.ox + x * v.scale, v.oy - y * v.scale];
}
export function toWorld(v: View, sx: number, sy: number): [number, number] {
  return [(sx - v.ox) / v.scale, (v.oy - sy) / v.scale];
}

export function objectRadiusPx(o: DiagramObject, scale: number): number {
  if (o.type === 'subject') return Math.max(14, 0.35 * scale);
  if (o.type === 'camera') return Math.max(14, 0.3 * scale);
  if (o.type === 'wall') return Math.max(10, (o.length * scale) / 2);
  const l = o as DiagramLight;
  return Math.max(14, Math.min(60, (Math.max(0.5, l.size) * scale) / 2 + 6));
}

const KIND_SHORT: Record<string, string> = { key: 'KEY', fill: 'FILL', back: 'BACK', hair: 'HAIR', kicker: 'KICK', practical: 'PRAC', window: 'WIN', sun: 'SUN', bounce: 'BOUNCE', flag: 'FLAG', diffusion: 'DIFF', negfill: 'NEG' };

export function lightColour(l: DiagramLight): string {
  return l.gel || kelvinToHex(l.kelvin);
}

export function draw(ctx: CanvasRenderingContext2D, o: DrawOptions) {
  const { view, width, height, objects, selectedId, gridSize } = o;
  const dark = o.theme === 'dark';
  const ink = dark ? '#f3f1ea' : '#0b0b0c';
  const grid = dark ? '#222225' : '#e6e3d9';
  const gridMajor = dark ? '#30303a' : '#cfcbbf';
  const paper = dark ? '#111113' : '#ffffff';
  const label = dark ? '#b8b6ae' : '#4a4a4c';

  ctx.save();
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);

  // Grid
  const step = gridSize * view.scale;
  if (step >= 8) {
    const [wx0, wy1] = toWorld(view, 0, 0);
    const [wx1, wy0] = toWorld(view, width, height);
    const xStart = Math.floor(wx0 / gridSize) * gridSize;
    const yStart = Math.floor(wy0 / gridSize) * gridSize;
    ctx.lineWidth = 1;
    for (let x = xStart; x <= wx1; x += gridSize) {
      const major = Math.abs(x % (gridSize * 5)) < 1e-6;
      ctx.strokeStyle = x === 0 ? gridMajor : major ? gridMajor : grid;
      const [sx] = toScreen(view, x, 0);
      ctx.beginPath();
      ctx.moveTo(Math.round(sx) + 0.5, 0);
      ctx.lineTo(Math.round(sx) + 0.5, height);
      ctx.stroke();
      if (major && step * 5 > 40) {
        ctx.fillStyle = label;
        ctx.font = '10px "IBM Plex Mono", monospace';
        ctx.fillText(`${x} m`, sx + 3, height - 6);
      }
    }
    for (let y = yStart; y <= wy1; y += gridSize) {
      const major = Math.abs(y % (gridSize * 5)) < 1e-6;
      ctx.strokeStyle = major ? gridMajor : grid;
      const [, sy] = toScreen(view, 0, y);
      ctx.beginPath();
      ctx.moveTo(0, Math.round(sy) + 0.5);
      ctx.lineTo(width, Math.round(sy) + 0.5);
      ctx.stroke();
      if (major && step * 5 > 40) {
        ctx.fillStyle = label;
        ctx.font = '10px "IBM Plex Mono", monospace';
        ctx.fillText(`${y} m`, 4, sy - 3);
      }
    }
  }

  // Scale bar
  ctx.fillStyle = ink;
  ctx.fillRect(width - 16 - view.scale, height - 14, view.scale, 2);
  ctx.font = '10px "IBM Plex Mono", monospace';
  ctx.fillStyle = label;
  ctx.textAlign = 'right';
  ctx.fillText('1 m', width - 16, height - 18);
  ctx.textAlign = 'left';

  const subject = objects.find((x) => x.type === 'subject');
  const [subjX, subjY] = subject ? toScreen(view, subject.x, subject.y) : [view.ox, view.oy];

  // Sun path overlay (north is up)
  if (o.sunPath) {
    const R = Math.max(60, 4.5 * view.scale);
    ctx.save();
    ctx.strokeStyle = '#e0ab00';
    ctx.fillStyle = '#e0ab00';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    o.sunPath.azimuths.forEach((p, i) => {
      const a = ((p.az - 90) * Math.PI) / 180;
      const r = R * (1 - (Math.max(0, p.alt) / 90) * 0.5);
      const x = subjX + r * Math.cos(a);
      const y = subjY + r * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '10px "IBM Plex Mono", monospace';
    o.sunPath.azimuths.forEach((p) => {
      if (!p.label) return;
      const a = ((p.az - 90) * Math.PI) / 180;
      const r = R * (1 - (Math.max(0, p.alt) / 90) * 0.5);
      const x = subjX + r * Math.cos(a);
      const y = subjY + r * Math.sin(a);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(p.label, x + 5, y + 3);
    });
    if (o.sunPath.nowAz != null && o.sunPath.nowAlt > 0) {
      const a = ((o.sunPath.nowAz - 90) * Math.PI) / 180;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(subjX + (R + 40) * Math.cos(a), subjY + (R + 40) * Math.sin(a));
      ctx.lineTo(subjX, subjY);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(subjX + (R + 40) * Math.cos(a), subjY + (R + 40) * Math.sin(a), 8, 0, Math.PI * 2);
      ctx.fill();
    }
    // North arrow
    ctx.fillStyle = label;
    ctx.font = '600 11px "Inter Tight", sans-serif';
    ctx.fillText('N ↑  north is up', 10, 16);
    ctx.restore();
  }

  // Draw order: walls, light beams, lights, camera, subject
  for (const obj of objects) if (obj.type === 'wall') drawWall(ctx, obj, view, ink, selectedId === obj.id);
  for (const obj of objects) if (obj.type === 'light') drawBeam(ctx, obj, view, dark);
  for (const obj of objects) if (obj.type === 'camera') drawCamera(ctx, obj, view, ink, o.cameraFovDeg, selectedId === obj.id, dark);
  for (const obj of objects) if (obj.type === 'light') drawLight(ctx, obj, view, ink, label, selectedId === obj.id, dark);
  for (const obj of objects) if (obj.type === 'subject') drawSubject(ctx, obj, view, ink, selectedId === obj.id, dark);

  // Selection ring + rotate handle
  if (o.showHandles !== false && selectedId) {
    const sel = objects.find((x) => x.id === selectedId);
    if (sel) {
      const [sx, sy] = toScreen(view, sel.x, sel.y);
      const r = objectRadiusPx(sel, view.scale) + 6;
      ctx.save();
      ctx.strokeStyle = '#FFC400';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      const d = dirFromRotation(sel.rotation);
      const hx = sx + d.x * (r + HANDLE_DIST - 6);
      const hy = sy - d.y * (r + HANDLE_DIST - 6);
      ctx.beginPath();
      ctx.moveTo(sx + d.x * r, sy - d.y * r);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.fillStyle = '#FFC400';
      ctx.beginPath();
      ctx.arc(hx, hy, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0b0b0c';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (sel.locked) {
        ctx.fillStyle = ink;
        ctx.font = '10px "IBM Plex Mono", monospace';
        ctx.fillText('LOCKED', sx + r + 4, sy - r);
      }
      ctx.restore();
    }
  }
  ctx.restore();
}

export function rotateHandlePos(o: DiagramObject, view: View): [number, number] {
  const [sx, sy] = toScreen(view, o.x, o.y);
  const r = objectRadiusPx(o, view.scale) + 6;
  const d = dirFromRotation(o.rotation);
  return [sx + d.x * (r + HANDLE_DIST - 6), sy - d.y * (r + HANDLE_DIST - 6)];
}

function drawWall(ctx: CanvasRenderingContext2D, w: DiagramObject & { type: 'wall' }, v: View, ink: string, selected: boolean) {
  const [sx, sy] = toScreen(v, w.x, w.y);
  const d = dirFromRotation(w.rotation);
  const along = { x: d.y, y: -d.x };
  const half = (w.length * v.scale) / 2;
  ctx.save();
  ctx.strokeStyle = selected ? '#FFC400' : ink;
  ctx.lineWidth = Math.max(4, 0.12 * v.scale);
  ctx.lineCap = 'square';
  ctx.beginPath();
  ctx.moveTo(sx - along.x * half, sy + along.y * half);
  ctx.lineTo(sx + along.x * half, sy - along.y * half);
  ctx.stroke();
  ctx.restore();
}

function drawBeam(ctx: CanvasRenderingContext2D, l: DiagramLight, v: View, dark: boolean) {
  if (!EMITTING.includes(l.kind) || l.power <= 0) return;
  const [sx, sy] = toScreen(v, l.x, l.y);
  const colour = lightColour(l);
  const len = Math.max(1.5, Math.min(6, 3 + l.power / 40)) * v.scale;
  const half = ((Math.min(170, l.spread) / 2) * Math.PI) / 180;
  const a0 = ((l.rotation - 90) * Math.PI) / 180;
  ctx.save();
  const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, len);
  g.addColorStop(0, hexWithAlpha(colour, dark ? 0.5 : 0.48));
  g.addColorStop(1, hexWithAlpha(colour, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.arc(sx, sy, len, a0 - half, a0 + half);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawLight(ctx: CanvasRenderingContext2D, l: DiagramLight, v: View, ink: string, labelColour: string, selected: boolean, dark: boolean) {
  const [sx, sy] = toScreen(v, l.x, l.y);
  const d = dirFromRotation(l.rotation);
  const along = { x: d.y, y: -d.x };
  const colour = lightColour(l);
  ctx.save();
  if (EMITTING.includes(l.kind)) {
    // Soft source bar (width = size) behind a lamp head
    const half = (Math.max(0.3, l.size) * v.scale) / 2;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx - along.x * half, sy + along.y * half);
    ctx.lineTo(sx + along.x * half, sy - along.y * half);
    ctx.stroke();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx - along.x * half, sy + along.y * half);
    ctx.lineTo(sx + along.x * half, sy - along.y * half);
    ctx.stroke();
    // head
    ctx.fillStyle = l.kind === 'sun' ? '#FFC400' : dark ? '#1f1f21' : '#ffffff';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fill();
    // direction tick
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.moveTo(sx + d.x * 11, sy - d.y * 11);
    ctx.lineTo(sx + d.x * 20, sy - d.y * 20);
    ctx.stroke();
  } else {
    const half = (Math.max(0.3, l.size) * v.scale) / 2;
    ctx.lineCap = 'butt';
    ctx.lineWidth = l.kind === 'diffusion' ? 4 : 7;
    ctx.strokeStyle = l.kind === 'bounce' ? (dark ? '#f3f1ea' : '#ffffff') : l.kind === 'diffusion' ? (dark ? '#9a9a9a' : '#bdbdbd') : '#0b0b0c';
    if (l.kind === 'diffusion') ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(sx - along.x * half, sy + along.y * half);
    ctx.lineTo(sx + along.x * half, sy - along.y * half);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - along.x * half, sy + along.y * half);
    ctx.lineTo(sx + along.x * half, sy - along.y * half);
    ctx.stroke();
    // facing tick
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + d.x * 10, sy - d.y * 10);
    ctx.stroke();
  }
  // label
  ctx.font = '500 10px "IBM Plex Mono", monospace';
  ctx.fillStyle = selected ? '#e0ab00' : labelColour;
  const text = `${KIND_SHORT[l.kind] ?? l.kind}${EMITTING.includes(l.kind) ? ` ${l.power}%` : ''}`;
  ctx.fillText(text, sx + 14, sy + 24);
  if (l.label && l.label !== (KIND_SHORT[l.kind] ?? '') && EMITTING.includes(l.kind)) {
    ctx.fillStyle = labelColour;
    ctx.font = '10px "Inter Tight", sans-serif';
    ctx.fillText(l.label, sx + 14, sy + 36);
  }
  ctx.restore();
}

function drawCamera(ctx: CanvasRenderingContext2D, c: DiagramCamera, v: View, ink: string, fovDeg: number, selected: boolean, dark: boolean) {
  const [sx, sy] = toScreen(v, c.x, c.y);
  const a0 = ((c.rotation - 90) * Math.PI) / 180;
  const half = ((fovDeg / 2) * Math.PI) / 180;
  const len = 7 * v.scale;
  ctx.save();
  ctx.fillStyle = dark ? 'rgba(243,241,234,0.06)' : 'rgba(11,11,12,0.05)';
  ctx.strokeStyle = dark ? 'rgba(243,241,234,0.35)' : 'rgba(11,11,12,0.35)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 5]);
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + len * Math.cos(a0 - half), sy + len * Math.sin(a0 - half));
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + len * Math.cos(a0 + half), sy + len * Math.sin(a0 + half));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.arc(sx, sy, len, a0 - half, a0 + half);
  ctx.closePath();
  ctx.fill();
  // body
  ctx.translate(sx, sy);
  ctx.rotate((c.rotation * Math.PI) / 180);
  ctx.fillStyle = selected ? '#FFC400' : dark ? '#f3f1ea' : '#0b0b0c';
  ctx.fillRect(-11, -8, 22, 16);
  ctx.fillRect(-5, -16, 10, 9);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-11, -8, 22, 16);
  ctx.restore();
  ctx.save();
  ctx.font = '500 10px "IBM Plex Mono", monospace';
  ctx.fillStyle = dark ? '#b8b6ae' : '#4a4a4c';
  ctx.fillText(`CAM ${Math.round(fovDeg)}°`, sx + 14, sy + 24);
  ctx.restore();
}

function drawSubject(ctx: CanvasRenderingContext2D, s: DiagramObject & { type: 'subject' }, v: View, ink: string, selected: boolean, dark: boolean) {
  const [sx, sy] = toScreen(v, s.x, s.y);
  const d = dirFromRotation(s.rotation);
  ctx.save();
  if (s.subjectKind === 'person') {
    const shoulder = Math.max(10, 0.22 * v.scale);
    ctx.translate(sx, sy);
    ctx.rotate((s.rotation * Math.PI) / 180);
    ctx.fillStyle = dark ? '#2a2a2c' : '#f1efe8';
    ctx.strokeStyle = selected ? '#FFC400' : ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, shoulder, shoulder * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = selected ? '#FFC400' : dark ? '#f3f1ea' : '#0b0b0c';
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(6, 0.1 * v.scale), 0, Math.PI * 2);
    ctx.fill();
    // nose
    ctx.beginPath();
    ctx.moveTo(0, -Math.max(6, 0.1 * v.scale));
    ctx.lineTo(0, -Math.max(6, 0.1 * v.scale) - 6);
    ctx.strokeStyle = selected ? '#FFC400' : ink;
    ctx.stroke();
  } else {
    const half = Math.max(8, 0.2 * v.scale);
    ctx.fillStyle = dark ? '#2a2a2c' : '#f1efe8';
    ctx.strokeStyle = selected ? '#FFC400' : ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(sx - half, sy - half, half * 2, half * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + d.x * half, sy - d.y * half);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.font = '500 10px "IBM Plex Mono", monospace';
  ctx.fillStyle = dark ? '#b8b6ae' : '#4a4a4c';
  ctx.fillText(s.label.toUpperCase(), sx + 14, sy + 26);
  ctx.restore();
}

function hexWithAlpha(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  if (Number.isNaN(n)) return `rgba(255,196,0,${a})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Hit test in screen space. Returns the topmost object under the point. */
export function hitTest(objects: DiagramObject[], view: View, sx: number, sy: number): DiagramObject | null {
  const order = objects.slice().reverse();
  // Subjects and cameras first, then lights, then walls
  const prio = (o: DiagramObject) => (o.type === 'subject' ? 0 : o.type === 'camera' ? 1 : o.type === 'light' ? 2 : 3);
  order.sort((a, b) => prio(a) - prio(b));
  for (const o of order) {
    const [ox, oy] = toScreen(view, o.x, o.y);
    if (o.type === 'wall' || (o.type === 'light' && !EMITTING.includes(o.kind))) {
      const len = (o.type === 'wall' ? o.length : Math.max(0.3, o.size)) * view.scale;
      const d = dirFromRotation(o.rotation);
      const along = { x: d.y, y: -d.x };
      const ax = ox - (along.x * len) / 2;
      const ay = oy + (along.y * len) / 2;
      const bx = ox + (along.x * len) / 2;
      const by = oy - (along.y * len) / 2;
      if (distToSegment(sx, sy, ax, ay, bx, by) < 12) return o;
      continue;
    }
    const r = objectRadiusPx(o, view.scale);
    if (Math.hypot(sx - ox, sy - oy) <= Math.max(16, Math.min(r, 28))) return o;
  }
  return null;
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Fit all objects into a canvas of the given size. */
export function fitView(objects: DiagramObject[], width: number, height: number): View {
  if (objects.length === 0) return { ox: width / 2, oy: height / 2, scale: Math.min(width, height) / 8 };
  const xs = objects.map((o) => o.x);
  const ys = objects.map((o) => o.y);
  const minX = Math.min(...xs) - 1.5;
  const maxX = Math.max(...xs) + 1.5;
  const minY = Math.min(...ys) - 1.5;
  const maxY = Math.max(...ys) + 1.5;
  const scale = Math.max(20, Math.min(width / (maxX - minX), height / (maxY - minY), 140));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return { ox: width / 2 - cx * scale, oy: height / 2 + cy * scale, scale };
}
