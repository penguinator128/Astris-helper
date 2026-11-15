import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Download, FlipHorizontal2, Image as ImageIcon, LayoutGrid, ListOrdered, Plus, Trash2, X } from 'lucide-react';
import { Blueprint } from '@/components/Blueprint';
import { Button } from '@/components/Button';
import { Segmented } from '@/components/Segmented';
import { Slider } from '@/components/Slider';
import { Stepper } from '@/components/Stepper';
import { Check, SelectField, TextAreaField, TextField } from '@/components/Field';
import { Readout } from '@/components/Readout';
import { Tabs } from '@/components/Tabs';
import { useProject, useProjects } from '@/store/projects';
import { getImageUrl, storeImage, getImageBlob, blobToDataUrl } from '@/store/images';
import { toast } from '@/store/toast';
import { uid } from '@/lib/id';
import { ASPECTS, CAMERA_ANGLES, CAMERA_MOVES, aspectRatio, type Composition, type FrameElement, type SilhouetteKind } from '@/types/project';
import { SILHOUETTES, silhouette } from '@/lib/frame/silhouettes';
import { classifyShotSize, SHOT_SIZE_HINTS } from '@/lib/frame/shotSize';
import { getSensor } from '@/lib/calc/sensors';
import { fieldOfView, sceneSizeAtDistance, backgroundBlurFraction, describeBlur, distanceForSubject } from '@/lib/calc/optics';
import { STANDARD_APERTURES } from '@/lib/calc/exposure';
import { useUnits } from '@/lib/useUnits';
import { fmtDegrees, fmtNum } from '@/lib/format';
import { svgToPng } from '@/lib/svgExport';
import { downloadDataUrl, pickFile, safeFilename } from '@/lib/download';
import { sendCompositionToShotList, sendCompositionToStoryboard } from '@/store/actions';
import { CompositionSvg, FRAME_W } from './CompositionSvg';
import './frame.css';

const GUIDES: { key: keyof Composition['guides']; label: string }[] = [
  { key: 'thirds', label: 'Rule of thirds' },
  { key: 'goldenRatio', label: 'Golden ratio' },
  { key: 'goldenSpiral', label: 'Golden spiral' },
  { key: 'goldenTriangles', label: 'Golden triangles' },
  { key: 'diagonals', label: 'Diagonals' },
  { key: 'centre', label: 'Centre cross' },
  { key: 'actionSafe', label: 'Action safe (90%)' },
  { key: 'titleSafe', label: 'Title safe (80%)' },
  { key: 'headroom', label: 'Headroom' },
  { key: 'leadRoom', label: 'Lead room' },
];

type Panel = 'frame' | 'elements' | 'camera' | 'look';

export default function FrameEditor() {
  const { id } = useParams();
  const project = useProject();
  const existing = project.compositions.find((c) => c.id === id);
  if (!existing) return <Navigate to="/frame" replace />;
  return <Editor key={existing.id} initial={existing} />;
}

function Editor({ initial }: { initial: Composition }) {
  const project = useProject();
  const patch = useProjects((s) => s.patchCurrent);
  const nav = useNavigate();
  const u = useUnits();
  const [comp, setComp] = useState<Composition>(initial);
  const [selected, setSelected] = useState<string | null>(initial.elements[0]?.id ?? null);
  const [panel, setPanel] = useState<Panel>('elements');
  const [bg, setBg] = useState<{ id: string; url: string | null } | null>(null);
  const bgUrl = bg && bg.id === comp.backgroundImageId ? bg.url : null;
  const svgRef = useRef<SVGSVGElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Persist to the project, debounced.
  const dirty = useRef(false);
  useEffect(() => {
    if (comp === initial) return;
    dirty.current = true;
    const t = setTimeout(() => {
      patch((p) => ({ compositions: p.compositions.map((c) => (c.id === comp.id ? { ...comp, updatedAt: Date.now() } : c)) }));
      dirty.current = false;
    }, 250);
    return () => clearTimeout(t);
  }, [comp, initial, patch]);

  useEffect(() => {
    let alive = true;
    const imgId = comp.backgroundImageId;
    if (imgId) void getImageUrl(imgId).then((url) => alive && setBg({ id: imgId, url }));
    return () => {
      alive = false;
    };
  }, [comp.backgroundImageId]);

  const update = useCallback((delta: Partial<Composition> | ((c: Composition) => Partial<Composition>)) => {
    setComp((c) => ({ ...c, ...(typeof delta === 'function' ? delta(c) : delta) }));
  }, []);
  const updateEl = useCallback((elId: string, delta: Partial<FrameElement>) => {
    setComp((c) => ({ ...c, elements: c.elements.map((e) => (e.id === elId ? { ...e, ...delta } : e)) }));
  }, []);

  const sel = comp.elements.find((e) => e.id === selected) ?? null;
  const palette = project.palettes.find((p) => p.id === comp.paletteId) ?? null;
  const shotSize = classifyShotSize(comp.elements);
  const sensor = getSensor(project.camera.sensorId, project.camera.customSensor);
  const fov = fieldOfView(comp.focalLength, sensor.width, sensor.height);
  const scene = sceneSizeAtDistance(comp.focalLength, sensor.width, sensor.height, comp.subjectDistance);
  const blur = backgroundBlurFraction(comp.focalLength, comp.aperture, comp.subjectDistance, sensor.width);

  /* ---------- pointer interactions ---------- */
  const drag = useRef<{ kind: 'move' | 'scale'; id: string; startX: number; startY: number; el: FrameElement; rect: DOMRect } | null>(null);

  function frameRect() {
    return svgRef.current!.getBoundingClientRect();
  }

  function onElementPointerDown(e: ReactPointerEvent, elId: string) {
    e.stopPropagation();
    const el = comp.elements.find((x) => x.id === elId);
    if (!el) return;
    setSelected(elId);
    drag.current = { kind: 'move', id: elId, startX: e.clientX, startY: e.clientY, el, rect: frameRect() };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }
  function onHandlePointerDown(e: ReactPointerEvent, elId: string) {
    e.stopPropagation();
    const el = comp.elements.find((x) => x.id === elId);
    if (!el) return;
    drag.current = { kind: 'scale', id: elId, startX: e.clientX, startY: e.clientY, el, rect: frameRect() };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: ReactPointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / d.rect.width;
    const dy = (e.clientY - d.startY) / d.rect.height;
    if (d.kind === 'move') updateEl(d.id, { x: Math.max(-0.5, Math.min(1.5, d.el.x + dx)), y: Math.max(-1, Math.min(3, d.el.y + dy)) });
    else updateEl(d.id, { scale: Math.max(0.05, Math.min(12, d.el.scale + dy * 2)) });
  }
  function onPointerUp() {
    drag.current = null;
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!sel) return;
    const step = e.shiftKey ? 0.05 : 0.01;
    const map: Record<string, Partial<FrameElement>> = {
      ArrowLeft: { x: sel.x - step },
      ArrowRight: { x: sel.x + step },
      ArrowUp: { y: sel.y - step },
      ArrowDown: { y: sel.y + step },
    };
    if (map[e.key]) {
      e.preventDefault();
      updateEl(sel.id, map[e.key]);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      removeEl(sel.id);
    } else if (e.key === 'Escape') setSelected(null);
    else if (e.key === '+' || e.key === '=') updateEl(sel.id, { scale: sel.scale * 1.05 });
    else if (e.key === '-') updateEl(sel.id, { scale: sel.scale / 1.05 });
  }

  function addEl(kind: SilhouetteKind) {
    const def = silhouette(kind);
    const el: FrameElement = { id: uid(), kind, x: 0.5, y: def.person ? 1.1 : 0.95, scale: def.person ? (kind === 'group' ? 0.8 : 1.2) : 0.3, flip: false };
    update((c) => ({ elements: [...c.elements, el] }));
    setSelected(el.id);
    setPanel('elements');
  }
  function removeEl(elId: string) {
    update((c) => ({ elements: c.elements.filter((e) => e.id !== elId) }));
    if (selected === elId) setSelected(null);
  }

  function sizeFromLens() {
    // A 1.8 m standing figure at the subject distance: image height / sensor height = fraction of frame height.
    const h = (1800 * comp.focalLength) / Math.max(1, comp.subjectDistance * 1000 - comp.focalLength) / sensor.height;
    update((c) => ({
      elements: c.elements.map((e) => {
        const def = silhouette(e.kind);
        if (!def.person) return e;
        const figureM = e.kind === 'seated' ? 1.3 : 1.8;
        const scale = (h * figureM) / 1.8;
        return { ...e, scale, y: Math.min(e.y, 0.98 + Math.max(0, scale - 0.9)) };
      }),
    }));
    toast(`Figures sized for ${comp.focalLength} mm at ${u.fmt(comp.subjectDistance)}`);
  }

  async function chooseBackground() {
    const file = await pickFile('image/*');
    if (!file) return;
    const imgId = await storeImage(file);
    update({ backgroundImageId: imgId });
  }

  async function exportPng() {
    const svg = svgRef.current;
    if (!svg) return;
    const ratio = aspectRatio(comp.aspect);
    const W = 1600;
    const H = Math.round(W / ratio);
    const clone = svg.cloneNode(true) as SVGSVGElement;
    if (comp.backgroundImageId) {
      const blob = await getImageBlob(comp.backgroundImageId);
      if (blob) {
        const dataUrl = await blobToDataUrl(blob);
        clone.querySelectorAll('image').forEach((img) => img.setAttribute('href', dataUrl));
      }
    }
    // Hide selection chrome in the export
    clone.querySelectorAll('[data-chrome]').forEach((n) => n.remove());
    const png = await svgToPng(clone, W, H, { background: '#FAFAF7', embedFonts: true });
    downloadDataUrl(png, `${safeFilename(project.name)}-${safeFilename(comp.name)}.png`);
    toast('PNG exported');
  }

  useEffect(() => {
    return () => {
      // flush on unmount
      if (dirty.current) patch((p) => ({ compositions: p.compositions.map((c) => (c.id === comp.id ? { ...comp, updatedAt: Date.now() } : c)) }));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const compForSvg = useMemo(() => comp, [comp]);

  return (
    <main className="page page--wide">
      <div className="page__head" style={{ alignItems: 'center' }}>
        <div className="cluster" style={{ flexWrap: 'nowrap', minWidth: 0 }}>
          <Link to="/frame" className="btn btn--ghost btn--sm btn--icon" aria-label="All frames">
            <ArrowLeft size={18} />
          </Link>
          <div style={{ minWidth: 0 }}>
            <span className="page__idx">03 · Frame</span>
            <input className="input" aria-label="Frame name" value={comp.name} onChange={(e) => update({ name: e.target.value })} style={{ fontWeight: 600, fontSize: 'var(--fs-20)', border: 0, padding: 0, minHeight: 32, background: 'transparent' }} />
          </div>
        </div>
        <div className="page__actions">
          <Button size="sm" variant="quiet" icon={<Download size={14} />} onClick={() => void exportPng()}>
            PNG
          </Button>
          <Button
            size="sm"
            variant="quiet"
            icon={<LayoutGrid size={14} />}
            onClick={() => {
              sendCompositionToStoryboard(comp);
              toast('Added to the storyboard');
            }}
          >
            Storyboard
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={<ListOrdered size={14} />}
            onClick={() => {
              sendCompositionToShotList(comp);
              toast('Added to the shot list');
              nav('/shots');
            }}
          >
            Shot list
          </Button>
        </div>
      </div>

      <div className="tool tool--canvas">
        <div className="stack">
          <div
            ref={stageRef}
            className="frame-stage"
            tabIndex={0}
            onKeyDown={onKeyDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            aria-label="Frame canvas. Drag figures to move, drag the corner handle to resize, arrow keys to nudge."
          >
            <CompositionSvg
              ref={svgRef}
              comp={compForSvg}
              palette={palette}
              backgroundUrl={bgUrl}
              selectedId={selected}
              interactive
              onElementPointerDown={onElementPointerDown}
              onHandlePointerDown={onHandlePointerDown}
              onBackgroundPointerDown={() => setSelected(null)}
            />
            <div className="frame-badges" aria-hidden="true">
              <span className="tag tag--accent">{shotSize ?? 'No subject'}</span>
              <span className="tag" style={{ background: 'var(--bg)' }}>
                {comp.aspect}
              </span>
              <span className="tag" style={{ background: 'var(--bg)' }}>
                {comp.focalLength} mm
              </span>
            </div>
          </div>
          <Blueprint tone="yellow" aria-live="polite" aria-label="Framing readouts">
            <div className="readout-grid">
              <Readout label="Shot size" value={shotSize ?? '—'} size="sm" sub={shotSize ? SHOT_SIZE_HINTS[shotSize] : 'Add a person silhouette'} />
              <Readout label="Horizontal FOV" value={fmtDegrees(fov.horizontal, 1)} size="sm" sub={`${sensor.name}`} />
              <Readout label={`Scene at ${u.fmt(comp.subjectDistance)}`} value={`${u.fmt(scene.width, 1)} × ${u.fmt(scene.height, 1)}`} size="sm" />
              <Readout label="Background blur" value={describeBlur(blur)} size="sm" sub={Number.isFinite(blur) ? `disc ${fmtNum(blur * 100, 1)}% of frame width` : undefined} />
            </div>
          </Blueprint>
          <TextAreaField label="Notes" value={comp.notes} onChange={(v) => update({ notes: v })} placeholder="Blocking, eyelines, what the shot needs to do." rows={3} />
        </div>

        <div className="stack">
          <Tabs
            value={panel}
            onChange={setPanel}
            label="Editor panels"
            tabs={[
              { id: 'elements', label: 'Figures' },
              { id: 'frame', label: 'Guides' },
              { id: 'camera', label: 'Camera' },
              { id: 'look', label: 'Look' },
            ]}
          />

          {panel === 'elements' && (
            <div className="stack">
              <Blueprint title="Add" index="A">
                <div className="cluster">
                  {SILHOUETTES.map((s) => (
                    <Button key={s.id} size="sm" variant="quiet" icon={<Plus size={14} />} onClick={() => addEl(s.id)}>
                      {s.label}
                    </Button>
                  ))}
                </div>
              </Blueprint>
              <Blueprint title="In frame" index="B" padding="none">
                <div className="elements-list">
                  {comp.elements.length === 0 && <p className="small muted" style={{ padding: 'var(--s-3)' }}>Nothing placed yet.</p>}
                  {comp.elements.map((e, i) => (
                    <button key={e.id} type="button" aria-pressed={e.id === selected} onClick={() => setSelected(e.id)}>
                      <span>
                        <span className="mono tiny muted" style={{ marginRight: 8 }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        {silhouette(e.kind).label}
                      </span>
                      <span className="mono tiny muted">{Math.round(e.scale * 100)}%</span>
                    </button>
                  ))}
                </div>
              </Blueprint>
              {sel && (
                <Blueprint
                  title={`Selected · ${silhouette(sel.kind).label}`}
                  index="C"
                  aside={
                    <Button size="sm" variant="ghost" iconOnly icon={<Trash2 size={14} />} onClick={() => removeEl(sel.id)}>
                      Remove
                    </Button>
                  }
                >
                  <div className="stack">
                    <Slider label="Size (of frame height)" value={Math.round(sel.scale * 100)} onChange={(v) => updateEl(sel.id, { scale: v / 100 })} min={5} max={600} unit="%" />
                    <Slider label="Horizontal" value={Math.round(sel.x * 100)} onChange={(v) => updateEl(sel.id, { x: v / 100 })} min={-50} max={150} unit="%" />
                    <Slider label="Baseline (feet)" value={Math.round(sel.y * 100)} onChange={(v) => updateEl(sel.id, { y: v / 100 })} min={0} max={300} unit="%" />
                    <div className="cluster">
                      <Button size="sm" variant="quiet" icon={<FlipHorizontal2 size={14} />} onClick={() => updateEl(sel.id, { flip: !sel.flip })} active={sel.flip}>
                        Flip
                      </Button>
                      <Button
                        size="sm"
                        variant="quiet"
                        onClick={() => {
                          const copy = { ...sel, id: uid(), x: sel.x + 0.12 };
                          update((c) => ({ elements: [...c.elements, copy] }));
                          setSelected(copy.id);
                        }}
                      >
                        Duplicate
                      </Button>
                    </div>
                  </div>
                </Blueprint>
              )}
            </div>
          )}

          {panel === 'frame' && (
            <div className="stack">
              <Blueprint title="Aspect ratio" index="A">
                <Segmented value={comp.aspect} onChange={(v) => update({ aspect: v })} options={ASPECTS.map((a) => ({ value: a.id, label: a.label }))} block mono scroll label="Aspect ratio" />
              </Blueprint>
              <Blueprint title="Guides" index="B">
                <div className="grid-2" style={{ gap: 0 }}>
                  {GUIDES.map((g) => (
                    <Check key={g.key} label={g.label} checked={comp.guides[g.key]} onChange={(v) => update((c) => ({ guides: { ...c.guides, [g.key]: v } }))} />
                  ))}
                </div>
              </Blueprint>
            </div>
          )}

          {panel === 'camera' && (
            <div className="stack">
              <Blueprint title="Angle" index="A">
                <SelectField label="Camera angle" value={comp.angle} onChange={(v) => update({ angle: v as Composition['angle'] })} options={CAMERA_ANGLES.map((a) => ({ value: a.id, label: a.label }))} />
              </Blueprint>
              <Blueprint title="Movement" index="B">
                <SelectField label="Camera movement" value={comp.movement} onChange={(v) => update({ movement: v as Composition['movement'] })} options={CAMERA_MOVES.map((m) => ({ value: m.id, label: m.label }))} />
              </Blueprint>
              <Blueprint title="Lens" index="C">
                <div className="stack">
                  <p className="tiny muted">Sensor comes from the project camera ({sensor.name}). Change it in any calculator.</p>
                  <Stepper label="Focal length" unit="mm" value={comp.focalLength} onChange={(v) => update({ focalLength: v })} min={4} max={1200} />
                  <Stepper label="Aperture" unit="f/" value={comp.aperture} onChange={(v) => update({ aperture: v })} min={0.7} max={64} snaps={STANDARD_APERTURES} decimals={1} />
                  <Stepper label="Subject distance" unit={u.unit} value={u.toDisplay(comp.subjectDistance)} onChange={(v) => update({ subjectDistance: u.fromDisplay(v) })} min={0.1} step={0.25} decimals={2} />
                  <div className="cluster">
                    <Button size="sm" variant="quiet" onClick={sizeFromLens}>
                      Size figures from lens
                    </Button>
                    <Button
                      size="sm"
                      variant="quiet"
                      onClick={() => {
                        const tallest = comp.elements.filter((e) => silhouette(e.kind).person).sort((a, b) => b.scale - a.scale)[0];
                        if (!tallest) return toast('Add a person first');
                        update({ subjectDistance: Math.round(distanceForSubject(comp.focalLength, sensor.height, 1.8, Math.min(6, tallest.scale)) * 100) / 100 });
                      }}
                    >
                      Distance from figure size
                    </Button>
                  </div>
                  <p className="tiny muted">
                    Vertical FOV {fmtDegrees(fov.vertical, 1)} · diagonal {fmtDegrees(fov.diagonal, 1)}.
                  </p>
                </div>
              </Blueprint>
            </div>
          )}

          {panel === 'look' && (
            <div className="stack">
              <Blueprint title="Palette" index="A">
                {project.palettes.length === 0 ? (
                  <p className="small muted">
                    No saved palettes yet. <Link to="/colour">Build one in the Colour Studio.</Link>
                  </p>
                ) : (
                  <div className="stack stack--sm">
                    <div className="frame-palette">
                      <button type="button" aria-pressed={!comp.paletteId} onClick={() => update({ paletteId: undefined })} aria-label="No palette" style={{ background: 'var(--bg)' }}>
                        <span className="tiny" style={{ display: 'grid', placeItems: 'center' }}>
                          None
                        </span>
                      </button>
                      {project.palettes.map((p) => (
                        <button key={p.id} type="button" aria-pressed={comp.paletteId === p.id} onClick={() => update({ paletteId: p.id })} aria-label={p.name}>
                          {p.swatches.map((s, i) => (
                            <span key={i} style={{ background: s.hex }} />
                          ))}
                        </button>
                      ))}
                    </div>
                    {palette && <p className="tiny muted">{palette.name}: darkest tone as the ground, mid tone for figures, full set along the bottom.</p>}
                  </div>
                )}
              </Blueprint>
              <Blueprint title="Reference image" index="B">
                <div className="stack">
                  <div className="cluster">
                    <Button size="sm" icon={<ImageIcon size={14} />} onClick={() => void chooseBackground()}>
                      {comp.backgroundImageId ? 'Replace image' : 'Add image'}
                    </Button>
                    {comp.backgroundImageId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<X size={14} />}
                        onClick={() => {
                                                update({ backgroundImageId: undefined });
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  {comp.backgroundImageId && <Slider label="Image opacity" value={Math.round(comp.backgroundOpacity * 100)} onChange={(v) => update({ backgroundOpacity: v / 100 })} min={5} max={100} unit="%" />}
                  <p className="tiny muted">Location scouts and reference stills stay on this device.</p>
                </div>
              </Blueprint>
              <Blueprint title="Name" index="C">
                <TextField label="Frame name" value={comp.name} onChange={(v) => update({ name: v })} />
              </Blueprint>
            </div>
          )}
        </div>
      </div>
      <span className="visually-hidden">{FRAME_W}</span>
    </main>
  );
}
