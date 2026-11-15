import { svgFontCss } from './fontData';

interface Options {
  /** Fill colour behind the SVG; null keeps transparency. */
  background?: string | null;
  /** Embed the brand fonts so text renders in Inter Tight and IBM Plex Mono. */
  embedFonts?: boolean;
}

/** Rasterise an inline SVG element to a PNG data URL at the given pixel size. */
export async function svgToPng(svg: SVGSVGElement, width: number, height: number, opts: Options = {}): Promise<string> {
  const { background = '#ffffff', embedFonts = false } = opts;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  // Resolve CSS variables used in the SVG into literal colours so the raster matches the screen.
  const cs = getComputedStyle(document.documentElement);
  const resolve = (v: string) => v.replace(/var\((--[a-z0-9-]+)\)/gi, (_m, name: string) => cs.getPropertyValue(name).trim() || '#000');
  clone.querySelectorAll<SVGElement>('*').forEach((el) => {
    for (const attr of ['fill', 'stroke', 'style']) {
      const v = el.getAttribute(attr);
      if (v && v.includes('var(')) el.setAttribute(attr, resolve(v));
    }
  });
  if (embedFonts) {
    const css = await svgFontCss();
    if (css) {
      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      style.textContent = css;
      clone.insertBefore(style, clone.firstChild);
    }
  }
  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolveLoad, reject) => {
      img.onload = () => resolveLoad();
      img.onerror = () => reject(new Error('SVG render failed'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
