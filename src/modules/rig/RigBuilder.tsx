import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { ArrowLeft, Download, Move, Plus, RefreshCw, RotateCw, Trash2, Wand2 } from 'lucide-react';
import { PageHead } from '@/components/PageHead';
import { Blueprint } from '@/components/Blueprint';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Sheet } from '@/components/Sheet';
import { useProject, useProjects } from '@/store/projects';
import { toast } from '@/store/toast';
import { downloadBlob, safeFilename } from '@/lib/download';
import { TEMPLATES, categoryInfo, gearFromTemplate, type GearTemplate } from '@/lib/gear/catalog';
import { portUsage } from '@/lib/gear/autoconnect';
import { AutoConnectSheet } from '@/modules/gear/AutoConnectSheet';
import type { GearItem, RigPos } from '@/types/project';
import { RIG_INK, buildRig, makeGrid, renderRigPng, rigLights, rigParts } from './rigScene';
import '@/modules/gear/gear.css';
import '@/modules/cameras/cameras.css';
import './rig.css';

export default function RigBuilder() {
  const { id } = useParams();
  const project = useProject();
  const cam = project.gear.find((g) => g.id === id && g.category === 'camera');
  if (!cam)
    return (
      <main className="page">
        <EmptyState title="Camera not found" body="It may have been removed. Pick a camera to build its rig." action={<Link className="btn btn--primary" to="/cameras">Cameras</Link>} />
      </main>
    );
  return <Builder cam={cam} />;
}

function Builder({ cam }: { cam: GearItem }) {
  const project = useProject();
  const patch = useProjects((s) => s.patchCurrent);
  const hostRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'move'>('view');
  const [sheet, setSheet] = useState<'replace' | 'connect' | null>(null);
  const items = rigParts(cam, project.gear);
  const sel = selected === cam.id ? cam : items.find((g) => g.id === selected);
  const st = useRef<{
    renderer: THREE.WebGLRenderer;
    labels: CSS2DRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    orbit: OrbitControls;
    gizmo: TransformControls;
    rig: THREE.Group | null;
    framed: boolean;
    render: () => void;
  } | null>(null);
  const selRef = useRef(selected);
  useEffect(() => {
    selRef.current = selected;
  }, [selected]);

  // Scene, renderer, controls: once.
  useEffect(() => {
    const host = hostRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    host.appendChild(renderer.domElement);
    const labels = new CSS2DRenderer();
    labels.domElement.className = 'rig-labels';
    host.appendChild(labels.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(RIG_INK.bg);
    rigLights(scene);
    scene.add(makeGrid());
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 50);
    camera.position.set(-0.6, 0.4, 0.7);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.target.set(0, 0.05, 0);
    const gizmo = new TransformControls(camera, renderer.domElement);
    gizmo.setSize(0.7);
    gizmo.addEventListener('dragging-changed', (e) => {
      orbit.enabled = !e.value;
      if (!e.value && gizmo.object) {
        const o = gizmo.object;
        const gid = o.userData.gearId as string;
        const pos: RigPos = { x: +o.position.x.toFixed(4), y: +o.position.y.toFixed(4), z: +o.position.z.toFixed(4), ry: Math.round(((o.userData.ry as number) ?? 0)) };
        patch((p) => ({ gear: p.gear.map((g) => (g.id === gid ? { ...g, rigPos: { ...pos, ry: g.rigPos?.ry ?? 0 } } : g)) }));
      }
    });
    gizmo.addEventListener('change', () => render());
    scene.add(gizmo.getHelper());
    let dirty = true;
    const render = () => {
      dirty = true;
    };
    orbit.addEventListener('change', render);
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      orbit.update();
      if (dirty) {
        renderer.render(scene, camera);
        labels.render(scene, camera);
        dirty = false;
      }
    };
    loop();
    const ro = new ResizeObserver(() => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h, false);
      labels.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
    });
    ro.observe(host);
    // Click to pick a part.
    const ray = new THREE.Raycaster();
    let down = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5 || !st.current?.rig) return;
      if ((gizmo as unknown as { dragging: boolean }).dragging) return;
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.intersectObject(st.current.rig, true).find((h) => h.object.userData.gearId && h.object instanceof THREE.Mesh);
      if (hit) setSelected(hit.object.userData.gearId as string);
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    st.current = { renderer, labels, scene, camera, orbit, gizmo, rig: null, framed: false, render };
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      gizmo.detach();
      gizmo.dispose();
      orbit.dispose();
      renderer.dispose();
      host.innerHTML = '';
      st.current = null;
    };
  }, [patch]);

  // Rebuild the rig whenever the gear or connections change.
  useEffect(() => {
    const s = st.current;
    if (!s) return;
    s.gizmo.detach();
    if (s.rig) {
      s.scene.remove(s.rig);
      s.rig.traverse((o) => {
        if (o instanceof CSS2DObject) o.element.remove();
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) o.geometry.dispose();
      });
    }
    const { root, parts } = buildRig(cam, project.gear, project.connections);
    for (const p of parts) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `rig-label ${p.id === selRef.current ? 'is-on' : ''}`;
      el.textContent = p.name.replace(/^Camera [A-Z] · /, '');
      el.onclick = () => setSelected(p.id);
      const lab = new CSS2DObject(el);
      lab.position.copy(p.label);
      root.add(lab);
    }
    root.userData.parts = parts;
    s.scene.add(root);
    s.rig = root;
    if (!s.framed) {
      const bb = new THREE.Box3().setFromObject(root);
      const c = bb.getCenter(new THREE.Vector3());
      const size = bb.getSize(new THREE.Vector3()).length();
      s.orbit.target.copy(c);
      s.camera.position.copy(c.clone().add(new THREE.Vector3(-0.9, 0.55, 1).normalize().multiplyScalar(Math.max(0.5, size * 1.5))));
      s.framed = true;
    }
    s.render();
  }, [cam, project.gear, project.connections]);

  // Highlight and gizmo for the selected part.
  useEffect(() => {
    const s = st.current;
    if (!s?.rig) return;
    s.rig.traverse((o) => {
      if (o instanceof THREE.LineSegments && o.userData.edge) (o.material as THREE.LineBasicMaterial).color.setHex(o.userData.gearId === selected ? RIG_INK.sel : RIG_INK.edge);
      if (o instanceof CSS2DObject) o.element.classList.toggle('is-on', o.element.textContent === sel?.name.replace(/^Camera [A-Z] · /, ''));
    });
    const parts = s.rig.userData.parts as { id: string; object: THREE.Object3D }[];
    const p = parts.find((x) => x.id === selected);
    if (p && mode === 'move' && selected !== cam.id) s.gizmo.attach(p.object);
    else s.gizmo.detach();
    s.render();
  }, [selected, mode, cam.id, sel?.name, project.gear, project.connections]);

  function rotate() {
    if (!sel || sel.id === cam.id) return;
    const s = st.current;
    const p = (s?.rig?.userData.parts as { id: string; object: THREE.Object3D }[] | undefined)?.find((x) => x.id === sel.id);
    const base = sel.rigPos ?? (p ? { x: p.object.position.x, y: p.object.position.y, z: p.object.position.z, ry: 0 } : { x: 0, y: 0, z: 0, ry: 0 });
    patch((pr) => ({ gear: pr.gear.map((g) => (g.id === sel.id ? { ...g, rigPos: { ...base, ry: ((base.ry ?? 0) + 15) % 360 } } : g)) }));
  }
  function reset() {
    if (!sel) return;
    patch((pr) => ({ gear: pr.gear.map((g) => (g.id === sel.id ? { ...g, rigPos: undefined } : g)) }));
  }
  function remove() {
    if (!sel || sel.id === cam.id) return;
    patch((pr) => ({
      gear: pr.gear.map((g) => (g.id === sel.id ? { ...g, rigOf: undefined, rigPos: undefined } : g.id === cam.id && g.camera?.lensGearId === sel.id ? { ...g, camera: { ...g.camera, lensGearId: undefined } } : g)),
      connections: pr.connections.filter((c) => c.fromGear !== sel.id && c.toGear !== sel.id),
    }));
    setSelected(null);
    toast(`${sel.name} taken off the rig. It stays in your gear.`);
  }
  function replace(t: GearTemplate) {
    if (!sel) return;
    const fresh = gearFromTemplate(t);
    patch((pr) => {
      const ports = fresh.ports.map((p) => {
        const m = sel.ports.find((o) => o.name === p.name && o.dir === p.dir);
        return m ? { ...p, id: m.id } : p;
      });
      const keep = new Set(ports.map((p) => p.id));
      return {
        gear: pr.gear.map((g) => (g.id === sel.id ? { ...fresh, id: sel.id, name: fresh.name, ports, rigOf: cam.id, rigPos: undefined } : g)),
        connections: pr.connections.filter((c) => (c.fromGear !== sel.id || keep.has(c.fromPort)) && (c.toGear !== sel.id || keep.has(c.toPort))),
      };
    });
    setSheet(null);
    toast(`Replaced with ${fresh.name}`);
  }
  function download() {
    const url = renderRigPng(cam, project.gear, project.connections, 1800, 1200, true);
    if (!url) return toast('Could not draw the rig on this device');
    fetch(url).then((r) => r.blob()).then((b) => downloadBlob(b, `${safeFilename(cam.name)}-rig.png`));
  }

  const totalKg = [cam, ...items].reduce((a, g) => a + (g.weightKg ?? 0) * (g.qty || 1), 0);
  const usage = sel ? portUsage(sel, project.gear, project.connections) : [];
  const replaceWith = sel && sel.id !== cam.id ? TEMPLATES.filter((t) => t.category === sel.category && (t.rigKind === sel.rigKind || sel.category === 'lens' || sel.category === 'monitor')) : [];

  return (
    <main className="page">
      <PageHead
        index="Rig builder"
        title={cam.name}
        sub="Drag to orbit, scroll or pinch to zoom. Tap a part to inspect it, then move, turn, replace or remove it."
        actions={
          <Link to={`/cameras?cam=${cam.id}`} className="btn btn--sm btn--quiet">
            <ArrowLeft size={14} /> Camera settings
          </Link>
        }
      />
      <div className="rig-layout">
        <div className="stack stack--sm">
          <div className="rig-stage" ref={hostRef} role="group" aria-label={`3D rig: ${[cam, ...items].map((g) => g.name).join(', ')}`} />
          <div className="cluster">
            <Button size="sm" active={mode === 'move'} icon={<Move size={14} />} onClick={() => setMode(mode === 'move' ? 'view' : 'move')}>
              {mode === 'move' ? 'Moving: drag the arrows' : 'Move parts'}
            </Button>
            <Button size="sm" variant="quiet" icon={<Wand2 size={14} />} onClick={() => setSheet('connect')}>Auto Connect</Button>
            <Link className="btn btn--sm btn--quiet" to={`/cameras?cam=${cam.id}`}><Plus size={14} /> Add Equipment</Link>
            <Button size="sm" variant="quiet" icon={<Download size={14} />} onClick={download}>PNG</Button>
          </div>
          <p className="micro">Sizes come from the maker's published body and lens dimensions; accessories use typical sizes. Coloured tubes are cables (yellow video, blue audio, red power). Yellow diamonds are mounting points.</p>
        </div>
        <div className="stack">
          <Blueprint title={sel ? sel.name : 'Parts'} aside={<span className="mono micro">{totalKg.toFixed(2)} kg</span>}>
            {sel ? (
              <div className="stack stack--sm">
                <span className="micro">{categoryInfo(sel.category).label}{sel.weightKg ? ` · ${sel.weightKg} kg` : ''}{sel.payloadKg ? ` · holds ${sel.payloadKg} kg` : ''}</span>
                {sel.specs && (
                  <dl className="spec-list">
                    {sel.specs.map((s) => (
                      <div key={s.label}><dt className="micro">{s.label}</dt><dd className="mono">{s.value}</dd></div>
                    ))}
                  </dl>
                )}
                <ul className="port-usage">
                  {usage.map(({ port, other, otherPort }) => (
                    <li key={port.id} className={other ? 'is-used' : ''}>
                      <span className="mono">{port.dir === 'in' ? 'IN ' : 'OUT'}</span> {port.name}
                      <span className="port-usage__to">{other ? `${other.name} · ${otherPort?.name}` : <span className="micro">free</span>}</span>
                    </li>
                  ))}
                </ul>
                {sel.id !== cam.id && (
                  <div className="cluster">
                    <Button size="sm" icon={<RotateCw size={14} />} onClick={rotate}>Turn 15°</Button>
                    <Button size="sm" variant="quiet" icon={<RefreshCw size={14} />} onClick={reset}>Reset spot</Button>
                    {replaceWith.length > 1 && <Button size="sm" variant="quiet" onClick={() => setSheet('replace')}>Replace</Button>}
                    <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={remove}>Remove</Button>
                  </div>
                )}
                <Button size="sm" variant="quiet" onClick={() => setSelected(null)}>Show all parts</Button>
              </div>
            ) : (
              <ul className="rows">
                {[cam, ...items].map((g) => (
                  <li key={g.id}>
                    <button type="button" className="rig-pick" onClick={() => setSelected(g.id)}>
                      <span className="gear-code">{categoryInfo(g.category).code}</span>
                      <span>{g.name}</span>
                      <span className="micro">{g.weightKg ? `${g.weightKg} kg` : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Blueprint>
        </div>
      </div>
      <Sheet open={sheet === 'replace'} onClose={() => setSheet(null)} title={`Replace ${sel?.name ?? ''}`} wide>
        <div className="template-grid">
          {replaceWith.map((t) => (
            <button key={t.id} type="button" className="preset-card" onClick={() => replace(t)}>
              <strong>{t.name}</strong>
              <span>{t.specs?.map((s) => s.value).slice(0, 2).join(' · ')}</span>
            </button>
          ))}
        </div>
      </Sheet>
      <AutoConnectSheet open={sheet === 'connect'} onClose={() => setSheet(null)} cameraId={cam.id} />
    </main>
  );
}
