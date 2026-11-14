import type { DiagramObject } from '@/types/project';
import { draw, fitView } from './draw';

/** Render a diagram to a PNG data URL (no selection chrome). */
export function renderDiagramPng(objects: DiagramObject[], width: number, height: number, cameraFovDeg: number, theme: 'light' | 'dark' = 'light', scale = 2): string {
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const view = fitView(objects, width, height);
  draw(ctx, { objects, view, width, height, selectedId: null, gridSize: 1, cameraFovDeg, theme, showHandles: false });
  return canvas.toDataURL('image/png');
}
