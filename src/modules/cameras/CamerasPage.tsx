import { lazy, Suspense, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowRight, Cable, Plus, Trash2, Unplug, Wand2, Box } from 'lucide-react';
import { PageHead } from '@/components/PageHead';
import { Blueprint } from '@/components/Blueprint';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Sheet, Confirm } from '@/components/Sheet';
import { Check, SelectField, TextAreaField } from '@/components/Field';
import { Stepper } from '@/components/Stepper';
import { useProject, useProjects } from '@/store/projects';
import { toast } from '@/store/toast';
import { uid } from '@/lib/id';
import { BODIES, body as bodyById } from '@/lib/camera/bodies';
import { LENSES, ADAPTERS, lensesFor, maxApertureAt, type LensDef } from '@/lib/camera/lenses';
import { PROFILES, profile } from '@/lib/camera/profiles';
import { ISOS, STOPS, balanceExposure, cameraConfig, derive, exposureLabel, exposureOffset, normalise, shutterSeconds, warnings } from '@/lib/camera/settings';
import { ndOnRig, withRigNd } from '@/lib/camera/nd';
import { evaluate } from '@/lib/light/photometry';
import { framing, framingSummary } from '@/lib/scene/framing';
import { TEMPLATES, blankGear, gearFromTemplate, nextName, categoryInfo, type GearTemplate } from '@/lib/gear/catalog';
import { check, checkProduction, portUsage, rigKey } from '@/lib/gear/autoconnect';
import { defaultLight } from '@/modules/light/presets';
import { envOf, presetEnv } from '@/lib/light/environment';
import { AutoConnectSheet } from '@/modules/gear/AutoConnectSheet';
import { CameraSheetButton } from '@/modules/export/CameraSheetButton';
import type { CameraConfig, Connection, DiagramObject, GearCategory, GearItem, LightingDiagram } from '@/types/project';
import '@/modules/gear/gear.css';
import './cameras.css';

const LiveView = lazy(() => import('@/modules/light/LiveView'));

const ANGLES = [45, 90, 144, 172.8, 180, 270, 360];
const SPEEDS = [25, 30, 40, 48, 50, 60, 80, 100, 120, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 4000, 8000];
const RIG_CATEGORIES: GearCategory[] = ['rigging', 'monitor', 'filter', 'support', 'battery', 'cable', 'adapter', 'mic', 'wireless', 'recorder', 'power'];

const letter = (i: number) => String.fromCharCode(65 + i);

/** A small set the preview uses when this camera is not on any shoot plan yet. */
function previewScene(): DiagramObject[] {
  return [
    { id: 'pv-cam', type: 'camera', x: 0, y: -3, rotation: 0, locked: true, label: 'Camera' },
    { id: 'pv-sub', type: 'subject', subjectKind: 'person', height: 1.75, x: 0, y: 0, rotation: 180, locked: true, label: 'Subject' },
    defaultLight('key', -1.6, -1.6, { id: 'pv-key', rotation: 45, label: 'Key' }),
    defaultLight('fill', 1.9, -1.9, { id: 'pv-fill', rotation: -45, label: 'Fill' }),
    defaultLight('back', 0.9, 1.8, { id: 'pv-back', rotation: -153, label: 'Back' }),
  ] as DiagramObject[];
}

const PREVIEW_SCENE = previewScene();
const PREVIEW_ENV = presetEnv('white-studio');

function findPlaced(diagrams: LightingDiagram[], camId: string) {
  for (const dg of diagrams) {
    const o = dg.objects.find((x) => x.type === 'camera' && 'gearId' in x && x.gearId === camId);
    if (o) return { objects: dg.objects, id: o.id, name: dg.name, diagramId: dg.id, environment: envOf(dg) };
  }
  return null;
}

export default function CamerasPage() {
  const project = useProject();
  const patch = useProjects((s) => s.patchCurrent);
  const [params, setParams] = useSearchParams();
  const cameras = project.gear.filter((g) => g.category === 'camera');
  const current = cameras.find((g) => g.id === params.get('cam')) ?? cameras[0];
  const [adding, setAdding] = useState(false);

  function addBody(t: GearTemplate) {
    const g = gearFromTemplate(t, `Camera ${letter(cameras.length)} · ${t.name}`);
    patch((p) => ({ gear: [...p.gear, g] }));
    setParams({ cam: g.id }, { replace: true });
    setAdding(false);
    toast(`Added ${g.name}`);
  }

  return (
    <main className="page">
      <PageHead
        index="02 · Cameras"
        title="Cameras"
        sub="Every camera with its own lens, settings, rig and connections. Change a setting and the simulated image updates."
        actions={
          <div className="cluster">
            <CameraSheetButton />
            <Link to="/plan" className="btn btn--sm btn--quiet">
              Shoot plan <ArrowRight size={14} />
            </Link>
          </div>
        }
      />
      <div className="stack">
        <div className="cam-switch" role="tablist" aria-label="Cameras">
          {cameras.map((g, i) => (
            <button key={g.id} role="tab" aria-selected={g.id === current?.id} className={`cam-tab ${g.id === current?.id ? 'is-on' : ''}`} onClick={() => setParams({ cam: g.id }, { replace: true })}>
              <span className="cam-tab__letter">{letter(i)}</span>
              <span className="cam-tab__name">{cameraConfig(g).model}</span>
            </button>
          ))}
          <Button icon={<Plus size={16} />} onClick={() => setAdding(true)}>
            Camera
          </Button>
        </div>
        {current ? <CameraEditor key={current.id} cam={current} index={cameras.indexOf(current)} /> : <EmptyState title="No cameras yet" body="Add a camera body to set its lens, exposure, colour and rig." action={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>Add a camera</Button>} />}
      </div>
      <BodyPicker open={adding} onClose={() => setAdding(false)} onPick={addBody} />
    </main>
  );
}

function BodyPicker({ open, onClose, onPick, title = 'Add a camera' }: { open: boolean; onClose: () => void; onPick: (t: GearTemplate) => void; title?: string }) {
  const groups: { id: string; label: string }[] = [
    { id: 'cinema', label: 'Cinema' },
    { id: 'mirrorless', label: 'Mirrorless' },
    { id: 'dslr', label: 'DSLR' },
  ];
  return (
    <Sheet open={open} onClose={onClose} title={title} wide>
      <div className="stack">
        {groups.map((gr) => (
          <div key={gr.id} className="stack stack--sm">
            <span className="micro">{gr.label}</span>
            <div className="template-grid">
              {BODIES.filter((b) => b.type === gr.id).map((b) => {
                const t = TEMPLATES.find((x) => x.id === `body-${b.id}`);
                if (!t) return null;
                return (
                  <button key={b.id} type="button" className="preset-card" onClick={() => onPick(t)}>
                    <strong>{t.name}</strong>
                    <span className="micro">{b.mount} mount · {b.battery}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

function CameraEditor({ cam, index }: { cam: GearItem; index: number }) {
  const project = useProject();
  const patch = useProjects((s) => s.patchCurrent);
  const config = withRigNd(cameraConfig(cam), cam.id, project.gear);
  const nd = ndOnRig(cam.id, project.gear);
  const lensGear = project.gear.find((g) => g.id === config.lensGearId);
  const lens = lensGear?.lens;
  const b = bodyById(config.bodyId);
  const prof = profile(config.profile);
  const d = derive(config, 1920);
  const warns = warnings(config, lens);
  const [picking, setPicking] = useState<'lens' | 'body' | 'equip' | 'connect' | null>(null);
  const [removing, setRemoving] = useState(false);
  const [live, setLive] = useState<'camera' | 'orbit'>('camera');

  const set = (p: Partial<CameraConfig>) => patch((pr) => ({ gear: pr.gear.map((g) => (g.id === cam.id ? { ...g, camera: normalise({ ...cameraConfig(g), ...p }, lens) } : g)) }));

  // The plan this camera stands on, or a small preview set.
  const placed = findPlaced(project.diagrams, cam.id);
  const scene = placed?.objects ?? PREVIEW_SCENE;
  const env = placed?.environment ?? PREVIEW_ENV;
  // One exposure reading: the light on the subject (lamps, room bounce, ambient, sun) plus the camera settings.
  const subjectLight = evaluate(scene, env).total;
  const expOff = exposureOffset(config, subjectLight);
  const expLab = exposureLabel(expOff);
  const camObj = scene.find((o) => o.id === (placed?.id ?? 'pv-cam'));
  const frames = camObj ? framing(scene, camObj, { height: config.height, tilt: config.tilt, hfov: d.hfov, vfov: d.vfov }) : [];

  const rig = project.gear.filter((g) => g.id !== cam.id && rigKey(g) === cam.id);
  const issues = checkProduction(project.gear, project.connections).filter((i) => i.gearIds.some((id) => id === cam.id || rig.some((r) => r.id === id)));

  /* ---------- Lens ---------- */
  function attachLens(choice: { lens?: LensDef; gearId?: string; adapterId?: string }) {
    patch((pr) => {
      let gear = [...pr.gear];
      let connections = pr.connections;
      const camItem = gear.find((g) => g.id === cam.id)!;
      const mountPort = camItem.ports.find((p) => p.connector === 'Lens mount' && p.dir === 'out');
      // Unhook whatever sat on the mount, and any adapter chain, but keep the items in the kit.
      const chain = new Set<string>();
      const walk = (gid: string, pid?: string) => {
        for (const c of connections) if (c.fromGear === gid && (!pid || c.fromPort === pid)) {
          const to = gear.find((g) => g.id === c.toGear);
          if (to && (to.category === 'lens' || to.category === 'adapter')) { chain.add(c.id); if (to.category === 'adapter') walk(to.id); }
        }
      };
      if (mountPort) walk(cam.id, mountPort.id);
      connections = connections.filter((c) => !chain.has(c.id));
      let lensItem = choice.gearId ? gear.find((g) => g.id === choice.gearId) : undefined;
      if (!lensItem && choice.lens) {
        const t = TEMPLATES.find((x) => x.id === `lens-${choice.lens!.id}`)!;
        lensItem = gearFromTemplate(t, nextName(gear, 'lens', t.name));
        gear.push(lensItem);
      }
      if (!lensItem || !mountPort) return {};
      gear = gear.map((g) => (g.id === lensItem!.id ? { ...g, rigOf: cam.id } : g));
      const lensIn = lensItem.ports.find((p) => p.connector === 'Lens mount' && p.dir === 'in');
      const add: Connection[] = [];
      if (choice.adapterId) {
        const t = TEMPLATES.find((x) => x.id === `adapter-${choice.adapterId}`)!;
        const existing = gear.find((g) => g.category === 'adapter' && g.model === t.name && !pr.connections.some((c) => c.toGear === g.id));
        const ad = existing ?? gearFromTemplate(t, nextName(gear, 'adapter', t.name));
        if (!existing) gear.push(ad);
        gear = gear.map((g) => (g.id === ad.id ? { ...g, rigOf: cam.id } : g));
        const adIn = ad.ports.find((p) => p.dir === 'in')!;
        const adOut = ad.ports.find((p) => p.dir === 'out')!;
        add.push({ id: uid(), fromGear: cam.id, fromPort: mountPort.id, toGear: ad.id, toPort: adIn.id, notes: '' });
        if (lensIn) add.push({ id: uid(), fromGear: ad.id, fromPort: adOut.id, toGear: lensItem.id, toPort: lensIn.id, notes: '' });
      } else if (lensIn) add.push({ id: uid(), fromGear: cam.id, fromPort: mountPort.id, toGear: lensItem.id, toPort: lensIn.id, notes: '' });
      // A lens is on one camera at a time.
      connections = connections.filter((c) => !(lensIn && c.toGear === lensItem!.id && c.toPort === lensIn.id));
      const spec = lensItem.lens;
      gear = gear.map((g) => {
        if (g.id === cam.id) {
          const c = cameraConfig(g);
          const focal = spec ? Math.min(spec.focalMax, Math.max(spec.focalMin, c.focalLength)) : c.focalLength;
          return { ...g, camera: normalise({ ...c, lensGearId: lensItem!.id, focalLength: focal, aperture: spec ? Math.max(spec.maxAperture, c.aperture) : c.aperture }, spec) };
        }
        if (g.category === 'camera' && g.camera?.lensGearId === lensItem!.id) return { ...g, camera: { ...g.camera, lensGearId: undefined } };
        return g;
      });
      return { gear, connections: [...connections, ...add] };
    });
    setPicking(null);
    toast('Lens attached');
  }

  /* ---------- Body change keeps the settings that still apply and the connections whose ports still exist ---------- */
  function changeBody(t: GearTemplate) {
    patch((pr) => {
      const fresh = gearFromTemplate(t);
      const old = pr.gear.find((g) => g.id === cam.id)!;
      const ports = fresh.ports.map((p) => {
        const match = old.ports.find((o) => o.name === p.name && o.dir === p.dir);
        return match ? { ...p, id: match.id } : p;
      });
      const keep = new Set(ports.map((p) => p.id));
      const connections = pr.connections.filter((c) => (c.fromGear !== cam.id || keep.has(c.fromPort)) && (c.toGear !== cam.id || keep.has(c.toPort)));
      const oldCfg = cameraConfig(old);
      const nb = bodyById(t.bodyId!);
      const lensSpec = pr.gear.find((g) => g.id === oldCfg.lensGearId)?.lens;
      const fits = lensSpec && lensSpec.mount === nb.mount;
      const cfg = normalise({ ...fresh.camera!, focalLength: oldCfg.focalLength, aperture: oldCfg.aperture, iso: oldCfg.iso, kelvin: oldCfg.kelvin, tint: oldCfg.tint, shutterMode: oldCfg.shutterMode, shutterAngle: oldCfg.shutterAngle, shutterSpeed: oldCfg.shutterSpeed, fps: oldCfg.fps, focusDistance: oldCfg.focusDistance, height: oldCfg.height, tilt: oldCfg.tilt, notes: oldCfg.notes, lensGearId: fits ? oldCfg.lensGearId : undefined }, fits ? lensSpec : undefined);
      const lost = pr.connections.length - connections.length;
      if (lost) toast(`${lost} connection${lost === 1 ? '' : 's'} removed: the new body has no matching port`);
      return {
        gear: pr.gear.map((g) => (g.id === cam.id ? { ...g, model: fresh.model, name: `Camera ${letter(index)} · ${fresh.model}`, ports, power: fresh.power, rigKind: fresh.rigKind, weightKg: fresh.weightKg, specs: fresh.specs, camera: cfg } : g)),
        connections,
      };
    });
    setPicking(null);
  }

  function removeCamera() {
    patch((pr) => ({
      gear: pr.gear.filter((g) => g.id !== cam.id).map((g) => (g.rigOf === cam.id ? { ...g, rigOf: undefined } : g)),
      connections: pr.connections.filter((c) => c.fromGear !== cam.id && c.toGear !== cam.id),
      diagrams: pr.diagrams.map((dg) => ({ ...dg, objects: dg.objects.map((o) => (o.type === 'camera' && 'gearId' in o && o.gearId === cam.id ? { ...o, gearId: undefined } : o)) })),
    }));
    toast('Camera removed. Its rig items stay in your gear.');
  }

  const stops = lens ? STOPS.filter((s) => s >= maxApertureAt(lens, config.focalLength) - 1e-6 && s <= lens.minAperture) : STOPS;
  const isos = ISOS.filter((i) => i >= b.isoRange[0] && i <= b.isoRange[1]);
  const res = b.resolutions.find((r) => r.label === config.resolution) ?? b.resolutions[0];
  const codec = b.codecs.find((k) => k.name === config.codec) ?? b.codecs[0];
  const t = shutterSeconds(config);
  const fmtFt = (m: number) => (Number.isFinite(m) ? `${m.toFixed(m < 10 ? 2 : 1)} m` : '∞');

  return (
    <div className="cam-layout">
      <div className="cam-preview stack">
        <Blueprint tone="ink" padding="none" title={`Camera ${letter(index)} · simulated image`} aside={<span className="tag tag--wash">Simulated</span>}>
          <div className="cam-view">
            <Suspense fallback={<div className="live-view" />}>
              <LiveView objects={scene} mode={live} verticalFovDeg={d.vfov} cameraObjectId={placed?.id ?? 'pv-cam'} config={config} environment={env} />
            </Suspense>
            <div className="cam-view__hud mono" aria-hidden>
              <span>{config.focalLength} mm · f/{config.aperture}</span>
              <span>{config.shutterMode === 'angle' ? `${config.shutterAngle}°` : `1/${Math.round(1 / t)}`} · ISO {config.iso}</span>
              <span>{config.kelvin} K {config.tint ? `${config.tint > 0 ? '+' : ''}${config.tint} tint` : ''}</span>
              <span>{prof.name}{prof.kind === 'log' ? (config.monitorLut ? ' · LUT on' : ' · Log view') : ''}</span>
            </div>
          </div>
        </Blueprint>
        <div className="cluster">
          <Button size="sm" active={live === 'camera'} onClick={() => setLive('camera')}>Through the lens</Button>
          <Button size="sm" active={live === 'orbit'} onClick={() => setLive('orbit')}>Orbit the set</Button>
          {placed ? (
            <Link className="btn btn--sm btn--quiet" to={`/plan/${placed.diagramId}`}>On plan: {placed.name} <ArrowRight size={14} /></Link>
          ) : (
            <span className="micro">Not on a plan yet: showing a three-light preview in a white studio.</span>
          )}
        </div>
        <div className={`exp-meter exp-meter--${expLab.level}`}>
          <div className="exp-meter__head">
            <span className="readout__label">Exposure at the subject</span>
            <strong className="mono">{expLab.text}</strong>
          </div>
          <div className="exp-meter__bar" aria-hidden>
            {[-3, -2, -1, 0, 1, 2, 3].map((t) => (
              <span key={t} className="exp-meter__tick" style={{ left: `${((t + 3) / 6) * 100}%` }}>{t > 0 ? `+${t}` : t}</span>
            ))}
            {Number.isFinite(expOff) && <span className="exp-meter__needle" style={{ left: `${((Math.max(-3, Math.min(3, expOff)) + 3) / 6) * 100}%` }} />}
          </div>
          <div className="cluster">
            <span className="micro">{Math.round(subjectLight * 800)} lux on the face{config.ndStops ? ` · ND ${config.ndStops.toFixed(1)} stops` : ''}</span>
            {Number.isFinite(expOff) && Math.abs(expOff) > 0.3 && (
              <Button size="sm" onClick={() => set(balanceExposure(config, subjectLight, lens, nd ? nd.max : 0))}>
                Balance exposure
              </Button>
            )}
          </div>
          {expOff > 1 && !nd && <p className="tiny muted">Too much light and no ND on this rig. Add a variable ND in Add Equipment to keep your aperture and shutter.</p>}
        </div>
        <div className="sim-legend">
          <div>
            <span className="tag tag--ok">Physically simulated</span>
            <p className="tiny">Field of view, depth of field and focus plane, exposure from aperture, shutter, ISO and ND, light falloff with distance, room bounce, motion blur from shutter time, Log encoding curves.</p>
          </div>
          <div>
            <span className="tag tag--wash">Approximation</span>
            <p className="tiny">Sensor noise, white balance colour, picture profile looks, colour space, the monitoring LUT, skin and surface materials. Use it to plan, then check on the real monitor.</p>
          </div>
        </div>
        <div className="readout-grid">
          <Readout label="Horizontal view" value={`${d.hfov.toFixed(1)}°`} />
          <Readout label="Vertical view" value={`${d.vfov.toFixed(1)}°`} />
          <Readout label="In focus" value={`${fmtFt(d.dof.near)} – ${fmtFt(d.dof.far)}`} />
          <Readout label="Depth of field" value={Number.isFinite(d.dof.total) ? `${(d.dof.total * 100).toFixed(d.dof.total < 1 ? 0 : 0)} cm` : '∞'} />
          <Readout label="Shutter" value={`1/${Math.round(1 / d.shutter)} · ${Math.round(d.angle * 10) / 10}°`} />
          <Readout label="Exposure vs f/2.8 1/48 ISO 800" value={`${d.cameraStops >= 0 ? '+' : ''}${d.cameraStops.toFixed(1)} stops`} />
          <Readout label="Framing" value={framingSummary(frames)} />
          <Readout label="Noise" value={d.noiseLabel} />
          <Readout label="Motion blur" value={`${Math.round(d.subjectBlurPx)} px subject · ${Math.round(d.panBlurPx)} px pan`} />
        </div>
        {warns.length > 0 && (
          <ul className="cam-warns">
            {warns.map((w, i) => (
              <li key={i} className={`cam-warn cam-warn--${w.level}`}>{w.text}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="cam-controls stack">
        <Blueprint title="Body" index={letter(index)} aside={<Button size="sm" variant="quiet" onClick={() => setPicking('body')}>Change</Button>}>
          <div className="stack stack--sm">
            <div className="kv"><span className="micro">Camera</span><strong>{b.manufacturer} {b.model}</strong></div>
            <div className="kv"><span className="micro">Mount · sensor</span><span className="mono">{b.mount} · {d.sensor.name}</span></div>
            <div className="kv"><span className="micro">Battery</span><span className="mono">{b.battery}</span></div>
          </div>
        </Blueprint>

        <Blueprint title="Lens" aside={<Button size="sm" variant="quiet" onClick={() => setPicking('lens')}>{lens ? 'Change' : 'Attach'}</Button>}>
          <div className="stack stack--sm">
            {lens ? (
              <div className="kv"><span className="micro">{lens.mount} mount</span><strong>{lens.manufacturer} {lens.model}</strong></div>
            ) : (
              <p className="muted">No lens yet. Attach one to use its real focal range and apertures.</p>
            )}
            <Stepper label="Focal length" unit="mm" value={config.focalLength} onChange={(v) => set({ focalLength: v })} min={lens?.focalMin ?? 8} max={lens?.focalMax ?? 600} step={lens && lens.focalMin === lens.focalMax ? 0 : 1} />
            <SelectField label="Aperture" value={String(config.aperture)} onChange={(v) => set({ aperture: Number(v) })} options={stops.map((s) => ({ value: String(s), label: `f/${s}` }))} hint={lens ? `This lens opens to f/${maxApertureAt(lens, config.focalLength)} at ${config.focalLength} mm.` : undefined} />
            <div className="grid-2">
              <SelectField label="Focus mode" value={config.focusMode} onChange={(v) => set({ focusMode: v as CameraConfig['focusMode'] })} options={['MF', 'AF-S', 'AF-C', 'Face/Eye AF'].map((x) => ({ value: x, label: x }))} />
              <Stepper label="Focus distance" unit="m" value={config.focusDistance} onChange={(v) => set({ focusDistance: v })} min={lens?.minFocus ?? 0.1} max={100} step={0.1} decimals={1} />
            </div>
          </div>
        </Blueprint>

        <Blueprint title="Exposure">
          <div className="stack stack--sm">
            <div className="grid-2">
              <SelectField label="Shutter as" value={config.shutterMode} onChange={(v) => set({ shutterMode: v as 'angle' | 'speed' })} options={[{ value: 'angle', label: 'Angle' }, { value: 'speed', label: 'Speed' }]} />
              {config.shutterMode === 'angle' ? (
                <SelectField label="Shutter angle" value={String(config.shutterAngle)} onChange={(v) => set({ shutterAngle: Number(v) })} options={[...new Set([...ANGLES, config.shutterAngle])].sort((a, z) => a - z).map((a) => ({ value: String(a), label: `${a}°` }))} />
              ) : (
                <SelectField label="Shutter speed" value={String(Math.round(1 / config.shutterSpeed))} onChange={(v) => set({ shutterSpeed: 1 / Number(v) })} options={SPEEDS.filter((s) => s >= config.fps).map((s) => ({ value: String(s), label: `1/${s}` }))} />
              )}
            </div>
            {nd && (
              <Stepper
                label={`ND (${nd.name})`}
                unit="stops"
                value={config.ndStops ?? 0}
                onChange={(v) => set({ ndStops: v < nd.min / 2 ? 0 : v })}
                min={0}
                max={nd.max}
                step={nd.min === nd.max ? nd.max : 1 / 3}
                decimals={1}
                hint={nd.min === nd.max ? 'Fixed filter: in or out.' : `Variable ND from ${nd.min} to ${nd.max} stops. Below ${nd.min} means out of the light path.`}
              />
            )}
            <SelectField label={b.usesEI ? 'ISO / EI' : 'ISO'} value={String(config.iso)} onChange={(v) => set({ iso: Number(v), ei: Number(v) })} options={[...new Set([...isos, config.iso])].sort((a, z) => a - z).map((i) => ({ value: String(i), label: `${i}${b.nativeIso.includes(i) ? '  (native)' : ''}` }))} />
          </div>
        </Blueprint>

        <Blueprint title="Colour">
          <div className="stack stack--sm">
            <Stepper label="White balance" unit="K" value={config.kelvin} onChange={(v) => set({ kelvin: v })} min={2000} max={10000} step={100} snaps={[3200, 4300, 5600, 6500]} />
            <Stepper label="Tint (+ magenta, − green)" value={config.tint} onChange={(v) => set({ tint: v })} min={-99} max={99} step={1} />
            <SelectField label="Picture profile" value={config.profile} onChange={(v) => set({ profile: v })} options={b.profiles.map((id) => ({ value: id, label: PROFILES.find((p) => p.id === id)?.name ?? id }))} />
            <SelectField label="Colour space" value={config.colourSpace} onChange={(v) => set({ colourSpace: v })} options={b.colourSpaces.map((x) => ({ value: x, label: x }))} />
            {(prof.kind === 'log' || prof.kind === 'hdr') && (
              <Check label="Monitoring LUT on the preview (does not change what is recorded)" checked={config.monitorLut} onChange={(v) => set({ monitorLut: v })} />
            )}
          </div>
        </Blueprint>

        <Blueprint title="Recording">
          <div className="stack stack--sm">
            <SelectField label="Resolution" value={config.resolution} onChange={(v) => set({ resolution: v })} options={b.resolutions.map((r) => ({ value: r.label, label: `${r.label} · up to ${r.maxFps} fps` }))} />
            <SelectField label="Frame rate" value={String(config.fps)} onChange={(v) => set({ fps: Number(v) })} options={b.fpsOptions.filter((f) => f <= res.maxFps).map((f) => ({ value: String(f), label: `${f} fps` }))} />
            <SelectField label="Codec" value={config.codec} onChange={(v) => set({ codec: v })} options={b.codecs.map((k) => ({ value: k.name, label: `${k.name} (${k.format})` }))} />
            <div className="grid-2">
              <SelectField label="Bit depth" value={config.bitDepth} onChange={(v) => set({ bitDepth: v })} options={codec.bitDepths.map((x) => ({ value: x, label: x }))} />
              <SelectField label="Chroma" value={config.chroma} onChange={(v) => set({ chroma: v })} options={codec.chroma.map((x) => ({ value: x, label: x }))} />
            </div>
            <SelectField label="Stabilisation" value={config.stabilisation} onChange={(v) => set({ stabilisation: v })} options={b.stabilisation.map((x) => ({ value: x, label: x }))} />
          </div>
        </Blueprint>

        <Blueprint title="Position and movement">
          <div className="stack stack--sm">
            <div className="grid-2">
              <Stepper label="Lens height" unit="m" value={config.height} onChange={(v) => set({ height: v })} min={0.1} max={4} step={0.05} decimals={2} />
              <Stepper label="Tilt" unit="°" value={config.tilt} onChange={(v) => set({ tilt: v })} min={-60} max={60} step={1} />
            </div>
            <div className="grid-2">
              <Stepper label="Pan speed" unit="°/s" value={config.panSpeed} onChange={(v) => set({ panSpeed: v })} min={0} max={180} step={5} />
              <Stepper label="Subject speed" unit="m/s" value={config.subjectSpeed} onChange={(v) => set({ subjectSpeed: v })} min={0} max={15} step={0.5} decimals={1} />
            </div>
            <TextAreaField label="Camera notes" value={config.notes} onChange={(v) => set({ notes: v })} rows={3} />
          </div>
        </Blueprint>

        <Blueprint
          title={`Rig and accessories (${rig.length})`}
          aside={
            <div className="cluster">
              <Button size="sm" variant="quiet" icon={<Wand2 size={14} />} onClick={() => setPicking('connect')}>Auto Connect</Button>
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setPicking('equip')}>Add Equipment</Button>
            </div>
          }
        >
          <div className="stack stack--sm">
            <Link to={`/rig/${cam.id}`} className="btn btn--sm btn--quiet"><Box size={14} /> Open 3D rig builder</Link>
            {[cam, ...rig].map((g) => (
              <RigItem key={g.id} g={g} isBody={g.id === cam.id} />
            ))}
            {issues.length > 0 && (
              <ul className="cam-warns" aria-label="Rig issues">
                {issues.map((i, n) => (
                  <li key={n} className={`cam-warn cam-warn--${i.level === 'error' ? 'warn' : 'info'}`}>{i.text}</li>
                ))}
              </ul>
            )}
          </div>
        </Blueprint>

        <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setRemoving(true)}>Remove this camera</Button>
      </div>

      <LensPicker open={picking === 'lens'} onClose={() => setPicking(null)} mount={b.mount} onPick={attachLens} currentId={config.lensGearId} />
      <BodyPicker open={picking === 'body'} onClose={() => setPicking(null)} onPick={changeBody} title="Change body" />
      <EquipmentSheet open={picking === 'equip'} onClose={() => setPicking(null)} cam={cam} rig={rig} />
      <AutoConnectSheet open={picking === 'connect'} onClose={() => setPicking(null)} cameraId={cam.id} />
      <Confirm open={removing} onClose={() => setRemoving(false)} onConfirm={removeCamera} title="Remove this camera?" body="Its lens and accessories stay in your gear, unrigged. Its connections are removed." confirmLabel="Remove" danger />
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="readout">
      <span className="readout__label">{label}</span>
      <span className="readout__value readout__value--sm">{value}</span>
    </div>
  );
}

function RigItem({ g, isBody }: { g: GearItem; isBody: boolean }) {
  const project = useProject();
  const patch = useProjects((s) => s.patchCurrent);
  const usage = portUsage(g, project.gear, project.connections);
  const unrig = () =>
    patch((pr) => ({
      gear: pr.gear.map((x) => (x.id === g.id ? { ...x, rigOf: undefined } : x)),
      connections: pr.connections.filter((c) => c.fromGear !== g.id && c.toGear !== g.id),
    }));
  return (
    <details className="rig-item">
      <summary>
        <span className="gear-code">{categoryInfo(g.category).code}</span>
        <span className="rig-item__name">{g.name}</span>
        <span className="micro">{usage.filter((u) => u.connection).length}/{g.ports.length} ports</span>
      </summary>
      <div className="stack stack--sm rig-item__body">
        {g.specs && g.specs.length > 0 && (
          <dl className="spec-list">
            {g.specs.map((s) => (
              <div key={s.label}><dt className="micro">{s.label}</dt><dd className="mono">{s.value}</dd></div>
            ))}
            {g.payloadKg != null && <div><dt className="micro">Payload</dt><dd className="mono">{g.payloadKg} kg</dd></div>}
          </dl>
        )}
        <ul className="port-usage">
          {usage.map(({ port, other, otherPort }) => (
            <li key={port.id} className={other ? 'is-used' : ''}>
              <span className="mono">{port.dir === 'in' ? 'IN ' : 'OUT'}</span> {port.name} <span className="micro">{port.connector}{port.standard ? ` · ${port.standard}` : ''}</span>
              <span className="port-usage__to">{other ? <><Cable size={12} /> {other.name} · {otherPort?.name}</> : <span className="micro">free</span>}</span>
            </li>
          ))}
        </ul>
        {!isBody && <Button size="sm" variant="quiet" icon={<Unplug size={14} />} onClick={unrig}>Take off this rig</Button>}
      </div>
    </details>
  );
}

function LensPicker({ open, onClose, mount, onPick, currentId }: { open: boolean; onClose: () => void; mount: string; onPick: (c: { lens?: LensDef; gearId?: string; adapterId?: string }) => void; currentId?: string }) {
  const project = useProject();
  const { native, adapted } = lensesFor(mount);
  const owned = project.gear.filter((g) => g.category === 'lens' && g.lens);
  const ownedFit = owned.filter((g) => g.lens!.mount === mount);
  const ownedAdapted = owned
    .filter((g) => g.lens!.mount !== mount)
    .map((g) => ({ g, ad: ADAPTERS.find((a) => a.cameraMount === mount && a.lensMount === g.lens!.mount) }))
    .filter((x) => x.ad);
  return (
    <Sheet open={open} onClose={onClose} title={`Lenses for ${mount} mount`} wide>
      <div className="stack">
        {(ownedFit.length > 0 || ownedAdapted.length > 0) && (
          <div className="stack stack--sm">
            <span className="micro">Already in your gear</span>
            <div className="template-grid">
              {ownedFit.map((g) => (
                <button key={g.id} type="button" className={`preset-card ${g.id === currentId ? 'is-on' : ''}`} onClick={() => onPick({ gearId: g.id })}>
                  <strong>{g.name}</strong>
                  <span className="micro">Fits directly</span>
                </button>
              ))}
              {ownedAdapted.map(({ g, ad }) => (
                <button key={g.id} type="button" className="preset-card" onClick={() => onPick({ gearId: g.id, adapterId: ad!.id })}>
                  <strong>{g.name}</strong>
                  <span className="micro">With {ad!.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="stack stack--sm">
          <span className="micro">{mount} lenses</span>
          {native.length ? (
            <div className="template-grid">
              {native.map((l) => (
                <button key={l.id} type="button" className="preset-card" onClick={() => onPick({ lens: l })}>
                  <strong>{l.manufacturer} {l.model}</strong>
                  <span className="micro">{l.weightKg} kg · {l.filterThread ? `${l.filterThread} mm filter` : 'no filter thread'}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">No {mount} lenses in the database yet. Add one in Gear and fill in its lens details.</p>
          )}
        </div>
        {adapted.length > 0 && (
          <div className="stack stack--sm">
            <span className="micro">Through an adapter</span>
            <div className="template-grid">
              {adapted.map(({ lens: l, adapter }) => (
                <button key={`${l.id}-${adapter.id}`} type="button" className="preset-card" onClick={() => onPick({ lens: l, adapterId: adapter.id })}>
                  <strong>{l.manufacturer} {l.model}</strong>
                  <span className="micro">{adapter.name}{adapter.focalFactor !== 1 ? ` · ×${adapter.focalFactor} focal` : ''}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="micro">Only lenses that fit {mount}, directly or with a real adapter, are shown. {LENSES.length} lenses in the database.</p>
      </div>
    </Sheet>
  );
}

/** Add accessories to this camera's rig. Each one shows whether it fits what is already there. */
function EquipmentSheet({ open, onClose, cam, rig }: { open: boolean; onClose: () => void; cam: GearItem; rig: GearItem[] }) {
  const project = useProject();
  const patch = useProjects((s) => s.patchCurrent);
  const parts = [cam, ...rig];
  function fit(t: GearTemplate): { label: string; tone: 'ok' | 'wash' | 'danger' } {
    const probe = gearFromTemplate(t);
    probe.rigOf = cam.id;
    for (const a of parts)
      for (const ap of a.ports)
        for (const pp of probe.ports) {
          const r = ap.dir === 'out' && pp.dir === 'in' ? check(a, ap, probe, pp) : ap.dir === 'in' && pp.dir === 'out' ? check(probe, pp, a, ap) : null;
          if (r?.ok && r.score >= 30) return { label: `Fits ${a.name.replace(/^Camera [A-Z] · /, '')}`, tone: 'ok' };
        }
    return probe.ports.length ? { label: 'Needs another part first', tone: 'wash' } : { label: 'Carried, no connection', tone: 'wash' };
  }
  function add(t: GearTemplate) {
    const g = { ...gearFromTemplate(t, nextName(project.gear, t.category, t.name)), rigOf: cam.id };
    patch((p) => ({ gear: [...p.gear, g] }));
    toast(`Added ${g.name}. Use Auto Connect to hook it up.`);
  }
  const groups = RIG_CATEGORIES.map((c) => ({ c, list: TEMPLATES.filter((t) => t.category === c) })).filter((x) => x.list.length);
  return (
    <Sheet open={open} onClose={onClose} title="Add Equipment" wide>
      <div className="stack">
        <p className="muted">Tap to add to this camera. The badge says whether it fits something already on the rig. Nothing connects until you use Auto Connect or connect it yourself.</p>
        {groups.map(({ c, list }) => (
          <div key={c} className="stack stack--sm">
            <span className="micro">{categoryInfo(c).label}</span>
            <div className="template-grid">
              {list.map((t) => {
                const f = open ? fit(t) : null;
                return (
                  <button key={t.id} type="button" className="preset-card" onClick={() => add(t)}>
                    <strong>{t.name}</strong>
                    {t.specs?.[0] && <span className="micro">{t.specs.map((s) => s.value).slice(0, 2).join(' · ')}</span>}
                    {f && <span className={`tag tag--${f.tone}`}>{f.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="stack stack--sm">
          <span className="micro">Anything else</span>
          <div className="template-grid">
            <button type="button" className="preset-card" onClick={() => { const g = { ...blankGear('rigging'), name: 'Custom accessory', rigOf: cam.id }; patch((p) => ({ gear: [...p.gear, g] })); toast('Added a custom accessory. Name it and add its ports in Gear.'); }}>
              <strong>Custom</strong>
              <span>Name it, add specs and ports in Gear.</span>
            </button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
