import type { CameraConfig, Connection, DiagramLight, DiagramObject, DiagramSubject, GearItem, LightingDiagram, Project } from '@/types/project';
import { LIGHT_KINDS } from '@/types/project';
import type { Settings } from '@/types/settings';
import { C, Pack, clean, table, type RGB } from './pack';
import { renderDiagramPng } from '@/modules/light/diagramPng';
import { renderRigPng, rigParts } from '@/modules/rig/rigScene';
import { evaluate, EMITTING } from '@/lib/light/photometry';
import { categoryInfo, cableFor, planLinks } from '@/lib/gear/catalog';
import { checkProduction, rigKey } from '@/lib/gear/autoconnect';
import { cableSummary } from '@/lib/gear/equipment';
import { cameraConfig, derive, exposureLabel, exposureOffset, shutterSeconds, warnings } from '@/lib/camera/settings';
import { withRigNd } from '@/lib/camera/nd';
import { bodyOf } from '@/lib/camera/bodies';
import { profile } from '@/lib/camera/profiles';
import { envOf, ENV_PRESETS, fixtureInfo, DIFFUSION } from '@/lib/light/environment';
import { bodyExtent, POSES, furnitureInfo, isFurniture } from '@/lib/scene/pose';
import { framing } from '@/lib/scene/framing';
import { fmtDate, parseIsoDate } from '@/lib/format';
import { getSensor } from '@/lib/calc/sensors';
import { fieldOfView } from '@/lib/calc/optics';

export interface CameraSheetOptions {
  /** One set-up (scene); omit for every set-up. */
  diagramId?: string;
}

const SIGNAL_RGB: Record<string, RGB> = { audio: [63, 111, 160], video: [224, 171, 0], timecode: [122, 122, 124], power: [179, 38, 30], data: [74, 74, 76], mount: [11, 11, 12] };

interface Scene {
  d: LightingDiagram | null;
  cams: GearItem[];
}

/** The cameras on a set-up, or every camera when it has none from Gear. */
function scenesOf(project: Project, opts: CameraSheetOptions): Scene[] {
  const all = project.gear.filter((g) => g.category === 'camera');
  const ds = opts.diagramId ? project.diagrams.filter((d) => d.id === opts.diagramId) : project.diagrams.slice().sort((a, b) => a.updatedAt - b.updatedAt);
  if (!ds.length) return [{ d: null, cams: all }];
  return ds.map((d) => {
    const ids = new Set(d.objects.map((o) => ('gearId' in o ? o.gearId : undefined)).filter(Boolean));
    const placed = all.filter((g) => ids.has(g.id));
    return { d, cams: placed.length ? placed : all };
  });
}

export async function buildCameraSheet(project: Project, settings: Settings, opts: CameraSheetOptions = {}): Promise<Blob> {
  const dateLabel = fmtDate(new Date(), settings.timezone, { day: 'numeric', month: 'long', year: 'numeric' });
  const p = new Pack({ orientation: 'portrait', projectName: project.name, dateLabel });
  p.doc.setProperties({ title: `${clean(project.name)} · Camera department setup sheet`, subject: 'Camera department setup sheet' });
  await p.loadFonts();
  const scenes = scenesOf(project, opts);
  for (const sc of scenes) {
    await sceneSheet(p, project, settings, sc);
    await new Promise((r) => setTimeout(r, 0));
  }
  p.finalise(false);
  return p.doc.output('blob');
}

function letterOf(project: Project, cam: GearItem) {
  const i = project.gear.filter((g) => g.category === 'camera').indexOf(cam);
  return String.fromCharCode(65 + Math.max(0, i));
}

/** Two or three columns of label and value. */
function kvGrid(p: Pack, rows: [string, string][], cols = 3, x = p.M, w = p.cw) {
  const cw = w / cols;
  const rowH = 9.5;
  const lines = Math.ceil(rows.length / cols);
  p.ensure(Math.min(lines, 4) * rowH + 2);
  rows.forEach(([l, v], i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const yy = p.y + r * rowH;
    if (yy + rowH > p.bottom) return;
    p.micro(l, x + c * cw, yy + 3);
    p.font('mono', 8.5, C.ink);
    p.text(clean(v), x + c * cw, yy + 7.2, { maxWidth: cw - 3 });
  });
  p.y += lines * rowH + 2;
}

function heading(p: Pack, n: number, title: string, aside?: string) {
  p.ensure(20);
  p.y += 2;
  p.fill(C.yellow);
  p.doc.rect(p.M, p.y, 7, 7, 'F');
  p.font('monoMd', 8.5, C.ink);
  p.text(String(n), p.M + 3.5, p.y + 4.9, { align: 'center' });
  p.font('uiSb', 12.5, C.ink);
  p.text(title, p.M + 10, p.y + 5.3);
  if (aside) p.micro(aside, p.W - p.M, p.y + 5, C.fg3, 'right');
  p.y += 9;
  p.hline(p.M, p.W - p.M, p.y, C.line, 0.25);
  p.y += 4;
}

async function sceneSheet(p: Pack, project: Project, settings: Settings, { d, cams }: Scene) {
  const env = envOf(d ?? undefined);
  const objects: DiagramObject[] = d?.objects ?? [];
  const ph = evaluate(objects, env);
  const sceneName = d?.name ?? 'All cameras';
  p.currentSection = `Camera sheet · ${sceneName}`;
  p.newPage();

  /* Title block */
  p.micro('Camera department setup sheet', p.M, p.y + 3, C.fg3);
  p.font('uiSb', 20, C.ink);
  p.text(clean(sceneName), p.M, p.y + 11);
  if (d?.sceneNumber) {
    p.fill(C.yellow);
    const tw = p.doc.getTextWidth(clean(sceneName));
    p.doc.rect(p.M + tw + 4, p.y + 4.5, 22, 8, 'F');
    p.font('monoMd', 9, C.ink);
    p.text(`SC ${clean(d.sceneNumber)}`, p.M + tw + 15, p.y + 10, { align: 'center' });
  }
  p.y += 16;

  /* 1. Production */
  heading(p, 1, 'Production');
  const cs = project.callSheet;
  const day = cs.isoDate ? fmtDate(parseIsoDate(cs.isoDate), undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
  kvGrid(p, [
    ['Production', project.name],
    ['Scene', `${sceneName}${d?.sceneNumber ? ` (scene ${d.sceneNumber})` : ''}`],
    ['Shoot date', day || 'Not set'],
    ['Call time', cs.callTime || 'Not set'],
    ['Location', cs.locationName || settings.location.name],
    ['Cameras', cams.map((c) => `${letterOf(project, c)}: ${cameraConfig(c).model}`).join(', ') || 'None yet'],
  ]);
  const notes: [string, string][] = [];
  if (d?.cameraNotes) notes.push(['Camera notes', d.cameraNotes]);
  if (d?.notes) notes.push(['General notes', d.notes]);
  for (const [l, v] of notes) {
    p.micro(l, p.M, p.y + 2);
    p.y += 3;
    p.y += p.para(v, p.M, p.y + 2, p.cw, 8.5, 'ui', C.fg2) + 3;
  }

  /* 2. Camera configuration */
  heading(p, 2, 'Camera configuration', `${cams.length} camera${cams.length === 1 ? '' : 's'}`);
  if (!cams.length) p.y += p.para('No cameras in Gear yet. Add them on the Cameras page.', p.M, p.y + 2, p.cw, 9, 'ui', C.fg3) + 2;
  for (const cam of cams) {
    const cfg = withRigNd(cameraConfig(cam), cam.id, project.gear);
    const lensItem = project.gear.find((g) => g.id === cfg.lensGearId);
    const dd = derive(cfg);
    const b = bodyOf(cfg);
    const t = shutterSeconds(cfg);
    const exp = exposureLabel(exposureOffset(cfg, ph.total));
    p.ensure(60);
    p.subTitle(`Camera ${letterOf(project, cam)} · ${cam.name.replace(/^Camera [A-Z] · /, '')}`, `${b.mount} mount · ${dd.sensor.name}`);
    kvGrid(p, configRows(cfg, lensItem, dd, t, b.usesEI));
    p.ensure(12);
    p.fill(exp.level === 'ok' ? C.wash : C.bone);
    p.doc.rect(p.M, p.y, p.cw, 9, 'F');
    p.micro('Exposure at the subject', p.M + 3, p.y + 5.8, C.fg2);
    p.font('monoMd', 9, exp.level === 'bad' ? C.danger : C.ink);
    p.text(clean(`${exp.text} · ${Math.round(ph.total * 800)} lux on the face`), p.M + 48, p.y + 6);
    p.y += 12;
    const warns = warnings(cfg, lensItem?.lens);
    for (const w of warns.slice(0, 5)) {
      p.ensure(6);
      p.y += p.para(`${w.level === 'warn' ? '!' : '·'} ${w.text}`, p.M, p.y + 2, p.cw, 7.5, 'ui', w.level === 'warn' ? C.danger : C.fg2) + 1;
    }
    p.y += 3;
  }

  /* 3. Rig diagrams */
  // Keep the heading with the first drawing.
  p.ensure(20 + p.cw * 0.6 + 10);
  heading(p, 3, 'Rig diagrams', 'Body and lens to the maker’s sizes; accessories typical');
  for (const cam of cams) {
    const parts = rigParts(cam, project.gear);
    const png = renderRigPng(cam, project.gear, project.connections, 1500, 900, true);
    const w = p.cw;
    const h = w * 0.6;
    p.ensure(h + 10);
    p.micro(`Camera ${letterOf(project, cam)} · ${parts.length} parts on the rig · ${(([cam, ...parts].reduce((a, g) => a + (g.weightKg ?? 0), 0)) as number).toFixed(2)} kg`, p.M, p.y + 3);
    p.y += 5;
    if (png) {
      p.doc.addImage(png, 'PNG', p.M, p.y, w, h, undefined, 'FAST');
      p.stroke(C.lineStrong, 0.2);
      p.doc.rect(p.M, p.y, w, h, 'S');
      p.y += h + 5;
    } else p.y += p.para('This device could not draw the 3D rig. The parts are listed in the checklist below.', p.M, p.y + 2, p.cw, 8.5, 'ui', C.fg3) + 4;
  }

  /* 4. Equipment checklist */
  heading(p, 4, 'Equipment checklist', 'Tick as you pack and build');
  const rows: { box: string; group: string; item: string; qty: string; note: string }[] = [];
  for (const cam of cams) {
    const L = `Camera ${letterOf(project, cam)}`;
    rows.push({ box: '', group: L, item: cam.name, qty: String(Math.max(1, cam.qty)), note: cam.power ? `Battery: ${cam.power}` : '' });
    for (const g of rigParts(cam, project.gear)) rows.push({ box: '', group: L, item: g.name, qty: String(Math.max(1, g.qty)), note: categoryInfo(g.category).label });
  }
  const camIds = new Set(cams.map((c) => c.id));
  const sceneConns = project.connections.filter((c) => [c.fromGear, c.toGear].some((id) => camIds.has(id) || camIds.has(rigKey(project.gear.find((g) => g.id === id) ?? ({} as GearItem)) ?? '')));
  for (const c of cableSummary(project.gear, sceneConns)) rows.push({ box: '', group: 'Cables', item: c.name, qty: String(c.need), note: c.owned >= c.need ? 'In your gear' : `Bring ${c.need - c.owned} more` });
  rows.push({ box: '', group: 'Media and power', item: 'Formatted memory cards', qty: String(cams.length * 2), note: 'Two per camera' });
  rows.push({ box: '', group: 'Media and power', item: 'Charged spare batteries', qty: String(cams.length * 2), note: 'Per camera, plus chargers' });
  checklistTable(p, rows);

  /* 5. Connections */
  heading(p, 5, 'Connections', `${sceneConns.length} links`);
  drawConnectionDiagram(p, project.gear, sceneConns, cams);
  if (sceneConns.length) {
    const nm = (id: string) => project.gear.find((g) => g.id === id)?.name.replace(/^Camera ([A-Z]) · .*/, 'Camera $1') ?? 'Missing item';
    const port = (gid: string, pid: string) => project.gear.find((g) => g.id === gid)?.ports.find((x) => x.id === pid);
    table(
      p,
      [
        { label: 'From', get: (c: Connection) => `${nm(c.fromGear)} · ${port(c.fromGear, c.fromPort)?.name ?? '?'}` },
        { label: 'To', get: (c: Connection) => `${nm(c.toGear)} · ${port(c.toGear, c.toPort)?.name ?? '?'}` },
        { label: 'Link', w: 40, get: (c: Connection) => { const a = port(c.fromGear, c.fromPort); const b = port(c.toGear, c.toPort); return a?.signal === 'mount' ? 'Mounted' : a && b ? cableFor(a.connector, b.connector) ?? (a.connector === 'Wireless' ? 'Wireless' : 'Fitted directly') : '?'; } },
      ],
      sceneConns,
      { size: 7.5 },
    );
    p.y += 3;
  }
  const issues = checkProduction(project.gear, project.connections).filter((i) => i.gearIds.some((id) => camIds.has(id) || camIds.has(rigKey(project.gear.find((g) => g.id === id) ?? ({} as GearItem)) ?? '')));
  if (issues.length) {
    p.ensure(12);
    p.micro('Missing or incompatible', p.M, p.y + 2, C.danger);
    p.y += 4;
    for (const i of issues) {
      p.ensure(6);
      p.y += p.para(`${i.level === 'error' ? '!' : '·'} ${i.text}`, p.M, p.y + 2, p.cw, 8, 'ui', i.level === 'error' ? C.danger : C.fg2) + 1;
    }
  } else {
    p.ensure(8);
    p.micro('No missing or incompatible items found', p.M, p.y + 3, C.ok);
    p.y += 6;
  }

  /* 6. Lighting and environment */
  heading(p, 6, 'Lighting and environment', ENV_PRESETS.find((e) => e.id === env.preset)?.label ?? 'Custom');
  if (d) {
    const sensor = getSensor(project.camera.sensorId, project.camera.customSensor);
    const fov = fieldOfView(project.camera.focalLength, sensor.width, sensor.height);
    const png = renderDiagramPng(objects, 1200, 900, fov.horizontal, 'light', 1.5, 'all', planLinks(objects, project.gear, project.connections));
    const w = p.cw * 0.62;
    const h = w * 0.75;
    p.ensure(h + 6);
    const top = p.y;
    p.doc.addImage(png, 'PNG', p.M, p.y, w, h, undefined, 'FAST');
    p.stroke(C.lineStrong, 0.2);
    p.doc.rect(p.M, p.y, w, h, 'S');
    const sx = p.M + w + 5;
    const sw = p.cw - w - 5;
    let y = top;
    const envRows: [string, string][] = env.outdoor
      ? [['Location', 'Outdoors'], ['Ground', env.floorColour.toUpperCase()], ['Sky light', `${env.ambientLux} lux, ${env.ambientKelvin} K`], ['Sun', env.sun ? `${env.sunAzimuth}°, ${env.sunElevation}° high` : 'None']]
      : [['Walls', `${env.wallColour.toUpperCase()}, ${Math.round(env.wallReflect * 100)}% reflect, ${env.material}`], ['Floor', env.floorColour.toUpperCase()], ['Background', `${env.wallDistance} m behind subject`], ['Room', `${env.roomWidth} m wide, ${env.ceilingHeight} m ceiling`], ['Light already there', `${env.ambientLux} lux, ${env.ambientKelvin} K`]];
    for (const [l, v] of envRows) {
      p.micro(l, sx, y + 3);
      p.font('mono', 8, C.ink);
      p.text(clean(v), sx, y + 7, { maxWidth: sw });
      y += 9.5;
    }
    p.micro('Light on the face', sx, y + 3);
    p.font('monoMd', 10, C.ink);
    p.text(`${Math.round(ph.total * 800)} lux`, sx, y + 8);
    y += 11;
    p.micro('Key to fill', sx, y + 3);
    p.font('monoMd', 10, C.ink);
    p.text(Number.isFinite(ph.ratio) ? `${ph.ratio.toFixed(1)}:1` : 'No fill', sx, y + 8);
    p.y = Math.max(top + h, y + 10) + 4;
    const lights = objects.filter((o): o is DiagramLight => o.type === 'light');
    const subject = objects.find((o): o is DiagramSubject => o.type === 'subject');
    if (lights.length)
      table(
        p,
        [
          { label: 'Light', get: (l: DiagramLight) => l.label },
          { label: 'Role', w: 22, get: (l) => LIGHT_KINDS.find((k) => k.id === l.kind)?.label.replace(' light', '') ?? l.kind },
          { label: 'Fixture', w: 30, get: (l) => (EMITTING.includes(l.kind) ? fixtureInfo(l.fixture)?.label ?? 'LED (open)' : '-') },
          { label: 'Diffusion', w: 18, get: (l) => DIFFUSION.find((x) => x.id === (l.diffusion ?? 'none'))?.label.replace(/ \(.*\)/, '') ?? 'None' },
          { label: 'Power', w: 12, get: (l) => (EMITTING.includes(l.kind) ? `${l.power}%` : '-'), mono: true, align: 'right' },
          { label: 'Colour', w: 18, get: (l) => (EMITTING.includes(l.kind) ? (l.gel ? `gel ${l.gel}` : `${l.kelvin} K`) : '-'), mono: true },
          { label: 'Height', w: 13, get: (l) => `${l.height.toFixed(2)} m`, mono: true, align: 'right' },
          { label: 'Distance', w: 15, get: (l) => (subject ? `${Math.hypot(l.x - subject.x, l.y - subject.y).toFixed(2)} m` : '-'), mono: true, align: 'right' },
        ],
        lights,
        { size: 7.2 },
      );
    p.y += 3;
  } else p.y += p.para('No set-up on the shoot plan yet.', p.M, p.y + 2, p.cw, 9, 'ui', C.fg3) + 2;

  /* 7. Subjects and composition */
  heading(p, 7, 'Subjects and composition');
  const people = objects.filter((o): o is DiagramSubject => o.type === 'subject');
  const furniture = objects.filter((o) => o.type === 'zone' && isFurniture(o.zoneKind));
  if (people.length) {
    table(
      p,
      [
        { label: 'Subject', get: (s: DiagramSubject) => s.label },
        { label: 'Pose', w: 38, get: (s) => (s.subjectKind === 'person' ? POSES.find((x) => x.id === (s.pose ?? 'standing'))?.label ?? 'Standing' : 'Object') },
        { label: 'Eye height', w: 20, get: (s) => `${bodyExtent(s).eye.toFixed(2)} m`, mono: true, align: 'right' },
        { label: 'Position', w: 28, get: (s) => `${s.x.toFixed(2)}, ${s.y.toFixed(2)} m`, mono: true },
        { label: 'Facing', w: 14, get: (s) => `${Math.round(s.rotation)}°`, mono: true, align: 'right' },
      ],
      people,
      { size: 7.5 },
    );
    p.y += 3;
  } else p.y += p.para('No subjects placed.', p.M, p.y + 2, p.cw, 9, 'ui', C.fg3) + 2;
  if (furniture.length) {
    p.ensure(8);
    p.micro(`Set: ${furniture.map((f) => (f.type === 'zone' ? `${f.label} (${furnitureInfo(f.zoneKind)?.label ?? ''}, ${f.w} × ${f.h} m)` : '')).join(' · ')}`, p.M, p.y + 2, C.fg2);
    p.y += 6;
  }
  for (const cam of cams) {
    const co = objects.find((o) => o.type === 'camera' && 'gearId' in o && o.gearId === cam.id);
    if (!co || !people.length) continue;
    const cfg = cameraConfig(cam);
    const dd = derive(cfg);
    const fr = framing(objects, co, { height: cfg.height, tilt: cfg.tilt, hfov: dd.hfov, vfov: dd.vfov });
    p.ensure(8);
    p.micro(`Camera ${letterOf(project, cam)} framing · ${cfg.focalLength} mm at ${cfg.height.toFixed(2)} m, tilt ${cfg.tilt}°`, p.M, p.y + 2);
    p.y += 4;
    p.y += p.para(fr.map((f) => `${f.label}: ${f.inFrame ? `${f.shot ?? '-'}${f.partly ? ' (cut by frame edge)' : ''}` : 'out of frame'}, ${f.distance.toFixed(1)} m`).join('   ·   '), p.M, p.y + 2, p.cw, 8, 'ui', C.ink) + 3;
  }

  /* 8. Setup steps */
  heading(p, 8, 'Setup, step by step');
  const steps = setupSteps(project, d, cams, sceneConns);
  steps.forEach((s, i) => {
    const h = p.measure(s, p.cw - 10, 8.5) + 2;
    p.ensure(h + 1);
    p.stroke(C.ink, 0.25);
    p.doc.rect(p.M, p.y + 0.6, 3.2, 3.2, 'S');
    p.micro(String(i + 1).padStart(2, '0'), p.M + 5, p.y + 3.4, C.fg3);
    p.y += p.para(s, p.M + 12, p.y + 3, p.cw - 12, 8.5, 'ui', C.ink) + 1.5;
  });
}

function configRows(c: CameraConfig, lens: GearItem | undefined, d: ReturnType<typeof derive>, t: number, usesEI: boolean): [string, string][] {
  const prof = profile(c.profile);
  return [
    ['Body', `${c.manufacturer} ${c.model}`],
    ['Lens', lens ? lens.name : 'None attached'],
    ['Focal length', `${c.focalLength} mm (${d.hfov.toFixed(1)}° wide)`],
    ['Aperture', `f/${c.aperture}`],
    ['Shutter', `${c.shutterMode === 'angle' ? `${c.shutterAngle}° = ` : ''}1/${Math.round(1 / t)} s`],
    [usesEI ? 'ISO / EI' : 'ISO', String(c.iso)],
    ['ND', c.ndStops ? `${c.ndStops.toFixed(1)} stops` : 'None'],
    ['White balance', `${c.kelvin} K${c.tint ? `, tint ${c.tint > 0 ? '+' : ''}${c.tint}` : ''}`],
    ['Focus', `${c.focusMode}, ${c.focusDistance.toFixed(2)} m`],
    ['In focus', `${d.dof.near.toFixed(2)} to ${Number.isFinite(d.dof.far) ? `${d.dof.far.toFixed(2)} m` : 'infinity'}`],
    ['Resolution', c.resolution],
    ['Frame rate', `${c.fps} fps`],
    ['Codec', `${c.codec} (${c.format})`],
    ['Bit depth / chroma', `${c.bitDepth}, ${c.chroma}`],
    ['Profile', `${prof.name}${prof.kind === 'log' ? (c.monitorLut ? ', monitor with LUT' : ', monitor in Log') : ''}`],
    ['Colour space', c.colourSpace],
    ['Stabilisation', c.stabilisation],
    ['Lens height / tilt', `${c.height.toFixed(2)} m, ${c.tilt}°`],
    ...(c.notes ? ([['Notes', c.notes]] as [string, string][]) : []),
  ];
}

function checklistTable(p: Pack, rows: { box: string; group: string; item: string; qty: string; note: string }[]) {
  table(
    p,
    [
      { label: 'Done', w: 10, get: () => '[  ]', mono: true },
      { label: 'Item', get: (r) => r.item },
      { label: 'Qty', w: 12, get: (r) => r.qty, mono: true, align: 'right' },
      { label: 'Note', w: 50, get: (r) => r.note },
    ],
    rows,
    { size: 7.8, groupOf: (r) => r.group },
  );
  p.y += 3;
}

/** Items laid out in columns by hops from each camera, with lines coloured by signal. */
function drawConnectionDiagram(p: Pack, gear: GearItem[], conns: Connection[], cams: GearItem[]) {
  if (!conns.length) {
    p.y += p.para('Nothing connected yet. Use Auto Connect on the Cameras or Gear page.', p.M, p.y + 2, p.cw, 8.5, 'ui', C.fg3) + 3;
    return;
  }
  const ids = new Set<string>();
  for (const c of conns) {
    ids.add(c.fromGear);
    ids.add(c.toGear);
  }
  const depth = new Map<string, number>();
  const queue = cams.filter((c) => ids.has(c.id)).map((c) => c.id);
  for (const id of queue) depth.set(id, 0);
  while (queue.length) {
    const id = queue.shift()!;
    for (const c of conns) {
      const other = c.fromGear === id ? c.toGear : c.toGear === id ? c.fromGear : null;
      if (other && !depth.has(other)) {
        depth.set(other, (depth.get(id) ?? 0) + 1);
        queue.push(other);
      }
    }
  }
  for (const id of ids) if (!depth.has(id)) depth.set(id, 1);
  const maxD = Math.max(...depth.values());
  const cols: string[][] = Array.from({ length: maxD + 1 }, () => []);
  for (const [id, dd] of depth) cols[dd].push(id);
  const boxW = Math.min(46, (p.cw - (maxD) * 10) / (maxD + 1));
  const gapX = maxD ? (p.cw - boxW * (maxD + 1)) / maxD : 0;
  const boxH = 8;
  const gapY = 3.5;
  const rowsN = Math.max(...cols.map((c) => c.length));
  const h = rowsN * (boxH + gapY) + 4;
  p.ensure(Math.min(h, p.bottom - p.top - 10));
  const top = p.y;
  const pos = new Map<string, { x: number; y: number }>();
  cols.forEach((col, ci) => {
    const offset = ((rowsN - col.length) * (boxH + gapY)) / 2;
    col.forEach((id, ri) => pos.set(id, { x: p.M + ci * (boxW + gapX), y: top + offset + ri * (boxH + gapY) }));
  });
  // Lines first, under the boxes.
  for (const c of conns) {
    const a = pos.get(c.fromGear);
    const b = pos.get(c.toGear);
    if (!a || !b) continue;
    const sig = gear.find((g) => g.id === c.fromGear)?.ports.find((x) => x.id === c.fromPort)?.signal ?? 'data';
    p.stroke(SIGNAL_RGB[sig] ?? C.fg2, sig === 'mount' ? 0.25 : 0.55);
    if (sig === 'mount') p.doc.setLineDashPattern([0.8, 0.8], 0);
    const [ax, bx] = a.x <= b.x ? [a.x + boxW, b.x] : [a.x, b.x + boxW];
    p.doc.line(a.x === b.x ? a.x + boxW : ax, a.y + boxH / 2, a.x === b.x ? b.x + boxW : bx, b.y + boxH / 2);
    p.doc.setLineDashPattern([], 0);
  }
  for (const [id, at] of pos) {
    const g = gear.find((x) => x.id === id);
    const isCam = g?.category === 'camera';
    p.fill(isCam ? C.yellow : C.white);
    p.doc.rect(at.x, at.y, boxW, boxH, 'F');
    p.stroke(C.ink, 0.3);
    p.doc.rect(at.x, at.y, boxW, boxH, 'S');
    p.font(isCam ? 'uiSb' : 'ui', 6.8, C.ink);
    const name = clean((g?.name ?? 'Missing').replace(/^Camera ([A-Z]) · /, 'Cam $1 · '));
    p.text(name.length > 34 ? name.slice(0, 33) + '…' : name, at.x + 1.6, at.y + 5.2, { maxWidth: boxW - 3 });
  }
  p.y = top + h;
  // Legend
  let lx = p.M;
  for (const [sig, label] of [['video', 'Video'], ['audio', 'Audio'], ['power', 'Power'], ['data', 'Data'], ['mount', 'Mounted (dashed)']] as const) {
    p.stroke(SIGNAL_RGB[sig], 0.6);
    p.doc.line(lx, p.y + 1.5, lx + 6, p.y + 1.5);
    p.micro(label, lx + 8, p.y + 2.4, C.fg2);
    lx += 34;
  }
  p.y += 6;
}

/** Plain steps in the order a crew builds the set-up. */
export function setupSteps(project: Project, d: LightingDiagram | null, cams: GearItem[], conns: Connection[]): string[] {
  const out: string[] = [];
  const env = envOf(d ?? undefined);
  const objects = d?.objects ?? [];
  const nm = (id: string) => project.gear.find((g) => g.id === id)?.name ?? 'item';
  const port = (gid: string, pid: string) => project.gear.find((g) => g.id === gid)?.ports.find((x) => x.id === pid);
  if (d) {
    out.push(env.outdoor ? `Check the location: ${env.sun ? `sun from ${env.sunAzimuth}° at ${env.sunElevation}° high` : 'overcast sky'}, about ${env.ambientLux} lux. Plan shade, flags or ND for the brightest moments.` : `Prepare the room: ${Math.round(env.wallReflect * 100)}% reflective walls bounce your lights as fill${env.wallReflect > 0.6 ? ' (use negative fill or black flags where you want contrast)' : ''}. Turn off or gel practicals that are not part of the look (room light about ${env.ambientLux} lux at ${env.ambientKelvin} K).`);
    const furn = objects.filter((o) => o.type === 'zone' && isFurniture(o.zoneKind));
    const marks = objects.filter((o) => o.type === 'mark');
    if (furn.length || marks.length) out.push(`Dress the set: place ${[...furn.map((f) => f.label), ...marks.map((m) => `mark ${m.label}`)].join(', ')} as on the plan, measured from the subject's position.`);
  }
  for (const cam of cams) {
    const L = `Camera ${letterOf(project, cam)}`;
    const mounts = conns.filter((c) => port(c.fromGear, c.fromPort)?.signal === 'mount' && (c.fromGear === cam.id || c.toGear === cam.id || rigKey(project.gear.find((g) => g.id === c.fromGear)!) === cam.id));
    const support = rigParts(cam, project.gear).find((g) => g.category === 'support');
    if (support) out.push(`${L}: set up the ${support.name.toLowerCase()} and level it${support.payloadKg ? ` (rated ${support.payloadKg} kg)` : ''}.`);
    // Build order: cage, lens, filters, then onto the support, then everything on top.
    const RANK = ['cage', 'adapter', 'lens', 'filter', 'filter-tray', 'rod-plate', 'tripod', 'monopod', 'gimbal', 'nato-rail', 'top-handle', 'side-handle', 'arm', 'monitor', 'follow-focus', 'matte-box', 'vmount-plate', 'wireless-rx', 'mic-oncam', 'video-tx'];
    const order = (c: Connection) => {
      const k = project.gear.find((g) => g.id === c.toGear)?.rigKind ?? '';
      const i = RANK.indexOf(k);
      return i < 0 ? RANK.length : i;
    };
    for (const c of mounts.slice().sort((a, b) => order(a) - order(b))) {
      const to = port(c.toGear, c.toPort);
      const from = port(c.fromGear, c.fromPort);
      const k = project.gear.find((g) => g.id === c.toGear)?.rigKind ?? '';
      const host = nm(c.fromGear).replace(/^Camera [A-Z] · /, '');
      const where = `${from?.name ?? ''}${to?.standard || from?.standard ? `, ${to?.standard ?? from?.standard}` : ''}`;
      out.push(['tripod', 'monopod', 'gimbal'].includes(k) ? `${L}: mount the rig on the ${nm(c.toGear)} by the ${host} (${where}). Check balance before letting go.` : `${L}: fit the ${nm(c.toGear)} to the ${host} (${where}).`);
    }
    for (const c of conns.filter((x) => port(x.fromGear, x.fromPort)?.signal !== 'mount' && (x.fromGear === cam.id || x.toGear === cam.id || [x.fromGear, x.toGear].some((id) => rigKey(project.gear.find((g) => g.id === id) ?? ({} as GearItem)) === cam.id)))) {
      const a = port(c.fromGear, c.fromPort);
      const b = port(c.toGear, c.toPort);
      const cable = a && b ? cableFor(a.connector, b.connector) : null;
      out.push(
        cable
          ? `${L}: run a ${cable} from ${nm(c.fromGear)} ${a?.name} to ${nm(c.toGear)} ${b?.name}. Dress it so it cannot pull on the port.`
          : a?.connector === 'Battery plate'
            ? `${L}: charge and fit the ${nm(c.fromGear)} to the ${nm(c.toGear).replace(/^Camera [A-Z] · /, '')}.`
            : `${L}: pair ${nm(c.fromGear)} with ${nm(c.toGear)} and check the signal.`,
      );
    }
    const cfg = withRigNd(cameraConfig(cam), cam.id, project.gear);
    const t = shutterSeconds(cfg);
    out.push(`${L}: set ${cfg.resolution}, ${cfg.fps} fps, ${cfg.codec} ${cfg.bitDepth} ${cfg.chroma}, ${profile(cfg.profile).name}, ${cfg.colourSpace}.`);
    out.push(`${L}: set exposure: ${cfg.shutterMode === 'angle' ? `${cfg.shutterAngle}° (1/${Math.round(1 / t)})` : `1/${Math.round(1 / t)}`}, f/${cfg.aperture}, ISO ${cfg.iso}${cfg.ndStops ? `, ND ${cfg.ndStops.toFixed(1)} stops` : ''}, white balance ${cfg.kelvin} K${cfg.tint ? ` tint ${cfg.tint}` : ''}.`);
    out.push(`${L}: lens height ${cfg.height.toFixed(2)} m, tilt ${cfg.tilt}°, ${cfg.focalLength} mm, focus ${cfg.focusMode} at ${cfg.focusDistance.toFixed(2)} m.`);
  }
  const lights = objects.filter((o): o is DiagramLight => o.type === 'light' && EMITTING.includes(o.kind));
  const subject = objects.find((o): o is DiagramSubject => o.type === 'subject');
  for (const l of lights) {
    const fx = fixtureInfo(l.fixture)?.label ?? 'LED, open face';
    out.push(`Place the ${l.label.toLowerCase().includes('light') ? l.label : `${l.label} light`} (${fx}${l.diffusion && l.diffusion !== 'none' ? `, ${l.diffusion} diffusion` : ''})${subject ? ` ${Math.hypot(l.x - subject.x, l.y - subject.y).toFixed(1)} m from the subject` : ''} at ${l.height.toFixed(1)} m, ${l.power}% and ${l.gel ? `gel ${l.gel}` : `${l.kelvin} K`}. Sandbag the stand.`);
  }
  const mods = objects.filter((o): o is DiagramLight => o.type === 'light' && !EMITTING.includes(o.kind));
  if (mods.length) out.push(`Add ${mods.map((m) => m.label).join(', ')} as on the plan.`);
  out.push('Power up, check every monitor has a picture and every mic has level. Charge or swap anything under half.');
  out.push('Check framing and focus on each camera, compare exposure against the sheet, and record a 10 second test clip on every camera.');
  return out;
}
