import type { DiagramObject, ShotSize } from '@/types/project';
import { classifyFigure } from '@/lib/frame/shotSize';
import { bodyExtent, subjects } from './pose';

export interface FramedSubject {
  id: string;
  label: string;
  inFrame: boolean;
  partly: boolean;
  shot: ShotSize | null;
  distance: number;
  /** Where the eyes land, 0 at the top of frame to 1 at the bottom. */
  eyeLine: number;
}

/**
 * Pinhole projection of each subject into a camera on the plan.
 * cam: position on the plan; lens height and tilt in metres and degrees; angles of view in degrees.
 */
export function framing(objects: DiagramObject[], cam: { x: number; y: number; rotation: number }, lens: { height: number; tilt: number; hfov: number; vfov: number }): FramedSubject[] {
  const r = (cam.rotation * Math.PI) / 180;
  const fwd = { x: Math.sin(r), y: Math.cos(r) };
  const right = { x: Math.cos(r), y: -Math.sin(r) };
  const tanV = Math.tan(((lens.vfov / 2) * Math.PI) / 180);
  const tanH = Math.tan(((lens.hfov / 2) * Math.PI) / 180);
  const tilt = (lens.tilt * Math.PI) / 180;
  // Frame position of a point at distance d ahead and height z (0 = top, 1 = bottom).
  const fy = (d: number, z: number) => 0.5 - Math.tan(Math.atan2(z - lens.height, d) - tilt) / (2 * tanV);
  return subjects(objects).map((s) => {
    const dx = s.x - cam.x;
    const dy = s.y - cam.y;
    const d = dx * fwd.x + dy * fwd.y;
    const lat = dx * right.x + dy * right.y;
    const e = bodyExtent(s);
    if (d <= 0.05) return { id: s.id, label: s.label, inFrame: false, partly: false, shot: null, distance: Math.hypot(dx, dy), eyeLine: NaN };
    const hx = Math.abs(lat) / d / tanH; // 1 = frame edge
    const top = fy(d, e.top);
    const bottom = fy(d, e.bottom);
    const verticalIn = bottom > 0 && top < 1;
    const inFrame = hx <= 1.05 && verticalIn;
    const partly = inFrame && (hx > 0.85 || top < 0 || bottom > 1);
    return { id: s.id, label: s.label, inFrame, partly, shot: inFrame ? classifyFigure(top, bottom - top) : null, distance: Math.hypot(dx, dy), eyeLine: fy(d, e.eye) };
  });
}

export function framingSummary(f: FramedSubject[]): string {
  if (!f.length) return 'No subjects on the plan';
  const inn = f.filter((x) => x.inFrame);
  const main = inn.sort((a, b) => a.distance - b.distance)[0];
  return `${inn.length} of ${f.length} in frame${main?.shot ? ` · ${main.shot} on ${main.label}` : ''}`;
}
