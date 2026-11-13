import type { ColourScriptScene } from '@/types/project';
import { contrastRatio } from '@/lib/colour/colour';

/** Render the colour script strip to a PNG data URL (2x for crispness). */
export function renderColourScript(scenes: ColourScriptScene[], projectName: string): string {
  const scale = 2;
  const cellW = 180;
  const h = 200;
  const header = 48;
  const w = Math.max(cellW * Math.max(1, scenes.length), 600);
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = (h + header) * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.fillStyle = '#FAFAF7';
  ctx.fillRect(0, 0, w, h + header);
  ctx.fillStyle = '#0B0B0C';
  ctx.font = '600 12px "Inter Tight", system-ui, sans-serif';
  ctx.letterSpacing = '3px';
  ctx.fillText('ASTRIS PRODUCTIONS', 16, 22);
  ctx.font = '400 12px "IBM Plex Mono", monospace';
  ctx.letterSpacing = '1px';
  ctx.fillStyle = '#4a4a4c';
  ctx.fillText(`COLOUR SCRIPT · ${projectName.toUpperCase()}`, 16, 38);
  const sorted = scenes.slice().sort((a, b) => a.order - b.order);
  sorted.forEach((s, i) => {
    const x = i * cellW;
    ctx.fillStyle = s.colour;
    ctx.fillRect(x, header, cellW, h);
    const ink = contrastRatio(s.colour, '#000000') >= contrastRatio(s.colour, '#ffffff') ? '#0B0B0C' : '#FAFAF7';
    ctx.fillStyle = ink;
    ctx.font = '400 10px "IBM Plex Mono", monospace';
    ctx.letterSpacing = '2px';
    ctx.fillText(String(i + 1).padStart(2, '0'), x + 12, header + h - 44);
    ctx.font = '500 14px "Inter Tight", system-ui, sans-serif';
    ctx.letterSpacing = '0px';
    ctx.fillText(s.label || `Scene ${i + 1}`, x + 12, header + h - 26);
    ctx.font = '400 11px "Inter Tight", system-ui, sans-serif';
    ctx.globalAlpha = 0.85;
    ctx.fillText(s.mood.slice(0, 26), x + 12, header + h - 10);
    ctx.globalAlpha = 1;
  });
  ctx.strokeStyle = '#D9D6CC';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, header + 0.5, w - 1, h - 1);
  return canvas.toDataURL('image/png');
}
