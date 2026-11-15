import type { DiagramLight, Project } from '@/types/project';
import { CAMERA_ANGLES, CAMERA_MOVES, LIGHT_KINDS, SHOT_SIZES, aspectRatio } from '@/types/project';
import type { Settings } from '@/types/settings';
import { C, Pack, clean, table, type RGB } from './pack';
import { compositionPng, storyboardFramePng } from './raster';
import { renderDiagramPng } from '@/modules/light/diagramPng';
import { evaluate, ratioLabel, EMITTING } from '@/lib/light/photometry';
import { getSensor } from '@/lib/calc/sensors';
import { fieldOfView, backgroundBlurFraction, describeBlur } from '@/lib/calc/optics';
import { classifyShotSize } from '@/lib/frame/shotSize';
import { describe as describeColour, contrastRatio } from '@/lib/colour/colour';
import { daylightSummary, osmLink } from '@/lib/daylight';
import { dayTimes, moonInfo, moonPosition, sunPosition, geoDistanceBearing, tzOffsetMinutes, zonedDate } from '@/lib/sun';
import { compass, fmtDate, fmtLength, fmtNum, fmtTime, parseIsoDate } from '@/lib/format';

import { SECTIONS, type SectionId } from './sections';

export interface BuildOptions {
  sections: SectionId[];
  orientation: 'portrait' | 'landscape';
  onProgress?: (label: string) => void;
}

interface Ctx {
  p: Pack;
  project: Project;
  settings: Settings;
  t: (d: Date) => string;
  len: (m: number, d?: number) => string;
  /** Plan-scale length that never switches to centimetres (keeps table columns narrow and aligned). */
  plan: (m: number) => string;
}

const angleLabel = (id: string) => CAMERA_ANGLES.find((a) => a.id === id)?.label ?? '';
const moveLabel = (id: string) => CAMERA_MOVES.find((m) => m.id === id)?.label ?? '';
const STATUS: Record<string, string> = { planned: 'Planned', shot: 'Shot', pickup: 'Pick-up' };

export async function buildShootPack(project: Project, settings: Settings, opts: BuildOptions): Promise<Blob> {
  const dateLabel = fmtDate(new Date(), settings.timezone, { day: 'numeric', month: 'long', year: 'numeric' });
  const p = new Pack({ orientation: opts.orientation, projectName: project.name, dateLabel });
  await p.loadFonts();
  const ctx: Ctx = {
    p,
    project,
    settings,
    t: (d) => fmtTime(d, settings.timeFormat, settings.timezone),
    len: (m, d) => clean(fmtLength(m, settings.units, d)),
    plan: (m) => (settings.units === 'imperial' ? `${(m / 0.3048).toFixed(1)} ft` : `${m.toFixed(2)} m`),
  };
  const chosen = SECTIONS.filter((s) => opts.sections.includes(s.id));
  const hasCover = opts.sections.includes('cover');
  const toc: { label: string; page: number; index: string }[] = [];

  if (hasCover) {
    p.currentSection = 'Cover';
    p.newPage();
  }
  let n = 0;
  for (const s of chosen) {
    if (s.id === 'cover') continue;
    n++;
    const index = String(n).padStart(2, '0');
    opts.onProgress?.(s.label);
    p.currentSection = s.label;
    p.newPage();
    toc.push({ label: s.label, page: p.doc.getNumberOfPages(), index });
    p.sectionTitle(index, s.label, subtitleFor(s.id, ctx));
    await SECTION_BUILDERS[s.id](ctx);
    // Let the UI breathe between heavy sections.
    await new Promise((r) => setTimeout(r, 0));
  }
  if (hasCover) {
    p.doc.setPage(1);
    drawCover(ctx, toc);
  }
  if (!p.pageUsed) {
    p.newPage();
    p.para('Nothing was selected for this pack.', p.M, p.y, p.cw, 10, 'ui', C.fg2);
  }
  p.finalise(hasCover);
  return p.doc.output('blob');
}

function subtitleFor(id: SectionId, { project, settings }: Ctx): string | undefined {
  switch (id) {
    case 'shots': {
      const done = project.shots.filter((s) => s.status === 'shot').length;
      const scenes = new Set(project.shots.map((s) => s.scene)).size;
      return `${project.shots.length} shots across ${scenes} scene${scenes === 1 ? '' : 's'} · ${done} shot · ${project.shots.length - done} to go`;
    }
    case 'storyboard':
      return `${project.storyboard.length} frames · ${project.storyboardAspect} · about ${Math.round(project.storyboard.reduce((s, f) => s + (f.durationSec || 0), 0))} s`;
    case 'callsheet':
      return fmtDate(parseIsoDate(project.callSheet.isoDate), undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    case 'sunplan':
      return `${settings.location.name} · ${settings.timezone}`;
    default:
      return undefined;
  }
}

/* ---------- Cover ---------- */

function drawCover({ p, project, settings }: Ctx, toc: { label: string; page: number; index: string }[]) {
  const bandH = p.landscape ? 92 : 128;
  p.fill(C.yellow);
  p.doc.rect(0, 0, p.W, bandH, 'F');
  p.crosses(p.M, p.M - 4, p.W - p.M * 2, bandH - p.M - 4, C.ink, 2);
  p.wordmark(p.M + 4, p.M + 6, 9, C.ink);
  p.micro('Shoot Pack', p.W - p.M - 4, p.M + 6, C.ink, 'right', 7.5);
  // Large star mark
  const big = p.landscape ? 34 : 46;
  p.starMark(p.W - p.M - big - 6, bandH - big - 22, big, C.ink, C.white);
  p.font('uiSb', p.landscape ? 34 : 40, C.ink);
  const nameW = p.W - p.M * 2 - big - 22;
  const lines = (p.doc.splitTextToSize(clean(project.name), nameW) as string[]).slice(0, 3);
  const lh = (p.landscape ? 34 : 40) * 0.352778 * 1.05;
  const nameTop = bandH - 22 - lines.length * lh;
  lines.forEach((l, i) => p.doc.text(l, p.M + 4, nameTop + (i + 1) * lh - 2));
  p.font('mono', 9, C.ink);
  const shoot = fmtDate(parseIsoDate(project.callSheet.isoDate), undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  p.text(`Shoot day ${shoot}`, p.M + 4, bandH - 12);

  // Contents
  let y = bandH + 16;
  p.micro('Contents', p.M, y);
  y += 4;
  p.hline(p.M, p.W - p.M, y, C.line, 0.25);
  const colW = p.landscape ? (p.cw - 12) / 2 : p.cw;
  const perCol = p.landscape ? Math.ceil(toc.length / 2) : toc.length;
  toc.forEach((e, i) => {
    const col = Math.floor(i / perCol);
    const x = p.M + col * (colW + 12);
    const ry = y + (i % perCol) * 10 + 7;
    p.micro(e.index, x, ry);
    p.font('uiMd', 11, C.ink);
    p.text(e.label, x + 10, ry);
    p.font('mono', 9, C.fg2);
    p.text(String(e.page), x + colW, ry, { align: 'right' });
    p.hline(x, x + colW, ry + 3.5, C.line, 0.15);
  });

  // Production facts
  const factsY = p.H - 50;
  const sensor = getSensor(project.camera.sensorId, project.camera.customSensor);
  const cs = project.callSheet;
  const facts: [string, string][] = [
    ['Camera', `${sensor.name}`],
    ['Lens', `${project.camera.focalLength} mm · f/${project.camera.aperture} · ${project.camera.fps} fps`],
    ['Location', cs.locationName || settings.location.name],
    ['Call', cs.callTime || '—'],
  ];
  const fw = p.cw / facts.length;
  p.hline(p.M, p.W - p.M, factsY - 6, C.line, 0.25);
  facts.forEach(([label, value], i) => {
    p.micro(label, p.M + i * fw, factsY);
    p.para(value, p.M + i * fw, factsY + 5, fw - 4, 9, 'uiMd', C.ink, 1.3, 2);
  });
}

/* ---------- Call sheet ---------- */

async function callSheetSection({ p, project, settings, t }: Ctx) {
  const cs = project.callSheet;
  const lat = cs.lat ?? settings.location.lat;
  const lng = cs.lng ?? settings.location.lng;
  const sum = daylightSummary(cs.isoDate, cs.callTime, lat, lng, settings.timezone, t);
  // Key times panel
  const h = 22;
  p.panel(p.M, p.y, p.cw, h, C.yellow, C.yellowDeep);
  const items: [string, string][] = [
    ['General call', cs.callTime || '—'],
    ['Sunrise', t(sum.day.sunrise)],
    ['Golden hour', t(sum.day.goldenHour)],
    ['Sunset', t(sum.day.sunset)],
    ['Civil dusk', t(sum.day.dusk)],
  ];
  const iw = p.cw / items.length;
  items.forEach(([l, v], i) => p.readout(l, v, p.M + 5 + i * iw, p.y + 8, 15, C.ink, C.fg2));
  p.y += h + 8;

  // Location and conditions in two columns
  const colW = (p.cw - 10) / 2;
  const startY = p.y;
  let ly = startY;
  p.micro('Location', p.M, ly);
  ly += 5;
  ly += p.para(cs.locationName || settings.location.name, p.M, ly + 3, colW, 11, 'uiSb');
  if (cs.locationAddress) ly += p.para(cs.locationAddress, p.M, ly + 3, colW, 9, 'ui', C.fg2);
  p.font('mono', 8, C.fg2);
  p.text(`${lat.toFixed(5)}, ${lng.toFixed(5)}`, p.M, ly + 4);
  p.font('ui', 8, C.ink);
  p.doc.textWithLink('Open in OpenStreetMap', p.M, ly + 8.5, { url: osmLink(lat, lng) });
  p.hline(p.M, p.M + p.doc.getTextWidth('Open in OpenStreetMap'), ly + 9.2, C.ink, 0.15);
  ly += 13;
  if (cs.parking) {
    p.micro('Parking and access', p.M, ly + 2);
    ly += 5;
    ly += p.para(cs.parking, p.M, ly + 2, colW, 9, 'ui', C.ink);
  }
  let ry = startY;
  const rx = p.M + colW + 10;
  p.micro('Light and conditions', rx, ry);
  ry += 5;
  for (const line of sum.lines) ry += p.para(`·  ${line}`, rx, ry + 3, colW, 9, 'ui', C.ink) + 0.6;
  if (cs.weatherNote) {
    ry += 3;
    p.micro('Weather', rx, ry + 2);
    ry += 5;
    ry += p.para(cs.weatherNote, rx, ry + 2, colW, 9, 'ui', C.ink);
  }
  p.y = Math.max(ly, ry) + 8;

  p.ensure(20);
  p.subTitle('Cast and crew', `${cs.people.length} people`);
  if (cs.people.length) {
    table(p, [
      { label: 'Name', get: (r) => r.name },
      { label: 'Role', get: (r) => r.role },
      { label: 'Call', w: 20, get: (r) => r.callTime, mono: true },
      { label: 'Contact', get: (r) => r.contact, mono: true },
    ], cs.people);
  } else p.y += p.para('No one listed.', p.M, p.y + 3, p.cw, 9, 'ui', C.fg3);
  p.y += 8;

  p.ensure(20);
  p.subTitle('Schedule');
  const sched = cs.schedule.slice().sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  if (sched.length) {
    table(p, [
      { label: 'Time', w: 20, get: (r) => r.time, mono: true },
      { label: 'Item', get: (r) => r.item },
      { label: 'Notes', get: (r) => r.notes },
    ], sched);
  } else p.y += p.para('No schedule entered.', p.M, p.y + 3, p.cw, 9, 'ui', C.fg3);
  p.y += 8;

  if (cs.notes) {
    p.ensure(24);
    p.subTitle('Notes');
    const h2 = p.measure(cs.notes, p.cw - 8, 9.5);
    p.ensure(h2 + 8);
    p.panel(p.M, p.y, p.cw, h2 + 7, C.bone);
    p.para(cs.notes, p.M + 4, p.y + 6, p.cw - 8, 9.5);
    p.y += h2 + 12;
  }
}

/* ---------- Shot list ---------- */

async function shotsSection({ p, project }: Ctx) {
  const shots = project.shots.slice().sort((a, b) => a.order - b.order);
  if (!shots.length) return empty(p, 'No shots in this project yet.');
  const statusColour = (s: string): RGB => (s === 'shot' ? C.ok : s === 'pickup' ? C.danger : C.fg2);
  const cols = [
    { label: 'Shot', w: 12, get: (r: (typeof shots)[number]) => `${r.scene}${r.shotNumber}`, mono: true },
    { label: 'Size', w: 11, get: (r: (typeof shots)[number]) => r.size, mono: true },
    { label: 'Angle', w: 17, get: (r: (typeof shots)[number]) => angleLabel(r.angle) },
    { label: 'Move', w: 18, get: (r: (typeof shots)[number]) => moveLabel(r.movement) },
    { label: 'Lens', w: 14, get: (r: (typeof shots)[number]) => r.lens, mono: true },
    { label: 'f/', w: 11, get: (r: (typeof shots)[number]) => r.aperture.replace(/^f\//, ''), mono: true },
    { label: 'fps', w: 9, get: (r: (typeof shots)[number]) => r.fps, mono: true },
    { label: 'Location', w: p.landscape ? 30 : 22, get: (r: (typeof shots)[number]) => r.location },
    { label: 'Description', get: (r: (typeof shots)[number]) => r.description },
    ...(p.landscape ? [{ label: 'Equipment', w: 48, get: (r: (typeof shots)[number]) => r.equipment }] : []),
    { label: 'Status', w: 15, get: (r: (typeof shots)[number]) => STATUS[r.status], colour: (r: (typeof shots)[number]) => statusColour(r.status) },
  ];
  table(p, cols, shots, { groupOf: (r) => String(r.scene), groupLabel: (g, rows) => `Scene ${g} · ${rows.length} shot${rows.length === 1 ? '' : 's'}` });
}

/* ---------- Storyboard ---------- */

async function storyboardSection({ p, project }: Ctx) {
  const frames = project.storyboard.slice().sort((a, b) => a.order - b.order);
  if (!frames.length) return empty(p, 'The storyboard is empty.');
  const ratio = aspectRatio(project.storyboardAspect);
  const cols = p.landscape ? 3 : 2;
  const gap = 6;
  let cellW = (p.cw - gap * (cols - 1)) / cols;
  const textH = 22;
  let imgH = cellW / ratio;
  const maxImgH = (p.bottom - p.top - 10) * 0.6;
  if (imgH > maxImgH) {
    imgH = maxImgH;
    cellW = imgH * ratio;
  }
  const rowH = imgH + textH;
  for (let i = 0; i < frames.length; i += cols) {
    p.ensure(rowH);
    const rowFrames = frames.slice(i, i + cols);
    for (let j = 0; j < rowFrames.length; j++) {
      const f = rowFrames[j];
      const x = p.M + j * (cellW + gap);
      const img = await storyboardFramePng(f, project.storyboardAspect, project, 900);
      p.doc.addImage(img.data, img.format, x, p.y, cellW, imgH, undefined, 'FAST');
      p.stroke(C.lineStrong, 0.2);
      p.doc.rect(x, p.y, cellW, imgH, 'S');
      const shot = project.shots.find((s) => s.id === f.shotId);
      let ty = p.y + imgH + 4.2;
      p.micro(`${String(i + j + 1).padStart(2, '0')}${shot ? ` · shot ${shot.scene}${shot.shotNumber}` : ''}`, x, ty);
      p.micro(`${f.durationSec} s`, x + cellW, ty, C.fg3, 'right');
      ty += 4.5;
      ty += p.para(f.caption || 'Untitled frame', x, ty, cellW, 9, 'uiMd', C.ink, 1.3, 2);
      if (f.dialogue) ty += p.para(`“${f.dialogue}”`, x, ty, cellW, 8, 'ui', C.fg2, 1.3, 2);
      const meta = [f.size, moveLabel(f.movement), f.lens].filter(Boolean).join(' · ');
      if (meta) {
        p.font('mono', 7, C.fg3);
        p.text(meta, x, Math.min(ty + 0.5, p.y + rowH - 2));
      }
    }
    p.y += rowH + 3;
  }
}

/* ---------- Composition frames ---------- */

async function framesSection({ p, project, len }: Ctx) {
  const comps = project.compositions.slice().sort((a, b) => a.updatedAt - b.updatedAt);
  if (!comps.length) return empty(p, 'No compositions yet.');
  const sensor = getSensor(project.camera.sensorId, project.camera.customSensor);
  const imgMaxW = p.landscape ? 160 : 112;
  const imgMaxH = p.landscape ? 100 : 88;
  for (const c of comps) {
    const ratio = aspectRatio(c.aspect);
    let w = imgMaxW;
    let h = w / ratio;
    if (h > imgMaxH) {
      h = imgMaxH;
      w = h * ratio;
    }
    const metaX = p.M + w + 8;
    const metaW = p.W - p.M - metaX;
    const fov = fieldOfView(c.focalLength, sensor.width, sensor.height);
    const blur = backgroundBlurFraction(c.focalLength, c.aperture, c.subjectDistance, sensor.width);
    const size = classifyShotSize(c.elements);
    const items: [string, string][] = [
      ['Aspect', c.aspect],
      ['Shot size', size ? `${size} · ${SHOT_SIZES.find((x) => x.id === size)?.label ?? ''}` : '—'],
      ['Angle', angleLabel(c.angle)],
      ['Movement', moveLabel(c.movement)],
      ['Lens', `${c.focalLength} mm · f/${c.aperture}`],
      ['Subject', len(c.subjectDistance)],
      ['Horiz. FOV', `${fmtNum(fov.horizontal, 1)}°`],
      ['Background', describeBlur(blur)],
    ];
    const used = project.shots.filter((x) => x.compositionId === c.id).map((x) => `${x.scene}${x.shotNumber}`);
    const factCols = p.landscape ? 2 : 1;
    // Measure first so the whole block moves to the next page together.
    const factsH = Math.ceil(items.length / factCols) * 5.6 + 2;
    const notesH = c.notes ? p.measure(c.notes, metaW, 8.5) + 3 : 0;
    const usedH = used.length ? 6 : 0;
    const blockH = Math.max(h, 8 + factsH + notesH + usedH) + 12;
    p.ensure(blockH);
    const top = p.y;
    const png = await compositionPng(c, project, 1400);
    p.doc.addImage(png, 'PNG', p.M, top, w, h, undefined, 'FAST');
    p.stroke(C.lineStrong, 0.2);
    p.doc.rect(p.M, top, w, h, 'S');
    p.font('uiSb', 11.5, C.ink);
    p.text(c.name, metaX, top + 4);
    let my = top + 8;
    my += facts(p, items, metaX, my, metaW, factCols) + 2;
    if (c.notes) my += p.para(c.notes, metaX, my + 3, metaW, 8.5, 'ui', C.fg2) + 3;
    if (used.length) p.micro(`In shots ${used.join(', ')}`, metaX, my + 3);
    p.y = top + blockH;
    p.hline(p.M, p.W - p.M, p.y - 6, C.line, 0.15);
  }
}

/* ---------- Lighting ---------- */

async function lightingSection({ p, project, plan }: Ctx) {
  const diagrams = project.diagrams.slice().sort((a, b) => a.updatedAt - b.updatedAt);
  if (!diagrams.length) return empty(p, 'No lighting diagrams yet.');
  const sensor = getSensor(project.camera.sensorId, project.camera.customSensor);
  const fov = fieldOfView(project.camera.focalLength, sensor.width, sensor.height);
  for (let i = 0; i < diagrams.length; i++) {
    const d = diagrams[i];
    if (i > 0) p.newPage();
    const ph = evaluate(d.objects);
    p.subTitle(d.name, `${d.objects.filter((o) => o.type === 'light').length} lights`);
    const imgW = p.landscape ? 126 : p.cw;
    const imgH = imgW * 0.75;
    const png = renderDiagramPng(d.objects, 1200, 900, fov.horizontal, 'light', 1.5);
    p.doc.addImage(png, 'PNG', p.M, p.y, imgW, imgH, undefined, 'FAST');
    p.stroke(C.lineStrong, 0.2);
    p.doc.rect(p.M, p.y, imgW, imgH, 'S');
    const sideX = p.landscape ? p.M + imgW + 8 : p.M;
    const sideW = p.landscape ? p.W - p.M - sideX : p.cw;
    let y = p.landscape ? p.y : p.y + imgH + 6;
    const panelH = 20;
    p.panel(sideX, y, sideW, panelH, C.yellow, C.yellowDeep);
    const ro: [string, string][] = [
      ['Key : fill', ratioLabel(ph.ratio)],
      ['Ratio', Number.isFinite(ph.ratioStops) ? `${fmtNum(ph.ratioStops, 1)} st` : '—'],
      ['Exposure', Number.isFinite(ph.exposureStops) ? `${ph.exposureStops >= 0 ? '+' : ''}${fmtNum(ph.exposureStops, 1)} st` : '—'],
      ['Mix', ph.mixKelvin ? `${Math.round(ph.mixKelvin)} K` : '—'],
    ];
    const rw = (sideW - 6) / ro.length;
    ro.forEach(([l, v], k) => p.readout(l, v, sideX + 4 + k * rw, y + 7.5, p.landscape ? 10.5 : 13, C.ink, C.fg2));
    y += panelH + 6;
    const subject = d.objects.find((o) => o.type === 'subject');
    const lights = d.objects.filter((o): o is DiagramLight => o.type === 'light');
    p.y = y;
    table(
      p,
      [
        { label: 'Light', get: (l) => l.label },
        { label: 'Type', w: p.landscape ? 18 : 24, get: (l) => LIGHT_KINDS.find((k) => k.id === l.kind)?.label.replace(' light', '') ?? l.kind },
        { label: 'Power', w: 13, get: (l) => (EMITTING.includes(l.kind) ? `${l.power}%` : '—'), mono: true, align: 'right' },
        { label: 'Colour', w: 18, get: (l) => (EMITTING.includes(l.kind) ? (l.gel ? `gel ${l.gel}` : `${l.kelvin} K`) : '—'), mono: true },
        { label: 'Size', w: 15, get: (l) => plan(l.size), mono: true, align: 'right' },
        { label: 'Height', w: 15, get: (l) => plan(l.height), mono: true, align: 'right' },
        { label: 'Distance', w: 18, get: (l) => (subject ? plan(Math.hypot(l.x - subject.x, l.y - subject.y)) : '—'), mono: true, align: 'right' },
      ],
      lights,
      { size: 7.5, x: sideX, width: sideW },
    );
    p.y += 5;
    if (d.notes) {
      p.micro('Notes', sideX, p.y + 2);
      p.y += 4;
      p.y += p.para(d.notes, sideX, p.y + 2, sideW, 8.5, 'ui', C.fg2) + 2;
    }
    const used = project.shots.filter((s) => s.diagramId === d.id).map((s) => `${s.scene}${s.shotNumber}`);
    if (used.length) {
      p.micro(`Used in shots ${used.join(', ')}`, sideX, p.y + 2);
      p.y += 6;
    }
  }
}

/* ---------- Colour ---------- */

function textOn(hex: string): RGB {
  return contrastRatio(hex, '#000000') >= contrastRatio(hex, '#ffffff') ? C.ink : C.white;
}
function hexRgb(hex: string): RGB {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

async function colourSection({ p, project }: Ctx) {
  if (!project.palettes.length && !project.colourScript.length) return empty(p, 'No palettes or colour script yet.');
  if (project.colourScript.length) {
    p.subTitle('Colour script', `${project.colourScript.length} scenes`);
    const scenes = project.colourScript.slice().sort((a, b) => a.order - b.order);
    const perRow = p.landscape ? 8 : 6;
    const bw = p.cw / perRow;
    const bh = 34;
    for (let i = 0; i < scenes.length; i += perRow) {
      p.ensure(bh + 4);
      scenes.slice(i, i + perRow).forEach((s, j) => {
        const x = p.M + j * bw;
        p.fill(hexRgb(s.colour));
        p.doc.rect(x, p.y, bw, bh, 'F');
        const ink = textOn(s.colour);
        p.font('mono', 6.5, ink);
        p.text(String(i + j + 1).padStart(2, '0'), x + 2.5, p.y + bh - 13);
        p.para(s.label || `Scene ${i + j + 1}`, x + 2.5, p.y + bh - 8.5, bw - 5, 8, 'uiMd', ink, 1.2, 1);
        if (s.mood) p.para(s.mood, x + 2.5, p.y + bh - 4, bw - 5, 6.5, 'ui', ink, 1.2, 1);
      });
      p.stroke(C.lineStrong, 0.2);
      p.doc.rect(p.M, p.y, Math.min(perRow, scenes.length - i) * bw, bh, 'S');
      p.y += bh + 3;
    }
    p.y += 6;
  }
  for (const pal of project.palettes) {
    const n = pal.swatches.length;
    const perRow = Math.min(n, p.landscape ? 8 : 6);
    const sw = (p.cw - (perRow - 1) * 3) / perRow;
    const rows = Math.ceil(n / perRow);
    const chipH = 20;
    const blockH = 8 + rows * (chipH + 18);
    p.ensure(blockH);
    p.subTitle(pal.name, pal.scheme);
    pal.swatches.forEach((s, i) => {
      const x = p.M + (i % perRow) * (sw + 3);
      const y = p.y + Math.floor(i / perRow) * (chipH + 18);
      p.fill(hexRgb(s.hex));
      p.doc.rect(x, y, sw, chipH, 'F');
      p.stroke(C.line, 0.2);
      p.doc.rect(x, y, sw, chipH, 'S');
      p.font('ui', 7, textOn(s.hex));
      p.text(s.name, x + 2, y + 4.5);
      const d = describeColour(s.hex);
      p.font('monoMd', 8, C.ink);
      p.text(d.hex.toUpperCase(), x, y + chipH + 4);
      p.font('mono', 6.5, C.fg2);
      p.text(d.rgb.slice(4, -1), x, y + chipH + 8);
      p.text(d.oklch.slice(6, -1), x, y + chipH + 11.5);
    });
    p.y += rows * (chipH + 18) + 4;
  }
}

/* ---------- Sun and moon ---------- */

function drawDial(p: Pack, cx: number, cy: number, r: number, sunAz: number, sunAlt: number, moonAz: number, moonAlt: number, riseAz: number | null, setAz: number | null, shotBearing?: number) {
  const pt = (az: number, rr: number) => {
    const a = ((az - 90) * Math.PI) / 180;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as const;
  };
  p.stroke(C.lineStrong, 0.25);
  p.doc.circle(cx, cy, r, 'S');
  p.stroke(C.line, 0.15);
  p.doc.circle(cx, cy, r * 0.667, 'S');
  p.doc.circle(cx, cy, r * 0.333, 'S');
  p.font('mono', 6.5, C.fg3);
  p.text('N', cx, cy - r - 1.5, { align: 'center' });
  p.text('S', cx, cy + r + 3.5, { align: 'center' });
  p.text('E', cx + r + 2.5, cy + 1, { align: 'center' });
  p.text('W', cx - r - 2.5, cy + 1, { align: 'center' });
  const ray = (az: number | null, colour: RGB, w: number, dash = false) => {
    if (az == null) return;
    const [x, y] = pt(az, r);
    p.stroke(colour, w);
    if (dash) p.doc.setLineDashPattern([1, 1], 0);
    p.doc.line(cx, cy, x, y);
    if (dash) p.doc.setLineDashPattern([], 0);
  };
  ray(riseAz, C.yellowDeep, 0.3, true);
  ray(setAz, C.yellowDeep, 0.3, true);
  if (shotBearing != null) ray(shotBearing, C.ink, 0.5);
  ray(moonAz, C.moon, moonAlt > 0 ? 0.6 : 0.25);
  ray(sunAz, C.yellowDeep, sunAlt > 0 ? 0.8 : 0.25);
  const rFor = (alt: number) => r * (1 - Math.max(0, Math.min(90, alt)) / 90);
  const [mx, my] = pt(moonAz, rFor(moonAlt));
  p.fill([201, 208, 227]);
  p.stroke(C.ink, 0.3);
  p.doc.circle(mx, my, 1.8, moonAlt > 0 ? 'FD' : 'S');
  const [sx, sy] = pt(sunAz, rFor(sunAlt));
  p.fill(C.yellow);
  p.doc.circle(sx, sy, 2.3, sunAlt > 0 ? 'FD' : 'S');
  p.fill(C.yellow);
  p.doc.circle(cx, cy, 1.1, 'FD');
}

async function sunPlanSection({ p, project, settings, t, len }: Ctx) {
  const tz = settings.timezone;
  const plans = project.plans.length
    ? project.plans
    : [{ id: 'shoot', name: `Shoot day · ${project.callSheet.locationName || settings.location.name}`, lat: project.callSheet.lat ?? settings.location.lat, lng: project.callSheet.lng ?? settings.location.lng, isoDate: project.callSheet.isoDate, time: project.callSheet.callTime || '12:00', note: 'From the call sheet. Save plans in the planner to list them here.', createdAt: 0 } as (typeof project.plans)[number]];
  for (const plan of plans) {
    const at = zonedDate(plan.isoDate, plan.time, tz);
    const off = tzOffsetMinutes(at, tz);
    const day = dayTimes(at, plan.lat, plan.lng, off);
    const moon = moonInfo(at, plan.lat, plan.lng, off);
    const sun = sunPosition(at, plan.lat, plan.lng);
    const mp = moonPosition(at, plan.lat, plan.lng);
    const riseAz = Number.isNaN(day.sunrise.getTime()) ? null : sunPosition(day.sunrise, plan.lat, plan.lng).azimuth;
    const setAz = Number.isNaN(day.sunset.getTime()) ? null : sunPosition(day.sunset, plan.lat, plan.lng).azimuth;
    const shot = plan.subjectLat != null && plan.subjectLng != null ? geoDistanceBearing(plan.lat, plan.lng, plan.subjectLat, plan.subjectLng) : null;
    const extra = (shot ? 9 : 0) + (plan.note ? 9 : 0);
    const blockH = 92 + extra;
    p.ensure(blockH);
    const top = p.y;
    p.font('uiSb', 11.5, C.ink);
    p.text(plan.name, p.M, top + 4);
    p.font('mono', 8, C.fg2);
    p.text(`${fmtDate(parseIsoDate(plan.isoDate), undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · ${plan.time} · ${plan.lat.toFixed(4)}, ${plan.lng.toFixed(4)}`, p.M, top + 9);
    const dialR = 26;
    drawDial(p, p.M + dialR + 4, top + 16 + dialR + 4, dialR, sun.azimuth, sun.altitude, mp.azimuth, mp.altitude, riseAz, setAz, shot?.bearing);
    const rx = p.M + dialR * 2 + 18;
    const rw = p.W - p.M - rx;
    const facts: [string, string][] = [
      ['Sun', `${Math.round(sun.azimuth)}° ${compass(sun.azimuth)} · ${fmtNum(sun.altitude, 1)}° up`],
      ['Moon', `${Math.round(mp.azimuth)}° ${compass(mp.azimuth)} · ${fmtNum(mp.altitude, 1)}° · ${Math.round(moon.illumination * 100)}% ${moon.phaseName.toLowerCase()}`],
      ['Shadow', sun.altitude > 0 ? `${fmtNum(1 / Math.tan((sun.altitude * Math.PI) / 180), 2)}× object height` : 'Sun below horizon'],
      ...(shot ? ([['Camera to subject', `${len(shot.distance, 0)} · ${Math.round(shot.bearing)}° ${compass(shot.bearing)}`]] as [string, string][]) : []),
    ];
    let fy = top + 17;
    facts.forEach(([l, v]) => {
      p.micro(l, rx, fy);
      p.font('mono', 8.5, C.ink);
      p.text(v, rx, fy + 4);
      fy += 9;
    });
    const times: [string, Date][] = [
      ['Astronomical dawn', day.nightEnd],
      ['Civil dawn', day.dawn],
      ['Sunrise', day.sunrise],
      ['Golden hour ends', day.goldenHourEnd],
      ['Solar noon', day.solarNoon],
      ['Golden hour', day.goldenHour],
      ['Sunset', day.sunset],
      ['Civil dusk', day.dusk],
      ['Astronomical dusk', day.night],
    ];
    const tw = rw / 3;
    times.forEach(([l, d], i) => {
      const x = rx + (i % 3) * tw;
      const y = fy + 2 + Math.floor(i / 3) * 9;
      p.micro(l, x, y);
      p.font('mono', 8.5, C.ink);
      p.text(t(d), x, y + 4);
    });
    let by = fy + 2 + Math.ceil(times.length / 3) * 9 + 1;
    const moonLine = `Moonrise ${moon.rise ? t(moon.rise) : '—'} · moonset ${moon.set ? t(moon.set) : '—'}`;
    p.font('mono', 7.5, C.fg2);
    p.text(moonLine, rx, by + 2);
    by += 5;
    if (plan.note) by += p.para(plan.note, rx, by + 2, rw, 8, 'ui', C.fg2, 1.3, 2) + 1;
    const dialBottom = top + 16 + dialR * 2 + 10;
    p.y = Math.max(by, dialBottom) + 4;
    p.hline(p.M, p.W - p.M, p.y, C.line, 0.15);
    p.y += 8;
  }
}

/* ---------- Checklist ---------- */

async function checklistSection({ p, project }: Ctx) {
  const items = project.checklist.slice().sort((a, b) => a.order - b.order);
  if (!items.length) return empty(p, 'The gear checklist is empty.');
  const groups = new Map<string, typeof items>();
  for (const it of items) {
    if (!groups.has(it.group)) groups.set(it.group, []);
    groups.get(it.group)!.push(it);
  }
  const done = items.filter((i) => i.done).length;
  p.font('mono', 8, C.fg2);
  p.text(`${done} of ${items.length} packed`, p.M, p.y);
  p.y += 6;
  const cols = p.landscape ? 3 : 2;
  const gap = 8;
  const colW = (p.cw - gap * (cols - 1)) / cols;
  const rowH = 5.6;
  let col = 0;
  const colTop = p.y;
  let y = colTop;
  const place = (h: number) => {
    if (y + h > p.bottom) {
      col++;
      y = colTop;
      if (col >= cols) {
        p.newPage();
        col = 0;
        y = p.y;
      }
    }
  };
  for (const [group, list] of groups) {
    place(9 + rowH);
    const x = p.M + col * (colW + gap);
    p.font('monoMd', 7.5, C.ink);
    p.text(group.toUpperCase(), x, y + 4, { charSpace: 0.3 });
    p.micro(`${list.filter((i) => i.done).length}/${list.length}`, x + colW, y + 4, C.fg3, 'right');
    y += 6;
    p.hline(x, x + colW, y, C.ink, 0.25);
    y += 1;
    for (const it of list) {
      place(rowH);
      const ix = p.M + col * (colW + gap);
      p.stroke(C.ink, 0.25);
      if (it.done) {
        p.fill(C.yellow);
        p.doc.rect(ix, y + 1, 3.4, 3.4, 'FD');
        p.stroke(C.ink, 0.4);
        p.doc.line(ix + 0.7, y + 2.8, ix + 1.5, y + 3.7);
        p.doc.line(ix + 1.5, y + 3.7, ix + 2.8, y + 1.7);
      } else p.doc.rect(ix, y + 1, 3.4, 3.4, 'S');
      p.font('ui', 8.5, it.done ? C.fg2 : C.ink);
      p.text(it.label, ix + 5.5, y + 4, { maxWidth: colW - 14 });
      if (it.qty > 1) {
        p.font('mono', 7.5, C.fg2);
        p.text(`×${it.qty}`, ix + colW, y + 4, { align: 'right' });
      }
      y += rowH;
      p.hline(ix, ix + colW, y, C.line, 0.1);
    }
    y += 4;
  }
  p.y = y;
}

/** Label and value rows laid out in `cols` columns. Returns the height used. */
function facts(p: Pack, items: [string, string][], x: number, y: number, w: number, cols: number): number {
  const gap = 6;
  const colW = (w - gap * (cols - 1)) / cols;
  const labelW = Math.min(30, colW * 0.42);
  const perCol = Math.ceil(items.length / cols);
  let maxH = 0;
  for (let c = 0; c < cols; c++) {
    let cy = y;
    for (const [label, value] of items.slice(c * perCol, (c + 1) * perCol)) {
      const cx = x + c * (colW + gap);
      p.micro(label, cx, cy + 3.2);
      const h = p.para(value || '—', cx + labelW, cy + 3.3, colW - labelW, 8.5, 'mono', C.ink, 1.25, 2);
      cy += Math.max(5.4, h + 1.6);
    }
    maxH = Math.max(maxH, cy - y);
  }
  return maxH;
}

function empty(p: Pack, msg: string) {
  p.y += p.para(msg, p.M, p.y + 3, p.cw, 9.5, 'ui', C.fg3);
}

const SECTION_BUILDERS: Record<SectionId, (ctx: Ctx) => Promise<void>> = {
  cover: async () => undefined,
  callsheet: callSheetSection,
  shots: shotsSection,
  storyboard: storyboardSection,
  frames: framesSection,
  lighting: lightingSection,
  colour: colourSection,
  sunplan: sunPlanSection,
  checklist: checklistSection,
};

