import type { FrameElement, ShotSize } from '@/types/project';
import { silhouette } from './silhouettes';

/**
 * Classify the shot size from how the tallest person is framed.
 * Elements use frame units: y is the baseline (feet) from the top, scale is the figure height.
 */
export function classifyShotSize(elements: FrameElement[]): ShotSize | null {
  const people = elements.filter((e) => silhouette(e.kind).person);
  if (people.length === 0) return null;
  const subject = people.reduce((a, b) => (b.scale > a.scale ? b : a));
  return classifyFigure(subject.y - subject.scale, subject.scale);
}

/** top = head-top position in frame units (0 = frame top), height = figure height in frame units. */
export function classifyFigure(top: number, height: number): ShotSize | null {
  const bottom = top + height;
  const vTop = Math.max(0, top);
  const vBot = Math.min(1, bottom);
  if (vBot <= vTop) return null;
  const headVisible = top >= -0.02;
  const feetVisible = bottom <= 1.04;
  if (headVisible && feetVisible) return height < 0.25 ? 'EWS' : 'WS';
  const f = headVisible ? (1 - top) / height : (vBot - vTop) / height; // portion of the figure shown, from the head down
  if (f > 0.56) return 'MWS';
  if (f > 0.38) return 'MS';
  if (f > 0.24) return 'MCU';
  if (f > 0.13) return 'CU';
  return 'ECU';
}

export const SHOT_SIZE_HINTS: Record<ShotSize, string> = {
  EWS: 'Figure is small in a large space.',
  WS: 'Full figure, head to toe.',
  MWS: 'Cut around the knees or thighs.',
  MS: 'Cut around the waist.',
  MCU: 'Cut around the chest.',
  CU: 'Head and shoulders.',
  ECU: 'Part of the face fills the frame.',
};
