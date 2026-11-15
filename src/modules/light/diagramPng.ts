import type { DiagramObject } from '@/types/project';
import type { PlanView } from '@/lib/gear/catalog';
import { draw, fitView, type PlanLink } from './draw';

/** Render a plan to a PNG data URL (no selection chrome), optionally for one view with its connections. */
export function renderDiagramPng(objects: DiagramObject[], width: number, height: number, cameraFovDeg: number, theme: 'light' | 'dark' = 'light', scale = 2, planView: PlanView = 'all', links: PlanLink[] = []): string {
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const view = fitView(objects, width, height);
  draw(ctx, { objects, view, width, height, selectedId: null, gridSize: 1, cameraFovDeg, theme, showHandles: false, planView, links });
  return canvas.toDataURL('image/png');
}
