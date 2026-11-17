import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { ArrowLeft, Download, Focus, Maximize2, Plus, RotateCw, Tag, Trash2, Unplug, Wand2 } from 'lucide-react';
import { PageHead } from '@/components/PageHead';
import { Blueprint } from '@/components/Blueprint';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Sheet } from '@/components/Sheet';
import { useProject, useProjects } from '@/store/projects';
import { toast } from '@/store/toast';
import { uid } from '@/lib/id';
import { downloadBlob, safeFilename } from '@/lib/download';
import { TEMPLATES, categoryInfo, gearFromTemplate, type GearTemplate } from '@/lib/gear/catalog';
import { portUsage } from '@/lib/gear/autoconnect';
import { AutoConnectSheet } from '@/modules/gear/AutoConnectSheet';
import type { GearItem } from '@/types/project';
import { buildRig, frameBox, makeFloor, mountOptions, moveTo, renderRigPng, rigParts, setupRigScene, unmount, type BuiltRig, type MountSpot, type RigStyle } from './rigScene';
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

function readStyle(): RigStyle {
  try {
    return localStorage.getItem('afk-rig-style') === 'blueprint' ? 'blueprint' : 'real';
  } catch {
    return 'real';
  }
}

interface Stage {
  renderer: THREE.WebGLRenderer;
  labels: CSS2DRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  orbit: OrbitControls;
  content: THREE.Group;
  markers: THREE.Group;
  built: BuiltRig | null;
  framed: boolean;
  render: () => void;
}

function Builder({ cam }: { cam: GearItem }) {
  const project = useProject();
  const patch = useProjects((s) => s.patchCurrent);
  const hostRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [style, setStyle] = useState<RigStyle>(readStyle);
  const [showLabels, setShowLabels] = useState(true);
  const [view, setView] = useState<'camera' | 'all'>('camera');
  const [sheet, setSheet] = useState<'replace' | 'connect' | null>(null);
  const [options, setOptions] = useState<MountSpot[]>([]);
  const items = rigParts(cam, project.gear);
  const sel = selected === cam.id ? cam : items.find((g) => g.id === selected);
  const st = useRef<Stage | null>(null);
  // Latest values for the pointer handlers, which live outside React.
  const live = useRef({ selected, options, gear: project.gear, connections: project.connections });
  useEffect(() => {
    live.current = { selected, options, gear: project.gear, connections: project.connections };
  });

  function applyMove(partId: string, spot: Pick<MountSpot, 'hostId' | 'portId' | 'label'>) {
    patch((p) => ({ connections: moveTo(partId, spot, p.gear, p.connections, uid) }));
    toast(`Mounted on ${spot.label}`);
  }

  // Renderer, scene and controls: rebuilt when the style changes.
  useEffect(() => {
    const host = hostRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    const labels = new CSS2DRenderer();
    labels.domElement.className = 'rig-labels';
    host.appendChild(labels.domElement);
    const scene = new THREE.Scene();
    // Realistic: dark gear on a light studio floor reads best. Blueprint: light lines on ink.
    setupRigScene(scene, renderer, style, style === 'real');
    const content = new THREE.Group();
    const markers = new THREE.Group();
    scene.add(content, markers);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 50);
    camera.position.set(-0.6, 0.4, 0.7);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.target.set(0, 0.05, 0);
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
        declutter(labels.domElement);
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

    // Tap a part to select it, tap a yellow point to mount the selected part there, or drag the part onto one.
    const ray = new THREE.Raycaster();
    const ndc = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    const screenOf = (p: THREE.Vector3) => {
      const v = p.clone().project(camera);
      const r = renderer.domElement.getBoundingClientRect();
      return { x: (v.x * 0.5 + 0.5) * r.width, y: (-v.y * 0.5 + 0.5) * r.height };
    };
    let down: { x: number; y: number; part?: string; obj?: THREE.Object3D; start?: THREE.Vector3; plane?: THREE.Plane; grab?: THREE.Vector3 } | null = null;
    let dragging = false;
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
      const s = st.current;
      if (!s?.built) return;
      ray.setFromCamera(ndc(e), camera);
      const hit = ray.intersectObject(content, true).find((h) => h.object instanceof THREE.Mesh && h.object.userData.gearId);
      const id = hit?.object.userData.gearId as string | undefined;
      if (id && id === live.current.selected && id !== cam.id) {
        const part = s.built.parts.find((p) => p.id === id);
        if (part) {
          const normal = camera.getWorldDirection(new THREE.Vector3()).negate();
          down.part = id;
          down.obj = part.object;
          down.start = part.object.position.clone();
          down.plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, hit!.point);
          down.grab = hit!.point.clone();
        }
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!down?.part || !down.plane || !down.obj || !down.start || !down.grab) return;
      if (!dragging && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) return;
      dragging = true;
      orbit.enabled = false;
      ray.setFromCamera(ndc(e), camera);
      const p = new THREE.Vector3();
      if (ray.ray.intersectPlane(down.plane, p)) {
        down.obj.position.copy(down.start).add(p.sub(down.grab));
        render();
      }
    };
    const onUp = (e: PointerEvent) => {
      const d = down;
      down = null;
      orbit.enabled = true;
      if (dragging && d?.part && d.obj && d.start) {
        dragging = false;
        // Snap to the nearest free mounting point on screen, or go back.
        const r = renderer.domElement.getBoundingClientRect();
        const px = e.clientX - r.left;
        const py = e.clientY - r.top;
        let best: MountSpot | null = null;
        let bestD = 70;
        for (const o of live.current.options) {
          const sp = screenOf(o.pos);
          const dd = Math.hypot(sp.x - px, sp.y - py);
          if (dd < bestD) {
            bestD = dd;
            best = o;
          }
        }
        if (best) applyMove(d.part, best);
        else {
          d.obj.position.copy(d.start);
          render();
          toast('Drop it on a yellow point to mount it there');
        }
        return;
      }
      dragging = false;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
      ray.setFromCamera(ndc(e), camera);
      const mk = ray.intersectObject(markers, true)[0];
      if (mk && live.current.selected) {
        const spot = mk.object.userData.spot as MountSpot;
        applyMove(live.current.selected, spot);
        return;
      }
      const hit = ray.intersectObject(content, true).find((h) => h.object instanceof THREE.Mesh && h.object.userData.gearId);
      setSelected((hit?.object.userData.gearId as string) ?? null);
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerup', onUp);
    st.current = { renderer, labels, scene, camera, orbit, content, markers, built: null, framed: false, render };
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerup', onUp);
      orbit.dispose();
      scene.environment?.dispose();
      renderer.dispose();
      host.innerHTML = '';
      st.current = null;
    };
    // applyMove only uses stable store functions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, cam.id]);

  // Rebuild the rig whenever the gear, connections or style change.
  useEffect(() => {
    const s = st.current;
    if (!s) return;
    for (const c of [...s.content.children]) {
      s.content.remove(c);
      c.traverse((o) => {
        if (o instanceof CSS2DObject) o.element.remove();
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) o.geometry.dispose();
      });
    }
    const built = buildRig(cam, project.gear, project.connections, style, style === 'real');
    s.built = built;
    s.content.add(built.root);
    s.content.add(makeFloor(style, built.floorY, style === 'real'));
    for (const p of built.parts) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `rig-label ${p.mounted ? '' : 'is-loose'}`;
      el.dataset.id = p.id;
      el.textContent = p.mounted ? p.name : `${p.name} · not mounted`;
      el.onclick = () => setSelected(p.id);
      const lab = new CSS2DObject(el);
      lab.position.copy(p.label);
      s.content.add(lab);
    }
    if (!s.framed) {
      const box = built.focus.clone();
      for (const p of built.parts) if (!p.mounted) box.union(new THREE.Box3().setFromObject(p.object));
      frameBox(s.camera, box, s.orbit.target, 1.05);
      s.framed = true;
    }
    s.render();
  }, [cam, project.gear, project.connections, style]);

  // Selection: highlight, mount options and markers.
  useEffect(() => {
    const s = st.current;
    if (!s?.built) return;
    const opts = selected && selected !== cam.id ? mountOptions(selected, cam, project.gear, s.built) : [];
    setOptions(opts);
    for (const c of [...s.markers.children]) s.markers.remove(c);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xffc400, depthTest: false, transparent: true, opacity: 0.95 });
    for (const o of opts) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.009, 16, 12), markerMat);
      m.position.copy(o.pos);
      m.renderOrder = 10;
      m.userData.spot = o;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.012, 0.016, 32), new THREE.MeshBasicMaterial({ color: 0x0b0b0c, depthTest: false, side: THREE.DoubleSide }));
      ring.renderOrder = 9;
      ring.lookAt(s.camera.position.clone().sub(o.pos));
      m.add(ring);
      s.markers.add(m);
    }
    s.content.traverse((o) => {
      if (o instanceof THREE.LineSegments && o.userData.edge) (o.material as THREE.LineBasicMaterial).color.setHex(o.userData.gearId === selected ? 0xffc400 : 0xe9e6dc);
      if (o instanceof CSS2DObject) {
        o.element.classList.toggle('is-on', o.element.dataset.id === selected);
        o.element.style.display = showLabels || o.element.dataset.id === selected ? '' : 'none';
      }
    });
    s.render();
  }, [selected, cam, project.gear, project.connections, style, showLabels]);

  function frame(which: 'camera' | 'all') {
    const s = st.current;
    if (!s?.built) return;
    setView(which);
    const box = which === 'all' ? new THREE.Box3().setFromObject(s.built.root) : s.built.focus.clone();
    if (which === 'camera') for (const p of s.built.parts) if (!p.mounted) box.union(new THREE.Box3().setFromObject(p.object));
    frameBox(s.camera, box, s.orbit.target, which === 'all' ? 0.9 : 1.05);
    s.orbit.update();
    s.render();
  }
  function chooseStyle(v: RigStyle) {
    setStyle(v);
    try {
      localStorage.setItem('afk-rig-style', v);
    } catch {
      /* not saved */
    }
  }
  function rotate() {
    if (!sel || sel.id === cam.id) return;
    patch((pr) => ({ gear: pr.gear.map((g) => (g.id === sel.id ? { ...g, rigPos: { x: 0, y: 0, z: 0, ...g.rigPos, ry: ((g.rigPos?.ry ?? 0) + 15) % 360 } } : g)) }));
  }
  function takeOff() {
    if (!sel) return;
    patch((pr) => ({ connections: unmount(sel.id, pr.gear, pr.connections) }));
    toast(`${sel.name} is off its mount, on the tray`);
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
    void fetch(url)
      .then((r) => r.blob())
      .then((b) => downloadBlob(b, `${safeFilename(cam.name)}-rig.png`));
  }

  const totalKg = [cam, ...items].reduce((a, g) => a + (g.weightKg ?? 0) * (g.qty || 1), 0);
  const usage = sel ? portUsage(sel, project.gear, project.connections) : [];
  const replaceWith = sel && sel.id !== cam.id ? TEMPLATES.filter((t) => t.category === sel.category && (t.rigKind === sel.rigKind || sel.category === 'lens' || sel.category === 'monitor')) : [];
  const mountedOn = sel ? project.connections.find((c) => (c.toGear === sel.id && project.gear.find((g) => g.id === c.fromGear)?.ports.find((p) => p.id === c.fromPort)?.signal === 'mount') || (c.fromGear === sel.id && sel.ports.find((p) => p.id === c.fromPort)?.connector === 'Battery plate')) : undefined;
  const hostName = mountedOn ? project.gear.find((g) => g.id === (mountedOn.toGear === sel?.id ? mountedOn.fromGear : mountedOn.toGear))?.name.replace(/^Camera [A-Z] · /, '') : null;
  const loose = items.filter((g) => !project.connections.some((c) => c.toGear === g.id || c.fromGear === g.id));

  return (
    <main className="page">
      <PageHead
        index="Rig builder"
        title={cam.name}
        sub="Tap a part to see where it can go: yellow points are free mounting points that fit. Tap one, or drag the part onto it."
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
            <div className="seg" role="group" aria-label="Look">
              <Button size="sm" active={style === 'real'} onClick={() => chooseStyle('real')}>Realistic</Button>
              <Button size="sm" active={style === 'blueprint'} onClick={() => chooseStyle('blueprint')}>Blueprint</Button>
            </div>
            <Button size="sm" variant="quiet" active={view === 'camera'} icon={<Focus size={14} />} onClick={() => frame('camera')}>Camera</Button>
            <Button size="sm" variant="quiet" active={view === 'all'} icon={<Maximize2 size={14} />} onClick={() => frame('all')}>Whole rig</Button>
            <Button size="sm" variant="quiet" active={showLabels} icon={<Tag size={14} />} onClick={() => setShowLabels(!showLabels)}>Labels</Button>
            <Button size="sm" variant="quiet" icon={<Wand2 size={14} />} onClick={() => setSheet('connect')}>Auto Connect</Button>
            <Link className="btn btn--sm btn--quiet" to={`/cameras?cam=${cam.id}`}><Plus size={14} /> Add Equipment</Link>
            <Button size="sm" variant="quiet" icon={<Download size={14} />} onClick={download}>PNG</Button>
          </div>
          <p className="micro">Body and lens use their real sizes; accessories use typical sizes. Each part sits where it is connected, so this always matches the connection list. Cables run between the real ports (yellow plug video, blue audio, red power).</p>
        </div>
        <div className="stack">
          <Blueprint title={sel ? sel.name : 'Parts'} aside={<span className="mono micro">{totalKg.toFixed(2)} kg</span>}>
            {sel ? (
              <div className="stack stack--sm">
                <span className="micro">
                  {categoryInfo(sel.category).label}
                  {sel.weightKg ? ` · ${sel.weightKg} kg` : ''}
                  {sel.payloadKg ? ` · holds ${sel.payloadKg} kg` : ''}
                </span>
                {sel.id !== cam.id && <p className="small">{hostName ? <>Mounted on <strong>{hostName}</strong>.</> : 'Not mounted yet: it is on the tray.'}</p>}
                {sel.id !== cam.id && (
                  <div className="stack stack--sm">
                    <span className="micro">{options.length ? 'Move it to' : 'Nowhere free fits it'}</span>
                    {options.length > 0 ? (
                      <div className="mount-list">
                        {options.map((o) => (
                          <button key={`${o.hostId}:${o.portId}`} type="button" className="mount-opt" onClick={() => applyMove(sel.id, o)}>
                            <span className="mount-opt__dot" aria-hidden /> {o.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="tiny muted">Add a cage, handle, rail or plate with a matching mount, or free one up.</p>
                    )}
                  </div>
                )}
                {sel.specs && (
                  <dl className="spec-list">
                    {sel.specs.map((s) => (
                      <div key={s.label}>
                        <dt className="micro">{s.label}</dt>
                        <dd className="mono">{s.value}</dd>
                      </div>
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
                    {hostName && <Button size="sm" icon={<RotateCw size={14} />} onClick={rotate}>Turn 15°</Button>}
                    {hostName && <Button size="sm" variant="quiet" icon={<Unplug size={14} />} onClick={takeOff}>Take off</Button>}
                    {replaceWith.length > 1 && <Button size="sm" variant="quiet" onClick={() => setSheet('replace')}>Replace</Button>}
                    <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={remove}>Remove from rig</Button>
                  </div>
                )}
                <Button size="sm" variant="quiet" onClick={() => setSelected(null)}>Show all parts</Button>
              </div>
            ) : (
              <div className="stack stack--sm">
                {loose.length > 0 && <p className="tiny muted">{loose.length} on the tray, not mounted yet. Tap one to place it, or use Auto Connect.</p>}
                <ul className="rows">
                  {[cam, ...items].map((g) => (
                    <li key={g.id}>
                      <button type="button" className="rig-pick" onClick={() => setSelected(g.id)}>
                        <span className="gear-code">{categoryInfo(g.category).code}</span>
                        <span>{g.name}</span>
                        <span className="micro">{loose.includes(g) ? 'on tray' : g.weightKg ? `${g.weightKg} kg` : ''}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
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

/** Nudge overlapping labels apart, top to bottom. */
function declutter(root: HTMLElement) {
  const els = [...root.querySelectorAll<HTMLElement>('.rig-label')].filter((e) => e.style.display !== 'none' && e.parentElement?.style.display !== 'none');
  for (const e of els) e.style.marginTop = '0px';
  const boxes = els.map((e) => ({ e, r: e.getBoundingClientRect() })).sort((a, b) => a.r.top - b.r.top);
  const placed: DOMRect[] = [];
  for (const b of boxes) {
    let shift = 0;
    let guard = 0;
    while (guard++ < 30) {
      const top = b.r.top + shift;
      const hit = placed.find((p) => b.r.left < p.right && p.left < b.r.right && top < p.bottom + 2 && p.top < top + b.r.height);
      if (!hit) break;
      shift = hit.bottom + 2 - b.r.top;
    }
    if (shift) b.e.style.marginTop = `${shift}px`;
    placed.push(new DOMRect(b.r.left, b.r.top + shift, b.r.width, b.r.height));
  }
}
