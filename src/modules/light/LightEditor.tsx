import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { ArrowLeft, Cable, Copy, Download, Link2, Lock, LockOpen, Maximize2, Minus, Pencil, Plus, Redo2, Trash2, Undo2, Magnet, Crosshair, Sun } from 'lucide-react';
import { Blueprint } from '@/components/Blueprint';
import { Button } from '@/components/Button';
import { Segmented } from '@/components/Segmented';
import { Slider } from '@/components/Slider';
import { Stepper } from '@/components/Stepper';
import { Check, NumberField, SelectField, TextAreaField, TextField } from '@/components/Field';
import { Readout } from '@/components/Readout';
import { Tabs } from '@/components/Tabs';
import { Sheet } from '@/components/Sheet';
import { Expander, Formula } from '@/components/Expander';
import { useProject, useProjects } from '@/store/projects';
import { useSettings } from '@/store/settings';
import { envOf, FIXTURES, DIFFUSION, fixtureInfo } from '@/lib/light/environment';
import { EnvironmentPanel } from './EnvironmentPanel';
import { CameraSheetButton } from '@/modules/export/CameraSheetButton';
import { FURNITURE, POSES, bodyExtent, furnitureInfo, isFurniture, seatOf, seatPeople } from '@/lib/scene/pose';
import { cameraConfig, derive, exposureLabel, exposureOffset } from '@/lib/camera/settings';
import { framing, framingSummary } from '@/lib/scene/framing';
import { withRigNd } from '@/lib/camera/nd';
import { toast } from '@/store/toast';
import { uid } from '@/lib/id';
import { useMedia } from '@/lib/useMedia';
import { useUnits } from '@/lib/useUnits';
import { getSensor } from '@/lib/calc/sensors';
import { fieldOfView } from '@/lib/calc/optics';
import { COLOUR_TEMP_PRESETS } from '@/lib/calc/light';
import { evaluate, ratioLabel, EMITTING } from '@/lib/light/photometry';
import { dayTimes, sunPosition, tzOffsetMinutes, zonedDate } from '@/lib/sun';
import { fmtNum, pad2, todayIso } from '@/lib/format';
import { downloadDataUrl, safeFilename } from '@/lib/download';
import { LIGHT_KINDS, ZONE_KINDS, type Connection, type DiagramLight, type DiagramObject, type GearCategory, type GearItem, type LightingDiagram, type LightKind, type ZoneKind, type FurnitureKind, type DiagramZone } from '@/types/project';
import { CATEGORIES, PLAN_VIEWS, TEMPLATES, categoryInfo, gearFromTemplate, inView, layerOf, nextName, planLinks, type GearTemplate, type PlanView } from '@/lib/gear/catalog';
import { ConnectSheet } from '@/modules/gear/ConnectSheet';
import { GearEditor } from '@/modules/gear/GearPage';
import { DiagramCanvas } from './DiagramCanvas';
import { useHistory } from './useHistory';
import { PRESETS, defaultLight } from './presets';
import { renderDiagramPng } from './diagramPng';
import { lightColour } from './draw';
import './light.css';

const LiveView = lazy(() => import('./LiveView'));

/** Rotation (degrees, 0 = +y, clockwise) that points from one plan position at another. */
function aimDeg(fromX: number, fromY: number, toX: number, toY: number): number {
  return Math.round(((Math.atan2(toX - fromX, toY - fromY) * 180) / Math.PI + 360) % 360);
}

export default function LightEditor() {
  const { id } = useParams();
  const project = useProject();
  const existing = project.diagrams.find((d) => d.id === id);
  if (!existing) return <Navigate to="/plan" replace />;
  return <Editor key={existing.id} initial={existing} />;
}

type Panel = 'add' | 'selected' | 'scene' | 'readouts';

function Editor({ initial }: { initial: LightingDiagram }) {
  const project = useProject();
  const patch = useProjects((s) => s.patchCurrent);
  const settings = useSettings();
  const u = useUnits();
  const desktop = useMedia('(min-width: 900px)');
  const history = useHistory<DiagramObject[]>(initial.objects);
  const objects = history.present;
  const [meta, setMeta] = useState({ name: initial.name, notes: initial.notes, showSunPath: initial.showSunPath, gridSize: initial.gridSize, environment: envOf(initial), sceneNumber: initial.sceneNumber ?? '', cameraNotes: initial.cameraNotes ?? '' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snap, setSnap] = useState(true);
  const [fitKey, setFitKey] = useState(1);
  const [panel, setPanel] = useState<Panel>('add');
  const [sheet, setSheet] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [showLive, setShowLive] = useState(true);
  const [liveMode, setLiveMode] = useState<'camera' | 'orbit'>('camera');
  const [view, setView] = useState<PlanView>('all');
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [editGear, setEditGear] = useState<string | null>(null);
  const [sunDate, setSunDate] = useState(todayIso());
  const [sunTime, setSunTime] = useState(() => {
    const d = new Date();
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  });

  const sensor = getSensor(project.camera.sensorId, project.camera.customSensor);
  const fov = fieldOfView(project.camera.focalLength, sensor.width, sensor.height);
  const photometry = useMemo(() => evaluate(objects, meta.environment), [objects, meta.environment]);
  const links = useMemo(() => planLinks(objects, project.gear, project.connections), [objects, project.gear, project.connections]);
  const placedGear = new Set(objects.map((o) => ('gearId' in o ? o.gearId : undefined)).filter(Boolean) as string[]);
  const selected = objects.find((o) => o.id === selectedId) ?? null;
  // Look through the selected camera, or the first one; with real settings when it is a camera from Gear.
  const camObjs = objects.filter((o) => o.type === 'camera');
  const lookCam = (selected?.type === 'camera' ? selected : undefined) ?? camObjs.find((o) => 'gearId' in o && o.gearId) ?? camObjs[0];
  const lookGear = lookCam && 'gearId' in lookCam ? project.gear.find((g) => g.id === lookCam.gearId) : undefined;
  // How each camera on the plan frames each person, from its real lens, height and tilt when it has settings.
  const camFraming = camObjs.map((co) => {
    const g = 'gearId' in co ? project.gear.find((x) => x.id === co.gearId && x.category === 'camera') : undefined;
    const cfg = g ? cameraConfig(g) : undefined;
    const dd = cfg ? derive(cfg) : undefined;
    const lens = dd && cfg ? { height: cfg.height, tilt: cfg.tilt, hfov: dd.hfov, vfov: dd.vfov } : { height: 1.5, tilt: 0, hfov: fov.horizontal, vfov: fov.vertical };
    return { id: co.id, label: co.label || 'Camera', frames: framing(objects, co, lens), lensNote: cfg ? `${cfg.focalLength} mm at ${cfg.height.toFixed(2)} m, tilt ${cfg.tilt}°` : `Project lens, ${project.camera.focalLength} mm at 1.5 m` };
  });
  const lookConfig = lookGear?.category === 'camera' ? withRigNd(cameraConfig(lookGear), lookGear.id, project.gear) : undefined;

  /* ---------- persistence ---------- */
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      patch((p) => ({ diagrams: p.diagrams.map((d) => (d.id === initial.id ? { ...d, objects, ...meta, updatedAt: Date.now() } : d)) }));
    }, 300);
    return () => clearTimeout(t);
  }, [objects, meta, initial.id, patch]);

  /* ---------- sun path overlay ---------- */
  const sunPath = useMemo(() => {
    if (!meta.showSunPath) return null;
    const { lat, lng } = settings.location;
    const tz = settings.timezone;
    const instant = zonedDate(sunDate, sunTime, tz);
    const off = tzOffsetMinutes(instant, tz);
    const day = dayTimes(instant, lat, lng, off);
    const pts: { az: number; label: string; alt: number }[] = [];
    if (!Number.isNaN(day.sunrise.getTime()) && !Number.isNaN(day.sunset.getTime())) {
      const start = day.sunrise.getTime();
      const end = day.sunset.getTime();
      const steps = 48;
      for (let i = 0; i <= steps; i++) {
        const t = new Date(start + ((end - start) * i) / steps);
        const p = sunPosition(t, lat, lng);
        const hourLocal = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(t));
        const minuteLocal = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, minute: 'numeric' }).format(t));
        const prev = i > 0 ? new Date(start + ((end - start) * (i - 1)) / steps) : null;
        const prevHour = prev ? Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(prev)) : -1;
        const label = i === 0 ? 'rise' : i === steps ? 'set' : hourLocal !== prevHour && minuteLocal < 30 ? `${pad2(hourLocal)}:00` : '';
        pts.push({ az: p.azimuth, alt: p.altitude, label });
      }
    }
    const now = sunPosition(instant, lat, lng);
    return { azimuths: pts, nowAz: now.azimuth, nowAlt: now.altitude };
  }, [meta.showSunPath, settings.location, settings.timezone, sunDate, sunTime]);

  /* ---------- object edits ---------- */
  const commitObjects = useCallback((next: DiagramObject[], key?: string) => history.commit(next, key), [history]);

  const updateObj = useCallback(
    (objId: string, delta: Partial<DiagramObject>, key?: string) => {
      commitObjects(
        objects.map((o) => (o.id === objId ? ({ ...o, ...delta } as DiagramObject) : o)),
        key ? `${objId}:${key}` : undefined,
      );
    },
    [objects, commitObjects],
  );

  function addLight(kind: LightKind) {
    const subj = objects.find((o) => o.type === 'subject');
    const sx = subj?.x ?? 0;
    const sy = subj?.y ?? 0;
    const n = objects.filter((o) => o.type === 'light').length;
    const angle = ((n * 50 + 215) % 360) * (Math.PI / 180);
    const r = EMITTING.includes(kind) ? 2.2 : 1.3;
    const light = defaultLight(kind, Math.round((sx + Math.sin(angle) * r) * 4) / 4, Math.round((sy + Math.cos(angle) * r) * 4) / 4);
    light.rotation = aimDeg(light.x, light.y, sx, sy);
    const named = objects.filter((o) => o.type === 'light' && (o as DiagramLight).kind === kind).length;
    if (named > 0) light.label = `${light.label} ${named + 1}`;
    commitObjects([...objects, light]);
    setSelectedId(light.id);
    setPanel('selected');
  }
  function addWall() {
    const wall: DiagramObject = { id: uid(), type: 'wall', x: 0, y: 3, rotation: 0, length: 4, locked: false, label: 'Wall' };
    commitObjects([...objects, wall]);
    setSelectedId(wall.id);
    setPanel('selected');
  }
  function addSubject() {
    const s: DiagramObject = { id: uid(), type: 'subject', subjectKind: 'object', height: 1, x: 1.5, y: 0.5, rotation: 180, locked: false, label: 'Object' };
    commitObjects([...objects, s]);
    setSelectedId(s.id);
    setPanel('selected');
  }
  const RING: Partial<Record<GearCategory, number>> = { camera: 3.2, mic: 1.3, wireless: 0.9, recorder: 3.6, 'audio-acc': 3.8, monitor: 4.2, light: 2.3, grip: 2.2, power: 5.5, media: 5.5, other: 4.5, lens: 3.2 };
  function spot(category: GearCategory | 'zone' | 'talent' | 'mark'): { x: number; y: number; rotation: number } {
    const subj = objects.find((o) => o.type === 'subject');
    const sx = subj?.x ?? 0;
    const sy = subj?.y ?? 0;
    const r = category === 'zone' ? 7 : category === 'talent' ? 1.2 : category === 'mark' ? 0.8 : RING[category] ?? 3;
    const n = objects.length;
    const angle = (((category === 'camera' ? 180 : category === 'mic' ? 150 : 200) + n * 47) % 360) * (Math.PI / 180);
    const x = Math.round((sx + Math.sin(angle) * r) * 4) / 4;
    const y = Math.round((sy + Math.cos(angle) * r) * 4) / 4;
    return { x, y, rotation: aimDeg(x, y, sx, sy) };
  }
  function place(obj: DiagramObject) {
    commitObjects([...objects, obj]);
    setFitKey((k) => k + 1);
    setSelectedId(obj.id);
    setPanel('selected');
    if (!desktop) setSheet(true);
  }
  function placeGear(g: GearItem) {
    const at = spot(g.category);
    // A camera without gear (the one every new set-up starts with) takes the gear instead of adding a second camera.
    const spare = g.category === 'camera' ? objects.find((o) => o.type === 'camera' && !o.gearId) : undefined;
    if (spare) {
      commitObjects(objects.map((o) => (o.id === spare.id ? { ...o, gearId: g.id, label: g.name } : o)));
      setSelectedId(spare.id);
      setPanel('selected');
      return;
    }
    if (g.category === 'camera') place({ id: uid(), type: 'camera', gearId: g.id, ...at, locked: false, label: g.name });
    else if (g.category === 'light') place(defaultLight('key', at.x, at.y, { gearId: g.id, label: g.name, rotation: at.rotation }));
    else place({ id: uid(), type: 'gear', category: g.category, gearId: g.id, ...at, locked: false, label: g.name });
  }
  function addTemplate(t: GearTemplate) {
    const g = gearFromTemplate(t, nextName(project.gear, t.category, t.name));
    patch((p) => ({ gear: [...p.gear, g] }));
    placeGear(g);
  }
  function addZone(kind: ZoneKind) {
    const at = spot('zone');
    const label = ZONE_KINDS.find((z) => z.id === kind)?.label ?? 'Area';
    place({ id: uid(), type: 'zone', zoneKind: kind, x: at.x, y: at.y, rotation: 0, w: kind === 'base' ? 4 : 3, h: kind === 'base' ? 3 : 2, locked: false, label });
  }
  function addMark() {
    const at = spot('mark');
    place({ id: uid(), type: 'mark', x: at.x, y: at.y, rotation: 0, locked: false, label: `Mark ${objects.filter((o) => o.type === 'mark').length + 1}` });
  }
  function addFurniture(kind: FurnitureKind) {
    const f = furnitureInfo(kind)!;
    const subj = objects.find((o) => o.type === 'subject');
    const cam = objects.find((o) => o.type === 'camera');
    const x = subj ? subj.x : 0;
    const y = subj ? subj.y + 0.3 : 0.3;
    // Face the camera if there is one.
    const rotation = cam ? Math.round(aimDeg(x, y, cam.x, cam.y)) : 180;
    place({ id: uid(), type: 'zone', zoneKind: kind, x, y, rotation, w: f.w, h: f.d, locked: false, label: `${f.label} ${objects.filter((o) => o.type === 'zone' && o.zoneKind === kind).length + 1}` });
  }
  function addTalent() {
    const at = spot('talent');
    place({ id: uid(), type: 'subject', subjectKind: 'person', height: 1.7, x: at.x, y: at.y, rotation: 180, locked: false, label: `Talent ${objects.filter((o) => o.type === 'subject').length + 1}` });
  }

  function removeSelected() {
    if (!selected) return;
    commitObjects(objects.filter((o) => o.id !== selected.id));
    setSelectedId(null);
    setSheet(false);
  }
  function duplicateSelected() {
    if (!selected) return;
    const copy = { ...selected, id: uid(), x: selected.x + 0.5, y: selected.y - 0.5, locked: false, label: `${selected.label} copy` } as DiagramObject;
    commitObjects([...objects, copy]);
    setSelectedId(copy.id);
  }
  function aimAtSubject(o: DiagramObject) {
    const subj = objects.find((x) => x.type === 'subject');
    if (!subj) return;
    updateObj(o.id, { rotation: aimDeg(o.x, o.y, subj.x, subj.y) });
  }
  function loadPreset(id: string) {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    commitObjects(p.build());
    setSelectedId(null);
    setFitKey((k) => k + 1);
    toast(`Loaded ${p.name}`);
  }
  function addSunFromPlanner() {
    if (!sunPath || sunPath.nowAz == null) return;
    if (sunPath.nowAlt <= 0) return toast('The sun is below the horizon at that time');
    const subj = objects.find((o) => o.type === 'subject');
    const sx = subj?.x ?? 0;
    const sy = subj?.y ?? 0;
    const az = (sunPath.nowAz * Math.PI) / 180;
    const x = Math.round((sx + Math.sin(az) * 7) * 10) / 10;
    const y = Math.round((sy + Math.cos(az) * 7) * 10) / 10;
    const existing = objects.find((o) => o.type === 'light' && (o as DiagramLight).kind === 'sun') as DiagramLight | undefined;
    const rotation = aimDeg(x, y, sx, sy);
    const tilt = -Math.round(sunPath.nowAlt);
    const kelvin = sunPath.nowAlt < 10 ? 3200 : sunPath.nowAlt < 25 ? 4300 : 5500;
    if (existing) commitObjects(objects.map((o) => (o.id === existing.id ? { ...existing, x, y, rotation, tilt, kelvin, label: `Sun ${sunTime}` } : o)));
    else commitObjects([...objects, defaultLight('sun', x, y, { rotation, tilt, kelvin, label: `Sun ${sunTime}` })]);
    setFitKey((k) => k + 1);
  }

  /* ---------- keyboard ---------- */
  const hostRef = useRef<HTMLDivElement>(null);
  function onKeyDown(e: React.KeyboardEvent) {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) history.redo();
      else history.undo();
      return;
    }
    if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      history.redo();
      return;
    }
    if (!selected) return;
    const step = e.shiftKey ? 0.5 : 0.1;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      removeSelected();
    } else if (e.key === 'ArrowLeft') updateObj(selected.id, { x: Math.round((selected.x - step) * 100) / 100 }, 'nudge');
    else if (e.key === 'ArrowRight') updateObj(selected.id, { x: Math.round((selected.x + step) * 100) / 100 }, 'nudge');
    else if (e.key === 'ArrowUp') updateObj(selected.id, { y: Math.round((selected.y + step) * 100) / 100 }, 'nudge');
    else if (e.key === 'ArrowDown') updateObj(selected.id, { y: Math.round((selected.y - step) * 100) / 100 }, 'nudge');
    else if (e.key.toLowerCase() === 'd') duplicateSelected();
    else if (e.key.toLowerCase() === 'r') updateObj(selected.id, { rotation: (selected.rotation + (e.shiftKey ? -15 : 15) + 360) % 360 }, 'rot');
    else return;
    e.preventDefault();
  }

  function exportPng() {
    const png = renderDiagramPng(objects, 1600, 1200, fov.horizontal, 'light', 1, view, links);
    downloadDataUrl(png, `${safeFilename(project.name)}-${safeFilename(meta.name)}-${view}.png`);
    toast('PNG exported');
  }

  const gearCtx: GearCtx = { gear: project.gear, connections: project.connections, onConnect: setConnectFrom, onEditGear: setEditGear };
  const propsPanel = selected ? <ObjectProps obj={selected} objects={objects} onChange={updateObj} onAdd={(add) => commitObjects([...objects, ...add])} onAim={() => aimAtSubject(selected)} onDelete={removeSelected} onDuplicate={duplicateSelected} unit={u} ctx={gearCtx} /> : <p className="small muted">Tap something on the plan to edit it.</p>;
  const unplaced = project.gear.filter((g) => !placedGear.has(g.id) && g.category !== 'lens' && (view === 'all' || categoryInfo(g.category).layer === view));
  const templateButtons = (cats: GearCategory[]) =>
    TEMPLATES.filter((t) => cats.includes(t.category)).map((t) => (
      <Button key={t.id} size="sm" variant="quiet" icon={<Plus size={14} />} onClick={() => addTemplate(t)}>
        {t.name}
      </Button>
    ));
  const showLayer = (l: PlanView) => view === 'all' || view === l;

  return (
    <main className="page page--wide" ref={hostRef} onKeyDown={onKeyDown}>
      <div className="page__head page__head--editor">
        <div className="cluster" style={{ flexWrap: 'nowrap', minWidth: 0 }}>
          <Link to="/plan" className="btn btn--ghost btn--sm btn--icon" aria-label="All set-ups">
            <ArrowLeft size={18} />
          </Link>
          <div style={{ minWidth: 0 }}>
            <span className="page__idx">01 · Shoot plan</span>
            <h1 className="visually-hidden">{meta.name}</h1>
            <input className="input" aria-label="Set-up name" value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} style={{ fontWeight: 600, fontSize: 'var(--fs-20)', border: 0, padding: 0, minHeight: 32, background: 'transparent' }} />
          </div>
        </div>
        <div className="page__actions">
          <Button size="sm" variant="quiet" icon={<Download size={14} />} onClick={exportPng}>
            PNG
          </Button>
          <CameraSheetButton diagramId={initial.id} />
          <Button size="sm" variant="primary" icon={<Link2 size={14} />} onClick={() => setAttachOpen(true)}>
            Attach to shot
          </Button>
        </div>
      </div>

      <div className="tool tool--canvas">
        <div className="stack">
          <Segmented
            value={view}
            onChange={(v) => {
              setView(v);
              if (selected && !inView(selected, v)) setSelectedId(null);
            }}
            options={PLAN_VIEWS.map((v) => ({ value: v.id, label: v.label }))}
            block
            label="Plan view"
          />
          <div className="diagram-wrap">
            <DiagramCanvas
              planView={view}
              links={links}
              objects={objects}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                if (id && desktop) setPanel('selected');
              }}
              onLive={history.live}
              onCommit={(o) => history.commit(o)}
              onTapSelected={() => {
                if (!desktop) setSheet(true);
              }}
              snap={snap}
              gridSize={meta.gridSize}
              cameraFovDeg={fov.horizontal}
              theme={settings.theme}
              sunPath={sunPath}
              fitKey={fitKey}
            />
            <div className="diagram-toolbar" role="toolbar" aria-label="Canvas tools">
              <Button size="sm" variant="quiet" iconOnly icon={<Undo2 size={16} />} onClick={history.undo} disabled={!history.canUndo}>
                Undo
              </Button>
              <Button size="sm" variant="quiet" iconOnly icon={<Redo2 size={16} />} onClick={history.redo} disabled={!history.canRedo}>
                Redo
              </Button>
              <Button size="sm" variant="quiet" iconOnly icon={<Maximize2 size={16} />} onClick={() => setFitKey((k) => k + 1)}>
                Fit to view
              </Button>
              <Button size="sm" variant={snap ? 'primary' : 'quiet'} iconOnly icon={<Magnet size={16} />} onClick={() => setSnap(!snap)} aria-pressed={snap}>
                Snap to grid
              </Button>
            </div>
          </div>

          {(view === 'all' || view === 'lighting') && (
          <Blueprint tone="yellow" aria-live="polite" aria-label="Lighting readouts">
            <div className="readout-grid">
              <Readout label="Key to fill" value={ratioLabel(photometry.ratio)} size="sm" sub={Number.isFinite(photometry.ratioStops) ? `${fmtNum(photometry.ratioStops, 1)} stops` : 'add fill or a bounce'} />
              {lookConfig && lookGear ? (
                <Readout label={`Exposure · ${lookGear.name.replace(/ · .*/, '')}`} value={exposureLabel(exposureOffset(lookConfig, photometry.total)).text.split(' · ')[0]} size="sm" sub={`f/${lookConfig.aperture} · ISO ${lookConfig.iso}${lookConfig.ndStops ? ` · ND ${lookConfig.ndStops.toFixed(1)}` : ''} · ${Math.round(photometry.total * 800)} lux`} />
              ) : (
                <Readout label="Exposure at subject" value={Number.isFinite(photometry.exposureStops) ? `${photometry.exposureStops >= 0 ? '+' : ''}${fmtNum(photometry.exposureStops, 1)} st` : '—'} size="sm" sub="vs one 100% key at 2 m" />
              )}
              <Readout label="Colour mix" value={photometry.mixKelvin ? `${Math.round(photometry.mixKelvin)} K` : '—'} size="sm" sub={photometry.warmest && photometry.coolest && photometry.warmest !== photometry.coolest ? `${photometry.warmest}–${photometry.coolest} K` : undefined} />
              <Readout label="Camera lens" value={`${project.camera.focalLength} mm · ${fmtNum(fov.horizontal, 0)}°`} size="sm" sub={sensor.name} />
            </div>
          </Blueprint>
          )}
          {view !== 'all' && view !== 'lighting' && <ViewSummary view={view} objects={objects} gear={project.gear} connections={project.connections} onSelect={(id) => { setSelectedId(id); setPanel('selected'); if (!desktop) setSheet(true); }} />}

          <div className="stack stack--sm">
            <div className="cluster" style={{ justifyContent: 'space-between' }}>
              <span className="micro">Live view</span>
              <div className="cluster">
                <Segmented
                  value={liveMode}
                  onChange={setLiveMode}
                  size="sm"
                  label="Live view mode"
                  options={[
                    { value: 'camera', label: 'Camera view' },
                    { value: 'orbit', label: 'Orbit' },
                  ]}
                />
                <Button size="sm" variant="ghost" onClick={() => setShowLive(!showLive)}>
                  {showLive ? 'Hide' : 'Show'}
                </Button>
              </div>
            </div>
            {showLive && (
              <Suspense fallback={<div className="live-view live-view--off">Loading 3D view…</div>}>
                <LiveView objects={objects} mode={liveMode} verticalFovDeg={fov.vertical} cameraObjectId={lookCam?.id} config={lookConfig} environment={meta.environment} />
              </Suspense>
            )}
          </div>
        </div>

        <div className="stack">
          <Tabs
            value={panel}
            onChange={setPanel}
            label="Editor panels"
            tabs={[
              { id: 'add', label: 'Add' },
              { id: 'selected', label: 'Selected' },
              { id: 'scene', label: 'Set-up' },
              { id: 'readouts', label: 'Lights' },
            ]}
          />
          {panel === 'add' && (
            <div className="stack">
              {unplaced.length > 0 && (
                <Blueprint title="From your gear" index="★">
                  <div className="cluster">
                    {unplaced.map((g) => (
                      <Button key={g.id} size="sm" variant="quiet" icon={<Plus size={14} />} onClick={() => placeGear(g)}>
                        {g.name}
                      </Button>
                    ))}
                  </div>
                </Blueprint>
              )}
              {showLayer('camera') && (
                <Blueprint title="Camera" index="A">
                  <div className="cluster">
                    {templateButtons(['camera', 'monitor'])}
                    <Button size="sm" variant="quiet" icon={<Plus size={14} />} onClick={addTalent}>
                      Talent
                    </Button>
                    <Button size="sm" variant="quiet" icon={<Plus size={14} />} onClick={addMark}>
                      Mark
                    </Button>
                  </div>
                </Blueprint>
              )}
              {(view === 'all' || view === 'camera') && (
                <Blueprint title="Set and seating" index="S">
                  <div className="stack stack--sm">
                    <div className="cluster">
                      {FURNITURE.map((f) => (
                        <Button key={f.id} size="sm" variant="quiet" icon={<Plus size={14} />} onClick={() => addFurniture(f.id)}>
                          {f.label}
                        </Button>
                      ))}
                    </div>
                    <p className="tiny muted">Select a couch, bench or bed to seat people on it. Select a person to set their pose.</p>
                  </div>
                </Blueprint>
              )}
              {showLayer('lighting') && (
                <>
                  <Blueprint title="Lights" index="B">
                    <div className="stack stack--sm">
                      <div className="cluster">
                        {LIGHT_KINDS.filter((k) => k.emits).map((k) => (
                          <Button key={k.id} size="sm" variant="quiet" icon={<Plus size={14} />} onClick={() => addLight(k.id)}>
                            {k.label}
                          </Button>
                        ))}
                      </div>
                      <span className="micro">As gear (goes on the gear list)</span>
                      <div className="cluster">{templateButtons(['light'])}</div>
                    </div>
                  </Blueprint>
                  <Blueprint title="Modifiers and grip" index="C">
                    <div className="cluster">
                      {LIGHT_KINDS.filter((k) => !k.emits).map((k) => (
                        <Button key={k.id} size="sm" variant="quiet" icon={<Plus size={14} />} onClick={() => addLight(k.id)}>
                          {k.label}
                        </Button>
                      ))}
                      {templateButtons(['grip'])}
                    </div>
                  </Blueprint>
                </>
              )}
              {showLayer('audio') && (
                <Blueprint title="Audio" index="D">
                  <div className="cluster">{templateButtons(['mic', 'wireless', 'recorder', 'audio-acc'])}</div>
                </Blueprint>
              )}
              {showLayer('base') && (
                <Blueprint title="Base and set" index="E">
                  <div className="stack stack--sm">
                    <div className="cluster">
                      {ZONE_KINDS.map((z) => (
                        <Button key={z.id} size="sm" variant={z.id === 'base' ? 'default' : 'quiet'} icon={<Plus size={14} />} onClick={() => addZone(z.id)}>
                          {z.label}
                        </Button>
                      ))}
                    </div>
                    <div className="cluster">
                      {templateButtons(['power', 'media'])}
                      <Button size="sm" variant="quiet" icon={<Plus size={14} />} onClick={addWall}>
                        Wall
                      </Button>
                      <Button size="sm" variant="quiet" icon={<Plus size={14} />} onClick={addSubject}>
                        Object
                      </Button>
                    </div>
                  </div>
                </Blueprint>
              )}
              {showLayer('lighting') && (
                <Blueprint title="Lighting presets" index="F">
                  <div className="stack stack--sm">
                    <p className="tiny muted">Replaces the current layout. Undo brings it back.</p>
                    <div className="preset-grid">
                      {PRESETS.map((p) => (
                        <button key={p.id} type="button" className="preset-card" onClick={() => loadPreset(p.id)}>
                          <strong>{p.name}</strong>
                          <span>{p.note}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </Blueprint>
              )}
            </div>
          )}
          {panel === 'selected' && <Blueprint title={selected ? selected.label : 'Nothing selected'} index="D">{propsPanel}</Blueprint>}
          {panel === 'scene' && (
            <div className="stack">
              <Blueprint title="Set-up" index="G">
                <div className="stack">
                  <TextField label="Name" value={meta.name} onChange={(v) => setMeta({ ...meta, name: v })} />
                  <TextField label="Scene number" value={meta.sceneNumber} onChange={(v) => setMeta({ ...meta, sceneNumber: v })} placeholder="e.g. 12A" />
                  <TextAreaField label="Notes" value={meta.notes} onChange={(v) => setMeta({ ...meta, notes: v })} rows={3} placeholder="Power, stands, gels, what each light is doing." />
                  <TextAreaField label="Camera notes" value={meta.cameraNotes} onChange={(v) => setMeta({ ...meta, cameraNotes: v })} rows={2} placeholder="Lens choices, moves, coverage order." />
                  <SelectField label="Grid" value={String(meta.gridSize)} onChange={(v) => setMeta({ ...meta, gridSize: Number(v) })} options={[{ value: '0.5', label: '0.5 m' }, { value: '1', label: '1 m' }, { value: '2', label: '2 m' }]} />
                </div>
              </Blueprint>
              <EnvironmentPanel env={meta.environment} onChange={(environment) => setMeta({ ...meta, environment })} />
              <Blueprint title="Sun path" index="F">
                <div className="stack">
                  <Check label="Show sun path for exteriors (north is up)" checked={meta.showSunPath} onChange={(v) => setMeta({ ...meta, showSunPath: v })} />
                  {meta.showSunPath && (
                    <>
                      <div className="grid-2">
                        <div className="field">
                          <label className="field__label" htmlFor="sun-date">
                            Date
                          </label>
                          <input id="sun-date" type="date" className="input input--mono" value={sunDate} onChange={(e) => e.target.value && setSunDate(e.target.value)} />
                        </div>
                        <div className="field">
                          <label className="field__label" htmlFor="sun-time">
                            Time
                          </label>
                          <input id="sun-time" type="time" className="input input--mono" value={sunTime} onChange={(e) => e.target.value && setSunTime(e.target.value)} />
                        </div>
                      </div>
                      <p className="tiny muted">
                        {settings.location.name} · {settings.timezone}. {sunPath?.nowAz != null ? `Sun at ${Math.round(sunPath.nowAz)}° azimuth, ${Math.round(sunPath.nowAlt)}° elevation.` : ''}
                      </p>
                      <Button size="sm" icon={<Sun size={14} />} onClick={addSunFromPlanner}>
                        Place sun light for this time
                      </Button>
                    </>
                  )}
                </div>
              </Blueprint>
            </div>
          )}
          {panel === 'readouts' && (
            <div className="stack">
              <Blueprint title="Framing" index="F" padding="tight">
                <div className="stack stack--sm">
                  {camFraming.length === 0 && <p className="tiny muted">Add a camera and a person to see how each camera frames them.</p>}
                  {camFraming.map((c) => (
                    <div key={c.id} className="stack stack--sm">
                      <strong className="small">{c.label} · {framingSummary(c.frames)}</strong>
                      <ul className="framing-list">
                        {c.frames.map((f) => (
                          <li key={f.id}>
                            <span>{f.label}</span>
                            <span className="mono tiny">{f.inFrame ? `${f.shot ?? '—'}${f.partly ? ' · cut by frame edge' : ''}` : 'out of frame'} · {f.distance.toFixed(1)} m</span>
                          </li>
                        ))}
                      </ul>
                      <span className="tiny muted">{c.lensNote}</span>
                    </div>
                  ))}
                </div>
              </Blueprint>
              <Blueprint title="Light at the subject" index="G" padding="tight">
                <div className="light-list">
                  {objects
                    .filter((o): o is DiagramLight => o.type === 'light')
                    .map((l) => {
                      const c = photometry.contributions.find((x) => x.id === l.id);
                      const max = photometry.contributions[0]?.illuminance ?? 1;
                      return (
                        <button
                          key={l.id}
                          type="button"
                          className="light-list__item"
                          aria-pressed={l.id === selectedId}
                          onClick={() => {
                            setSelectedId(l.id);
                            setPanel('selected');
                          }}
                        >
                          <span className="light-list__dot" style={{ background: EMITTING.includes(l.kind) ? lightColour(l) : l.kind === 'bounce' ? '#fff' : '#111' }} />
                          <span>
                            {l.label}
                            {photometry.keyId === l.id && <span className="tag tag--accent" style={{ marginLeft: 8 }}>key</span>}
                            {c?.blockedBy && <span className="tiny muted"> · flagged by {c.blockedBy}</span>}
                            {c?.diffusedBy && <span className="tiny muted"> · through {c.diffusedBy}</span>}
                          </span>
                          <span className="mono tiny" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {c && c.illuminance > 0 ? (
                              <>
                                <span className="contrib__bar" style={{ width: Math.max(2, (c.illuminance / max) * 60) }} />
                                {fmtNum(Math.log2(c.illuminance / max), 1)} st
                              </>
                            ) : (
                              '—'
                            )}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </Blueprint>
              <Expander>
                <Formula>{`E = (power/100) × output(kind) × beam / d²
key : fill = E(brightest) : Σ E(others)
stops = log2(key / fill)
mix kelvin = 1e6 / Σ(E × mired) / ΣE`}</Formula>
                <p>d is the 3D distance from the light to the subject’s face (1.5 m up). Light outside the beam angle falls to 10% spill. Flags cut a light to 8%, diffusion to 55%. Bounce cards return 60% of what lands on them, scaled by size. Sun and window ignore distance. Exposure is relative to a single 100% key at 2 m. Treat the numbers as a planning guide, not a meter.</p>
              </Expander>
            </div>
          )}
        </div>
      </div>

      {!desktop && (
        <Sheet open={sheet && !!selected} onClose={() => setSheet(false)} title={selected?.label ?? 'Object'}>
          {propsPanel}
        </Sheet>
      )}

      <Sheet open={attachOpen} onClose={() => setAttachOpen(false)} title="Attach diagram to a shot">
        {project.shots.length === 0 ? (
          <p className="small muted">
            No shots yet. <Link to="/shots">Add some in the Shot List</Link> and come back.
          </p>
        ) : (
          <div className="rows">
            {project.shots
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="row"
                  style={{ gridTemplateColumns: '48px 1fr auto' }}
                  onClick={() => {
                    patch((p) => ({ shots: p.shots.map((x) => (x.id === s.id ? { ...x, diagramId: initial.id } : x)) }));
                    setAttachOpen(false);
                    toast(`Attached to ${s.scene}${s.shotNumber}`);
                  }}
                >
                  <span className="row__idx mono">
                    {s.scene}
                    {s.shotNumber}
                  </span>
                  <span className="row__main">
                    <span className="row__title">{s.description || `${s.size || 'Shot'} ${s.movement || ''}`}</span>
                    <span className="row__sub">{s.diagramId === initial.id ? 'Already attached' : s.diagramId ? 'Has another diagram' : 'No diagram'}</span>
                  </span>
                  <span className="row__end">{s.diagramId === initial.id && <Link2 size={16} />}</span>
                </button>
              ))}
          </div>
        )}
      </Sheet>
      <ConnectSheet key={connectFrom ?? 'none'} open={connectFrom != null} onClose={() => setConnectFrom(null)} fromGear={connectFrom && project.gear.find((g) => g.id === connectFrom)?.ports.some((p) => p.dir === 'out') ? connectFrom : undefined} toGear={connectFrom && !project.gear.find((g) => g.id === connectFrom)?.ports.some((p) => p.dir === 'out') ? connectFrom : undefined} />
      {editGear && <GearEditor id={editGear} onClose={() => setEditGear(null)} />}
    </main>
  );
}

/* ---------- property editors ---------- */

type GearCtx = { gear: GearItem[]; connections: Connection[]; onConnect: (gearId: string) => void; onEditGear: (gearId: string) => void };

function GearLink({ obj, ctx, category, onChange }: { obj: DiagramObject & { gearId?: string }; ctx: GearCtx; category: GearCategory; onChange: (id: string, d: Partial<DiagramObject>, key?: string) => void }) {
  const options = ctx.gear.filter((g) => g.category === category);
  const g = ctx.gear.find((x) => x.id === obj.gearId);
  const name = (id: string) => ctx.gear.find((x) => x.id === id)?.name ?? '';
  const conns = g ? ctx.connections.filter((c) => c.fromGear === g.id || c.toGear === g.id) : [];
  return (
    <div className="stack stack--sm">
      <SelectField
        label="Gear"
        value={obj.gearId ?? ''}
        onChange={(v) => onChange(obj.id, v ? { gearId: v, label: ctx.gear.find((x) => x.id === v)?.name ?? obj.label } : { gearId: undefined })}
        options={[{ value: '', label: 'Not assigned' }, ...options.map((o) => ({ value: o.id, label: o.name }))]}
        hint={options.length ? undefined : `No ${categoryInfo(category).label.toLowerCase()} on your gear list yet.`}
      />
      {g && (
        <>
          <p className="tiny muted">
            {g.model && g.model !== g.name ? `${g.model} · ` : ''}
            {g.ports.filter((p) => p.dir === 'in').length} in · {g.ports.filter((p) => p.dir === 'out').length} out{g.power ? ` · ${g.power}` : ''}
          </p>
          {conns.map((c) => (
            <div key={c.id} className="tiny mono">
              {c.fromGear === g.id ? `Out to ${name(c.toGear)}` : `In from ${name(c.fromGear)}`}
            </div>
          ))}
          <div className="cluster">
            <Button size="sm" variant="quiet" icon={<Cable size={14} />} onClick={() => ctx.onConnect(g.id)}>
              Connect
            </Button>
            <Button size="sm" variant="quiet" icon={<Pencil size={14} />} onClick={() => ctx.onEditGear(g.id)}>
              Edit gear
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function codeFor(o: DiagramObject): string {
  if (o.type === 'camera') return 'CAM';
  if (o.type === 'light') return 'LGT';
  if (o.type === 'gear') return categoryInfo(o.category).code;
  if (o.type === 'zone') return 'AREA';
  return '';
}

function ViewSummary({ view, objects, gear, connections, onSelect }: { view: PlanView; objects: DiagramObject[]; gear: GearItem[]; connections: Connection[]; onSelect: (id: string) => void }) {
  const items = objects.filter((o) => layerOf(o) === view);
  const label = PLAN_VIEWS.find((v) => v.id === view)?.label ?? '';
  const hint: Record<string, string> = { camera: 'cameras, monitors, talent and marks', audio: 'mics, wireless and recorders', base: 'home base, power and other areas' };
  return (
    <Blueprint title={`${label} on this set-up`} index={String(items.length)}>
      {items.length === 0 ? (
        <p className="small muted">Nothing here yet. Use Add to place {hint[view] ?? 'items'}.</p>
      ) : (
        <div className="rows">
          {items.map((o) => {
            const g = 'gearId' in o ? gear.find((x) => x.id === o.gearId) : undefined;
            const n = g ? connections.filter((c) => c.fromGear === g.id || c.toGear === g.id).length : 0;
            return (
              <button key={o.id} type="button" className="row" style={{ gridTemplateColumns: '48px 1fr auto', width: '100%', textAlign: 'left' }} onClick={() => onSelect(o.id)}>
                <span className="row__idx mono">{codeFor(o)}</span>
                <span className="row__main">
                  <span className="row__title small">{o.label}</span>
                  <span className="row__sub tiny">{o.type === 'zone' ? `${o.w} × ${o.h} m` : g ? g.model || g.name : 'No gear assigned'}</span>
                </span>
                {o.type !== 'zone' && <span className={`tag ${n ? 'tag--wash' : ''}`}>{n} link{n === 1 ? '' : 's'}</span>}
              </button>
            );
          })}
        </div>
      )}
    </Blueprint>
  );
}

function ObjectProps({ obj, objects, onChange, onAdd, onAim, onDelete, onDuplicate, unit, ctx }: { obj: DiagramObject; objects: DiagramObject[]; onChange: (id: string, d: Partial<DiagramObject>, key?: string) => void; onAdd: (objs: DiagramObject[]) => void; onAim: () => void; onDelete: () => void; onDuplicate: () => void; unit: ReturnType<typeof useUnits>; ctx: GearCtx }) {
  const subject = objects.find((o) => o.type === 'subject');
  const dist = subject ? Math.hypot(obj.x - subject.x, obj.y - subject.y) : null;
  const common = (
    <>
      <div className="grid-2">
        <NumberField label={`X (${unit.unit})`} value={Math.round(unit.toDisplay(obj.x) * 100) / 100} onChange={(v) => onChange(obj.id, { x: unit.fromDisplay(v) }, 'x')} step={0.1} />
        <NumberField label={`Y (${unit.unit})`} value={Math.round(unit.toDisplay(obj.y) * 100) / 100} onChange={(v) => onChange(obj.id, { y: unit.fromDisplay(v) }, 'y')} step={0.1} />
      </div>
      <Slider label="Rotation" value={obj.rotation} onChange={(v) => onChange(obj.id, { rotation: v }, 'rot')} min={0} max={359} unit="°" />
      <div className="cluster">
        {obj.type !== 'subject' && (
          <Button size="sm" variant="quiet" icon={<Crosshair size={14} />} onClick={onAim}>
            Aim at subject
          </Button>
        )}
        <Button size="sm" variant="quiet" icon={obj.locked ? <Lock size={14} /> : <LockOpen size={14} />} onClick={() => onChange(obj.id, { locked: !obj.locked })} active={obj.locked}>
          {obj.locked ? 'Locked' : 'Lock'}
        </Button>
        <Button size="sm" variant="quiet" icon={<Copy size={14} />} onClick={onDuplicate}>
          Duplicate
        </Button>
        <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={onDelete} disabled={obj.type === 'subject' && objects.filter((o) => o.type === 'subject').length === 1}>
          Delete
        </Button>
      </div>
    </>
  );

  if (obj.type === 'light') {
    const l = obj;
    const emits = EMITTING.includes(l.kind);
    return (
      <div className="stack">
        <TextField label="Label" value={l.label} onChange={(v) => onChange(l.id, { label: v }, 'label')} />
        <SelectField label="Type" value={l.kind} onChange={(v) => onChange(l.id, { kind: v as LightKind })} options={LIGHT_KINDS.map((k) => ({ value: k.id, label: k.label }))} />
        {emits && <GearLink obj={l} ctx={ctx} category="light" onChange={onChange} />}
        {emits && l.kind !== 'sun' && l.kind !== 'window' && (
          <>
            <SelectField
              label="Fixture"
              value={l.fixture ?? 'led-mono'}
              onChange={(v) => {
                const f = fixtureInfo(v as DiagramLight['fixture'])!;
                onChange(l.id, { fixture: f.id, size: f.size, spread: Math.min(180, f.spread) } as Partial<DiagramLight>);
              }}
              options={FIXTURES.map((f) => ({ value: f.id, label: f.label }))}
              hint={fixtureInfo(l.fixture ?? 'led-mono')?.note}
            />
            <SelectField label="Diffusion" value={l.diffusion ?? 'none'} onChange={(v) => onChange(l.id, { diffusion: v } as Partial<DiagramLight>)} options={DIFFUSION.map((d) => ({ value: d.id, label: d.label }))} hint="Softer and larger, but each step costs output." />
          </>
        )}
        {emits && (
          <>
            <Slider label="Power" value={l.power} onChange={(v) => onChange(l.id, { power: v }, 'power')} min={0} max={100} unit="%" />
            <Slider label="Colour temperature" value={l.kelvin} onChange={(v) => onChange(l.id, { kelvin: v }, 'kelvin')} min={1800} max={10000} step={50} unit="K" />
            <div className="cluster">
              {COLOUR_TEMP_PRESETS.filter((p) => [3200, 4300, 5600, 6500].includes(p.k) || p.name === 'Candle').map((p) => (
                <Button key={p.k} size="sm" variant="ghost" onClick={() => onChange(l.id, { kelvin: p.k })}>
                  {p.k} K
                </Button>
              ))}
            </div>
            <div className="field">
              <span className="field__label">Gel</span>
              <div className="cluster">
                <input type="color" value={l.gel || '#ffffff'} onChange={(e) => onChange(l.id, { gel: e.target.value }, 'gel')} aria-label="Gel colour" style={{ width: 44, height: 44, border: '1px solid var(--hair-strong)', borderRadius: 4, padding: 2, background: 'var(--bg)' }} />
                {l.gel ? (
                  <Button size="sm" variant="ghost" onClick={() => onChange(l.id, { gel: '' })}>
                    Clear gel
                  </Button>
                ) : (
                  <span className="tiny muted">None</span>
                )}
              </div>
            </div>
            <Slider label="Beam spread" value={l.spread} onChange={(v) => onChange(l.id, { spread: v }, 'spread')} min={5} max={180} unit="°" />
          </>
        )}
        <Slider label={emits ? 'Source size (softness)' : 'Width'} value={Math.round(l.size * 100) / 100} onChange={(v) => onChange(l.id, { size: v }, 'size')} min={0.1} max={3} step={0.05} decimals={2} unit="m" />
        <Slider label="Height" value={Math.round(l.height * 100) / 100} onChange={(v) => onChange(l.id, { height: v }, 'height')} min={0} max={l.kind === 'sun' ? 30 : 5} step={0.05} decimals={2} unit="m" />
        {emits && <Slider label="Tilt (down is negative)" value={l.tilt} onChange={(v) => onChange(l.id, { tilt: v }, 'tilt')} min={-90} max={45} unit="°" />}
        {dist != null && emits && l.kind !== 'sun' && (
          <Stepper
            label="Distance to subject"
            unit="m"
            value={Math.round(dist * 100) / 100}
            min={0.3}
            max={30}
            step={0.1}
            decimals={2}
            onChange={(v) => {
              const s = objects.find((o) => o.type === 'subject')!;
              const k = v / Math.max(0.01, dist);
              onChange(l.id, { x: s.x + (l.x - s.x) * k, y: s.y + (l.y - s.y) * k }, 'dist');
            }}
            hint="Moves the light along its line to the subject. Halving the distance gives four times the light (two stops)."
          />
        )}
        {dist != null && (
          <p className="tiny muted">
            {unit.fmt(dist, 2)} from the subject on the floor plan, {unit.fmt(Math.hypot(dist, l.height - 1.5), 2)} to the face.
          </p>
        )}
        {common}
      </div>
    );
  }
  if (obj.type === 'subject') {
    return (
      <div className="stack">
        <TextField label="Label" value={obj.label} onChange={(v) => onChange(obj.id, { label: v }, 'label')} />
        <Segmented
          value={obj.subjectKind}
          onChange={(v) => onChange(obj.id, { subjectKind: v })}
          block
          label="Subject kind"
          options={[
            { value: 'person', label: 'Person' },
            { value: 'object', label: 'Object' },
          ]}
        />
        {obj.subjectKind === 'person' && (
          <>
            <SelectField
              label="Pose"
              value={obj.pose ?? 'standing'}
              onChange={(v) => {
                const p = POSES.find((x) => x.id === v)!;
                onChange(obj.id, { pose: p.id, seatHeight: p.seat } as Partial<DiagramObject>);
              }}
              options={POSES.map((p) => ({ value: p.id, label: p.label }))}
            />
            {['chair', 'couch', 'bench', 'custom', 'lying'].includes(obj.pose ?? 'standing') && (
              <div className="grid-2">
                <Stepper label={obj.pose === 'lying' ? 'Lying on surface at' : 'Seat height'} unit="m" value={seatOf(obj)} onChange={(v) => onChange(obj.id, { seatHeight: v } as Partial<DiagramObject>, 'seat')} min={0} max={1.2} step={0.02} decimals={2} />
                <Stepper label="Lean back" unit="°" value={obj.lean ?? (obj.pose === 'couch' ? 12 : 0)} onChange={(v) => onChange(obj.id, { lean: v } as Partial<DiagramObject>, 'lean')} min={-30} max={45} step={5} />
              </div>
            )}
            <p className="tiny muted">Eyes at {bodyExtent(obj).eye.toFixed(2)} m, top of head at {bodyExtent(obj).top.toFixed(2)} m. Framing and lighting use these.</p>
          </>
        )}
        <Stepper label={obj.subjectKind === 'person' ? 'Standing height' : 'Height'} unit="m" value={obj.height} onChange={(v) => onChange(obj.id, { height: v }, 'h')} min={0.1} max={3} step={0.05} decimals={2} />
        <p className="tiny muted">Rotation is the direction the subject faces. 180° faces the camera at the bottom of the plan.</p>
        {common}
      </div>
    );
  }
  if (obj.type === 'gear') {
    return (
      <div className="stack">
        <TextField label="Label" value={obj.label} onChange={(v) => onChange(obj.id, { label: v }, 'label')} />
        <SelectField label="Kind" value={obj.category} onChange={(v) => onChange(obj.id, { category: v as GearCategory })} options={CATEGORIES.filter((c) => c.id !== 'camera' && c.id !== 'light').map((c) => ({ value: c.id, label: c.label }))} />
        <GearLink obj={obj} ctx={ctx} category={obj.category} onChange={onChange} />
        {common}
      </div>
    );
  }
  if (obj.type === 'zone') {
    return (
      <div className="stack">
        <TextField label="Label" value={obj.label} onChange={(v) => onChange(obj.id, { label: v }, 'label')} />
        {isFurniture(obj.zoneKind) ? (
          <SelectField label="Furniture" value={obj.zoneKind} onChange={(v) => { const f = furnitureInfo(v as ZoneKind)!; onChange(obj.id, { zoneKind: f.id, w: f.w, h: f.d }); }} options={FURNITURE.map((f) => ({ value: f.id, label: f.label }))} />
        ) : (
          <SelectField label="Area" value={obj.zoneKind} onChange={(v) => onChange(obj.id, { zoneKind: v as ZoneKind })} options={ZONE_KINDS.map((z) => ({ value: z.id, label: z.label }))} />
        )}
        {isFurniture(obj.zoneKind) && (furnitureInfo(obj.zoneKind)?.seats ?? 0) > 0 && <SeatPeople zone={obj} onAdd={onAdd} />}
        <div className="grid-2">
          <Stepper label="Width" unit="m" value={obj.w} onChange={(v) => onChange(obj.id, { w: Math.max(0.2, v) }, 'w')} min={0.2} max={60} step={isFurniture(obj.zoneKind) ? 0.05 : 0.5} decimals={isFurniture(obj.zoneKind) ? 2 : 1} />
          <Stepper label="Depth" unit="m" value={obj.h} onChange={(v) => onChange(obj.id, { h: Math.max(0.2, v) }, 'h')} min={0.2} max={60} step={isFurniture(obj.zoneKind) ? 0.05 : 0.5} decimals={isFurniture(obj.zoneKind) ? 2 : 1} />
        </div>
        {common}
      </div>
    );
  }
  if (obj.type === 'mark') {
    return (
      <div className="stack">
        <TextField label="Label" value={obj.label} onChange={(v) => onChange(obj.id, { label: v }, 'label')} hint="Who or what stands here, e.g. Mara 1." />
        {common}
      </div>
    );
  }
  if (obj.type === 'wall') {
    return (
      <div className="stack">
        <TextField label="Label" value={obj.label} onChange={(v) => onChange(obj.id, { label: v }, 'label')} />
        <Stepper label="Length" unit="m" value={obj.length} onChange={(v) => onChange(obj.id, { length: v }, 'len')} min={0.5} max={30} step={0.5} decimals={1} />
        {common}
      </div>
    );
  }
  return (
    <div className="stack">
      <TextField label="Label" value={obj.label} onChange={(v) => onChange(obj.id, { label: v }, 'label')} />
      {obj.type === 'camera' && <GearLink obj={obj} ctx={ctx} category="camera" onChange={onChange} />}
      <p className="tiny muted">The field-of-view cone follows the project camera and lens.</p>
      {common}
      <div className="cluster">
        <Button size="sm" variant="ghost" icon={<Minus size={14} />} onClick={() => onChange(obj.id, { rotation: (obj.rotation - 5 + 360) % 360 })}>
          5°
        </Button>
        <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => onChange(obj.id, { rotation: (obj.rotation + 5) % 360 })}>
          5°
        </Button>
      </div>
    </div>
  );
}

function SeatPeople({ zone, onAdd }: { zone: DiagramZone; onAdd: (objs: DiagramObject[]) => void }) {
  const f = furnitureInfo(zone.zoneKind)!;
  const [n, setN] = useState(f.seats);
  const [gap, setGap] = useState(() => Math.round(Math.min(0.7, (zone.w - 0.1) / f.seats) * 100) / 100);
  return (
    <div className="stack stack--sm">
      <div className="grid-2">
        <Stepper label="People" value={n} onChange={setN} min={1} max={12} step={1} />
        <Stepper label="Spacing" unit="m" value={gap} onChange={setGap} min={0.3} max={1.5} step={0.05} decimals={2} />
      </div>
      <Button size="sm" icon={<Plus size={14} />} onClick={() => onAdd(seatPeople(zone, n, uid, gap))}>
        Seat {n} {n === 1 ? 'person' : 'people'} on this {f.label.toLowerCase()}
      </Button>
      {n * gap > zone.w + 0.05 && <p className="tiny muted">That is {(n * gap).toFixed(2)} m of people on a {zone.w.toFixed(2)} m {f.label.toLowerCase()}: shoulders will overlap.</p>}
    </div>
  );
}
