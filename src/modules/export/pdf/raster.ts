import type { ReactElement } from 'react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { AspectId, Composition, Project, StoryboardFrame } from '@/types/project';
import { aspectRatio } from '@/types/project';
import { getImageBlob, blobToDataUrl } from '@/store/images';
import { svgToPng } from '@/lib/svgExport';
import { CompositionSvg } from '@/modules/frame/CompositionSvg';
import { StrokesSvg } from '@/modules/storyboard/FrameView';

/** Render a React SVG element off-screen and return the live <svg> node. */
export function renderSvgElement(el: ReactElement): { svg: SVGSVGElement; dispose: () => void } {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:1000px;pointer-events:none;opacity:0;';
  document.body.appendChild(host);
  const root = createRoot(host);
  flushSync(() => root.render(el));
  const svg = host.querySelector('svg');
  if (!svg) {
    root.unmount();
    host.remove();
    throw new Error('Nothing to render');
  }
  return {
    svg,
    dispose: () => {
      root.unmount();
      host.remove();
    },
  };
}

async function imageDataUrl(id?: string): Promise<string | null> {
  if (!id) return null;
  const blob = await getImageBlob(id);
  return blob ? blobToDataUrl(blob) : null;
}

/** Rasterise a composition to PNG at `width` pixels, background image included. */
export async function compositionPng(comp: Composition, project: Project, width = 1600, aspect?: AspectId): Promise<string> {
  const c = aspect ? { ...comp, aspect } : comp;
  const ratio = aspectRatio(c.aspect);
  const height = Math.round(width / ratio);
  const bg = await imageDataUrl(c.backgroundImageId);
  const palette = project.palettes.find((p) => p.id === c.paletteId) ?? null;
  const { svg, dispose } = renderSvgElement(createElement(CompositionSvg, { comp: c, palette, backgroundUrl: bg, showLabels: true }));
  try {
    return await svgToPng(svg, width, height, { background: '#FAFAF7', embedFonts: true });
  } finally {
    dispose();
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = src;
  });
}

/** Rasterise a storyboard frame (source plus sketch strokes) to a JPEG/PNG data URL. */
export async function storyboardFramePng(frame: StoryboardFrame, aspect: AspectId, project: Project, width = 900): Promise<{ data: string; format: 'PNG' | 'JPEG' }> {
  const ratio = aspectRatio(aspect);
  const height = Math.round(width / ratio);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FAFAF7';
  ctx.fillRect(0, 0, width, height);
  let photo = false;

  const comp = frame.source === 'composition' ? project.compositions.find((c) => c.id === frame.compositionId) : undefined;
  if (comp) {
    const png = await compositionPng(comp, project, width, aspect);
    ctx.drawImage(await loadImage(png), 0, 0, width, height);
  } else if (frame.imageId) {
    const url = await imageDataUrl(frame.imageId);
    if (url) {
      const img = await loadImage(url);
      const s = Math.max(width / img.width, height / img.height);
      const w = img.width * s;
      const h = img.height * s;
      ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
      photo = true;
    }
  } else {
    ctx.strokeStyle = 'rgba(217,214,204,0.8)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo((width * i) / 3, 0);
      ctx.lineTo((width * i) / 3, height);
      ctx.moveTo(0, (height * i) / 3);
      ctx.lineTo(width, (height * i) / 3);
      ctx.stroke();
    }
  }
  if (frame.strokes.length) {
    const H = Math.round(1000 / ratio);
    const { svg, dispose } = renderSvgElement(createElement(StrokesSvg, { strokes: frame.strokes, width: 1000, height: H, className: 'x' }));
    try {
      const png = await svgToPng(svg, width, height, { background: null });
      ctx.drawImage(await loadImage(png), 0, 0, width, height);
    } finally {
      dispose();
    }
  }
  return photo ? { data: canvas.toDataURL('image/jpeg', 0.88), format: 'JPEG' } : { data: canvas.toDataURL('image/png'), format: 'PNG' };
}
