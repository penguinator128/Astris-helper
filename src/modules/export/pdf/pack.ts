import { jsPDF } from 'jspdf';
import { FONT_FILES, fontBase64, type FontKey } from '@/lib/fontData';

export type RGB = [number, number, number];

export const C = {
  ink: [11, 11, 12] as RGB,
  white: [255, 255, 255] as RGB,
  paper: [250, 250, 247] as RGB,
  bone: [241, 239, 232] as RGB,
  line: [217, 214, 204] as RGB,
  lineStrong: [185, 181, 168] as RGB,
  fg2: [74, 74, 76] as RGB,
  fg3: [122, 122, 124] as RGB,
  yellow: [255, 196, 0] as RGB,
  yellowDeep: [224, 171, 0] as RGB,
  wash: [255, 243, 194] as RGB,
  ok: [31, 111, 67] as RGB,
  danger: [179, 38, 30] as RGB,
  moon: [111, 127, 168] as RGB,
};

const PT = 0.352778; // mm per point
const FAMILY: Record<FontKey, string> = { ui: 'AstrisUi', uiMd: 'AstrisUiMd', uiSb: 'AstrisUiSb', mono: 'AstrisMono', monoMd: 'AstrisMonoMd' };
const FALLBACK: Record<FontKey, [string, string]> = { ui: ['helvetica', 'normal'], uiMd: ['helvetica', 'normal'], uiSb: ['helvetica', 'bold'], mono: ['courier', 'normal'], monoMd: ['courier', 'bold'] };

/** Characters outside the embedded Latin subset are replaced so nothing renders as a blank box. */
export function clean(s: string | number | undefined | null): string {
  const str = String(s ?? '').replace(/∞/g, 'inf').replace(/≈/g, '~').replace(/[→⟶]/g, '->');
  let out = '';
  for (const ch of str) {
    const c = ch.codePointAt(0) ?? 0;
    const ok =
      (c >= 0x20 && c <= 0x7e) ||
      (c >= 0xa0 && c <= 0xff) ||
      c === 0x0a ||
      c === 0x131 ||
      c === 0x152 ||
      c === 0x153 ||
      (c >= 0x2010 && c <= 0x2027) ||
      (c >= 0x2030 && c <= 0x205e) ||
      c === 0x20ac ||
      c === 0x2122 ||
      c === 0x2191 ||
      c === 0x2193 ||
      c === 0x2212;
    out += ok ? ch : c === 0x2009 || c === 0x202f || c === 0x200a ? ' ' : '';
  }
  return out;
}

export interface PackOptions {
  orientation: 'portrait' | 'landscape';
  projectName: string;
  dateLabel: string;
}

export class Pack {
  doc: jsPDF;
  W: number;
  H: number;
  M = 16;
  top = 26;
  bottom: number;
  y = 0;
  fontsOk = false;
  opts: PackOptions;
  sectionByPage = new Map<number, string>();
  currentSection = '';
  pageUsed = false;

  constructor(opts: PackOptions) {
    this.opts = opts;
    this.doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: opts.orientation, compress: true });
    this.W = this.doc.internal.pageSize.getWidth();
    this.H = this.doc.internal.pageSize.getHeight();
    this.bottom = this.H - 18;
    this.doc.setProperties({ title: `${clean(opts.projectName)} · Shoot Pack`, subject: 'Shoot Pack', author: 'ASTRIS PRODUCTIONS', creator: 'Astris Field Kit' });
  }

  get cw() {
    return this.W - this.M * 2;
  }
  get landscape() {
    return this.opts.orientation === 'landscape';
  }

  async loadFonts() {
    try {
      const entries = Object.entries(FONT_FILES) as [FontKey, string][];
      const data = await Promise.all(entries.map(([, f]) => fontBase64(f)));
      entries.forEach(([key, file], i) => {
        this.doc.addFileToVFS(file, data[i]);
        this.doc.addFont(file, FAMILY[key], 'normal');
      });
      this.fontsOk = true;
    } catch {
      this.fontsOk = false;
    }
  }

  font(key: FontKey, size: number, colour: RGB = C.ink) {
    if (this.fontsOk) this.doc.setFont(FAMILY[key], 'normal');
    else this.doc.setFont(FALLBACK[key][0], FALLBACK[key][1]);
    this.doc.setFontSize(size);
    this.doc.setTextColor(colour[0], colour[1], colour[2]);
  }

  lh(size: number, factor = 1.35) {
    return size * PT * factor;
  }

  text(s: string, x: number, y: number, opts: { align?: 'left' | 'right' | 'center'; charSpace?: number; maxWidth?: number } = {}) {
    const str = clean(s);
    if (opts.charSpace && opts.align && opts.align !== 'left') {
      const w = this.doc.getTextWidth(str) + opts.charSpace * Math.max(0, str.length - 1);
      const sx = opts.align === 'right' ? x - w : x - w / 2;
      this.doc.text(str, sx, y, { charSpace: opts.charSpace });
      return;
    }
    this.doc.text(str, x, y, { align: opts.align, charSpace: opts.charSpace, maxWidth: opts.maxWidth });
  }

  /** Small uppercase mono label with wide tracking. */
  micro(s: string, x: number, y: number, colour: RGB = C.fg3, align: 'left' | 'right' | 'center' = 'left', size = 6.5) {
    this.font('mono', size, colour);
    this.text(clean(s).toUpperCase(), x, y, { charSpace: 0.35, align });
  }

  /** Wrapped paragraph. Returns the height used. */
  para(s: string, x: number, y: number, w: number, size = 9, key: FontKey = 'ui', colour: RGB = C.ink, factor = 1.4, maxLines?: number): number {
    this.font(key, size, colour);
    let lines = this.doc.splitTextToSize(clean(s), w) as string[];
    if (maxLines && lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s+\S*$/, '')}…`;
    }
    const lh = this.lh(size, factor);
    lines.forEach((l, i) => this.doc.text(l, x, y + i * lh));
    return lines.length * lh;
  }

  measure(s: string, w: number, size = 9, key: FontKey = 'ui', factor = 1.4, maxLines?: number): number {
    this.font(key, size);
    const n = (this.doc.splitTextToSize(clean(s), w) as string[]).length;
    return Math.min(n, maxLines ?? n) * this.lh(size, factor);
  }

  fill(c: RGB) {
    this.doc.setFillColor(c[0], c[1], c[2]);
  }
  stroke(c: RGB, w = 0.2) {
    this.doc.setDrawColor(c[0], c[1], c[2]);
    this.doc.setLineWidth(w);
  }

  hline(x1: number, x2: number, y: number, c: RGB = C.line, w = 0.2) {
    this.stroke(c, w);
    this.doc.line(x1, y, x2, y);
  }

  crosses(x: number, y: number, w: number, h: number, c: RGB = C.lineStrong, s = 1.6) {
    this.stroke(c, 0.25);
    for (const [cx, cy] of [
      [x, y],
      [x + w, y],
      [x, y + h],
      [x + w, y + h],
    ]) {
      this.doc.line(cx - s, cy, cx + s, cy);
      this.doc.line(cx, cy - s, cx, cy + s);
    }
  }

  /** Blueprint panel: hairline border with corner crosses, optional fill. */
  panel(x: number, y: number, w: number, h: number, fillColour?: RGB, border: RGB = C.line) {
    if (fillColour) {
      this.fill(fillColour);
      this.doc.rect(x, y, w, h, 'F');
    }
    this.stroke(border, 0.2);
    this.doc.rect(x, y, w, h, 'S');
    this.crosses(x, y, w, h, fillColour && fillColour === C.yellow ? C.ink : C.lineStrong);
  }

  starMark(x: number, y: number, size: number, ink: RGB = C.ink, centre: RGB = C.yellow) {
    const r = size / 2;
    const cx = x + r;
    const cy = y + r;
    this.stroke(ink, size * 0.09);
    this.doc.setLineCap('round');
    const d = r * 0.83;
    this.doc.line(cx, cy - d, cx, cy + d);
    this.doc.line(cx - d, cy, cx + d, cy);
    const q = d * 0.707;
    this.doc.line(cx - q, cy - q, cx + q, cy + q);
    this.doc.line(cx + q, cy - q, cx - q, cy + q);
    this.doc.setLineCap('butt');
    this.fill(centre);
    this.stroke(ink, size * 0.08);
    this.doc.circle(cx, cy, r * 0.25, 'FD');
  }

  wordmark(x: number, y: number, size = 7.5, ink: RGB = C.ink) {
    const markSize = size * PT * 1.3;
    this.starMark(x, y - markSize * 0.82, markSize, ink);
    this.font('uiSb', size, ink);
    const tx = x + markSize + 2;
    const cs = size * PT * 0.24;
    this.text('ASTRIS', tx, y, { charSpace: cs });
    const w = this.doc.getTextWidth('ASTRIS') + cs * 6 + size * PT * 0.6;
    this.font('ui', size, ink);
    this.text('PRODUCTIONS', tx + w, y, { charSpace: cs });
  }

  /** Start a new page in the current section. */
  newPage() {
    if (this.pageUsed) this.doc.addPage('a4', this.opts.orientation);
    this.pageUsed = true;
    this.sectionByPage.set(this.doc.getNumberOfPages(), this.currentSection);
    this.y = this.top;
  }

  /** Make sure `h` mm fit on this page, otherwise break. Returns true if a page was added. */
  ensure(h: number): boolean {
    if (this.y + h <= this.bottom) return false;
    this.newPage();
    return true;
  }

  sectionTitle(index: string, title: string, sub?: string) {
    this.micro(index, this.M, this.y + 3.2, C.fg3);
    this.font('uiSb', 18, C.ink);
    this.text(title, this.M + 10, this.y + 5);
    this.y += 8;
    if (sub) {
      this.font('ui', 8.5, C.fg2);
      this.text(sub, this.M + 10, this.y + 2.5);
      this.y += 5;
    }
    this.y += 2;
    this.hline(this.M, this.W - this.M, this.y, C.line, 0.25);
    this.y += 6;
  }

  subTitle(title: string, aside?: string) {
    this.font('uiSb', 11, C.ink);
    this.text(title, this.M, this.y + 4);
    if (aside) this.micro(aside, this.W - this.M, this.y + 4, C.fg3, 'right');
    this.y += 7;
  }

  readout(label: string, value: string, x: number, y: number, size = 13, ink: RGB = C.ink, labelColour: RGB = C.fg3) {
    this.micro(label, x, y, labelColour);
    this.font('monoMd', size, ink);
    this.text(value, x, y + size * PT * 1.25);
  }

  /** Draw headers and footers on every page once the document is complete. */
  finalise(coverPage: boolean) {
    const n = this.doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      this.doc.setPage(i);
      const isCover = coverPage && i === 1;
      if (!isCover) {
        this.wordmark(this.M, 12.5, 7);
        this.font('ui', 8, C.fg2);
        this.text(this.opts.projectName, this.W - this.M, 12.5, { align: 'right' });
        this.hline(this.M, this.W - this.M, 15.5, C.line, 0.25);
      }
      this.hline(this.M, this.W - this.M, this.H - 12, C.line, 0.25);
      this.micro(isCover ? 'Shoot Pack' : this.sectionByPage.get(i) ?? '', this.M, this.H - 7.5);
      this.micro(this.opts.dateLabel, this.W / 2, this.H - 7.5, C.fg3, 'center');
      this.micro(`Page ${i} of ${n}`, this.W - this.M, this.H - 7.5, C.fg3, 'right');
    }
  }
}

/* ---------- Table ---------- */

export interface Col<T> {
  label: string;
  w?: number; // mm; omitted = share remaining width
  get: (row: T) => string;
  mono?: boolean;
  align?: 'left' | 'right';
  colour?: (row: T) => RGB | undefined;
}

export interface TableOpts<T> {
  size?: number;
  groupOf?: (row: T) => string;
  groupLabel?: (group: string, rows: T[]) => string;
  x?: number;
  width?: number;
}

export function table<T>(p: Pack, cols: Col<T>[], rows: T[], opts: TableOpts<T> = {}) {
  const size = opts.size ?? 8;
  const x0 = opts.x ?? p.M;
  const width = opts.width ?? p.cw;
  const fixed = cols.reduce((s, c) => s + (c.w ?? 0), 0);
  const flexCount = cols.filter((c) => c.w == null).length || 1;
  const widths = cols.map((c) => c.w ?? Math.max(16, (width - fixed) / flexCount));
  const padX = 1.6;
  const padY = 1.5;
  const lh = p.lh(size, 1.3);
  const headH = 6.5;

  const drawHead = () => {
    p.fill(C.bone);
    p.doc.rect(x0, p.y, width, headH, 'F');
    let x = x0;
    cols.forEach((c, i) => {
      p.micro(c.label, c.align === 'right' ? x + widths[i] - padX : x + padX, p.y + 4.3, C.fg2, c.align === 'right' ? 'right' : 'left', 6);
      x += widths[i];
    });
    p.y += headH;
  };

  p.ensure(headH + lh + padY * 2);
  drawHead();
  let lastGroup: string | null = null;
  rows.forEach((row) => {
    if (opts.groupOf) {
      const g = opts.groupOf(row);
      if (g !== lastGroup) {
        lastGroup = g;
        const gh = 6;
        if (p.ensure(gh + lh + padY * 2)) drawHead();
        p.fill(C.wash);
        p.doc.rect(x0, p.y, width, gh, 'F');
        p.font('monoMd', 7, C.ink);
        p.text(clean(opts.groupLabel ? opts.groupLabel(g, rows.filter((r) => opts.groupOf!(r) === g)) : g).toUpperCase(), x0 + padX, p.y + 4.1, { charSpace: 0.3 });
        p.y += gh;
      }
    }
    const cells = cols.map((c, i) => {
      p.font(c.mono ? 'mono' : 'ui', size);
      return p.doc.splitTextToSize(clean(c.get(row) || '—'), widths[i] - padX * 2) as string[];
    });
    const rowH = Math.max(...cells.map((l) => l.length)) * lh + padY * 2;
    if (p.ensure(rowH)) drawHead();
    let x = x0;
    cols.forEach((c, i) => {
      const colour = c.colour?.(row) ?? (c.get(row) ? C.ink : C.fg3);
      p.font(c.mono ? 'mono' : 'ui', size, colour);
      cells[i].forEach((line, li) => {
        const ty = p.y + padY + lh * 0.78 + li * lh;
        if (c.align === 'right') p.doc.text(line, x + widths[i] - padX, ty, { align: 'right' });
        else p.doc.text(line, x + padX, ty);
      });
      x += widths[i];
    });
    p.y += rowH;
    p.hline(x0, x0 + width, p.y, C.line, 0.15);
  });
}
