import { useState } from 'react';
import { Link } from 'react-router';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Copy, GripVertical, Image as ImageIcon, Plus, Trash2, Frame as FrameIcon, PenLine } from 'lucide-react';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Segmented } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import { SelectField, TextAreaField, TextField } from '@/components/Field';
import { Stepper } from '@/components/Stepper';
import { useProject, useProjects } from '@/store/projects';
import { storeImage, getImageUrl } from '@/store/images';
import { pickFile } from '@/lib/download';
import { uid } from '@/lib/id';
import { toast } from '@/store/toast';
import { ASPECTS, CAMERA_MOVES, SHOT_SIZES, aspectRatio, type StoryboardFrame, type AspectId } from '@/types/project';
import { FrameView } from './FrameView';
import { SketchCanvas } from './SketchCanvas';
import { CompositionSvg } from '@/modules/frame/CompositionSvg';
import { useEffect } from 'react';
import './storyboard.css';

function blankFrame(order: number, partial: Partial<StoryboardFrame> = {}): StoryboardFrame {
  return { id: uid(), order, source: 'blank', strokes: [], caption: '', dialogue: '', size: '', movement: '', lens: '', durationSec: 4, ...partial };
}

export default function Storyboard() {
  const project = useProject();
  const patch = useProjects((s) => s.patchCurrent);
  const frames = project.storyboard.slice().sort((a, b) => a.order - b.order);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const aspect = project.storyboardAspect;
  const total = frames.reduce((s, f) => s + (f.durationSec || 0), 0);

  function commit(next: StoryboardFrame[]) {
    patch({ storyboard: next.map((f, i) => ({ ...f, order: i + 1 })) });
  }
  function add(partial: Partial<StoryboardFrame> = {}) {
    const f = blankFrame(frames.length + 1, partial);
    commit([...frames, f]);
    setAdding(false);
    setEditing(f.id);
  }
  async function addImage() {
    const file = await pickFile('image/*');
    if (!file) return;
    const imageId = await storeImage(file);
    add({ source: 'image', imageId, caption: file.name.replace(/\.[^.]+$/, '') });
  }
  function update(f: StoryboardFrame) {
    patch((p) => ({ storyboard: p.storyboard.map((x) => (x.id === f.id ? f : x)) }));
  }
  function remove(id: string) {
    commit(frames.filter((x) => x.id !== id));
    setEditing(null);
    toast('Frame removed');
  }
  function duplicate(id: string) {
    const i = frames.findIndex((x) => x.id === id);
    if (i < 0) return;
    const copy = { ...structuredClone(frames[i]), id: uid() };
    const next = frames.slice();
    next.splice(i + 1, 0, copy);
    commit(next);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = frames.findIndex((f) => f.id === active.id);
    const to = frames.findIndex((f) => f.id === over.id);
    commit(arrayMove(frames, from, to));
  }

  const editingFrame = frames.find((f) => f.id === editing) ?? null;

  return (
    <main className="page page--wide">
      <PageHead
        index="07 · Board"
        title="Storyboard"
        sub={frames.length ? `${frames.length} frames · about ${Math.round(total)} s` : 'Frames from compositions, images or sketches.'}
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>
            Add frame
          </Button>
        }
      />
      <div className="stack">
        <div className="cluster" style={{ justifyContent: 'space-between' }}>
          <Segmented value={aspect} onChange={(v) => patch({ storyboardAspect: v as AspectId })} options={ASPECTS.map((a) => ({ value: a.id, label: a.label }))} mono scroll size="sm" label="Storyboard aspect ratio" />
          <span className="tiny muted">Drag the handle to reorder. Tap a frame to edit.</span>
        </div>

        {frames.length === 0 ? (
          <EmptyState title="The board is empty" body="Add a frame from a Shot Designer composition, upload a reference image, or sketch one with the pen tool." action={<Button onClick={() => setAdding(true)}>Add the first frame</Button>} />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={frames.map((f) => f.id)} strategy={rectSortingStrategy}>
              <div className="board-grid">
                {frames.map((f, i) => (
                  <BoardCard key={f.id} frame={f} index={i} aspect={aspect} project={project} onOpen={() => setEditing(f.id)} onDuplicate={() => duplicate(f.id)} onRemove={() => remove(f.id)} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add a frame">
        <div className="stack">
          <div className="board-add">
            <button type="button" className="preset-card" onClick={() => add({ source: 'drawing' })}>
              <PenLine size={18} />
              <strong>Sketch</strong>
              <span>Blank frame with the pen tool.</span>
            </button>
            <button type="button" className="preset-card" onClick={() => void addImage()}>
              <ImageIcon size={18} />
              <strong>Image</strong>
              <span>Reference photo or still from this device.</span>
            </button>
          </div>
          {project.compositions.length > 0 ? (
            <div className="stack stack--sm">
              <span className="micro">From a composition</span>
              <div className="frame-cards">
                {project.compositions.map((c) => (
                  <button key={c.id} type="button" className="bp frame-card" style={{ padding: 'var(--s-2)' }} onClick={() => add({ source: 'composition', compositionId: c.id, caption: c.name, movement: c.movement, lens: `${c.focalLength} mm` })}>
                    <CompositionSvg comp={{ ...c, aspect }} palette={project.palettes.find((p) => p.id === c.paletteId) ?? null} showLabels={false} />
                    <span className="small" style={{ fontWeight: 500 }}>
                      {c.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="tiny muted">
              Compositions from the <Link to="/frame">Shot Designer</Link> will appear here too.
            </p>
          )}
        </div>
      </Sheet>

      {editingFrame && <FrameEditor frame={editingFrame} aspect={aspect} onChange={update} onClose={() => setEditing(null)} onRemove={() => remove(editingFrame.id)} />}
    </main>
  );
}

function BoardCard({ frame, index, aspect, project, onOpen, onDuplicate, onRemove }: { frame: StoryboardFrame; index: number; aspect: AspectId; project: ReturnType<typeof useProject>; onOpen: () => void; onDuplicate: () => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: frame.id });
  const shot = project.shots.find((s) => s.id === frame.shotId);
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }} className="board-card">
      <div className="board-card__head">
        <span>
          {String(index + 1).padStart(2, '0')}
          {shot ? ` · shot ${shot.scene}${shot.shotNumber}` : ''}
        </span>
        <span className="cluster" style={{ gap: 2 }}>
          <Button size="sm" variant="ghost" iconOnly icon={<Copy size={14} />} onClick={onDuplicate}>
            Duplicate frame
          </Button>
          <Button size="sm" variant="ghost" iconOnly icon={<Trash2 size={14} />} onClick={onRemove}>
            Remove frame
          </Button>
          <button type="button" className="drag-handle" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Reorder frame ${index + 1}`}>
            <GripVertical size={16} />
          </button>
        </span>
      </div>
      <button type="button" className="board-card__frame" onClick={onOpen} aria-label={`Edit frame ${index + 1}`}>
        <FrameView frame={frame} aspect={aspect} compositions={project.compositions} palettes={project.palettes} />
      </button>
      <button type="button" className="board-card__body" onClick={onOpen}>
        <span className="board-card__caption">{frame.caption || 'Untitled frame'}</span>
        {frame.dialogue && <span className="board-card__dialogue">“{frame.dialogue}”</span>}
        <span className="board-card__meta">
          {frame.size && <span>{frame.size}</span>}
          {frame.movement && <span>{CAMERA_MOVES.find((m) => m.id === frame.movement)?.label}</span>}
          {frame.lens && <span>{frame.lens}</span>}
          <span>{frame.durationSec} s</span>
        </span>
      </button>
    </div>
  );
}

function FrameEditor({ frame, aspect, onChange, onClose, onRemove }: { frame: StoryboardFrame; aspect: AspectId; onChange: (f: StoryboardFrame) => void; onClose: () => void; onRemove: () => void }) {
  const project = useProject();
  const set = (d: Partial<StoryboardFrame>) => onChange({ ...frame, ...d });
  const ratio = aspectRatio(aspect);
  const comp = frame.source === 'composition' ? project.compositions.find((c) => c.id === frame.compositionId) : undefined;
  const [img, setImg] = useState<{ id: string; url: string | null } | null>(null);
  const imgUrl = img && img.id === frame.imageId ? img.url : null;
  useEffect(() => {
    let alive = true;
    const id = frame.imageId;
    if (id) void getImageUrl(id).then((url) => alive && setImg({ id, url }));
    return () => {
      alive = false;
    };
  }, [frame.imageId]);

  async function replaceImage() {
    const file = await pickFile('image/*');
    if (!file) return;
    const imageId = await storeImage(file);
    set({ source: 'image', imageId });
  }

  const background = (
    <>
      {comp && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <CompositionSvg comp={{ ...comp, aspect }} palette={project.palettes.find((p) => p.id === comp.paletteId) ?? null} showLabels={false} />
        </div>
      )}
      {frame.source === 'image' && imgUrl && <img src={imgUrl} alt="" className="frame-view__img" />}
    </>
  );

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Frame ${frame.order}`}
      wide
      footer={
        <>
          <Button variant="danger" onClick={onRemove}>
            Remove
          </Button>
          <span style={{ flex: 1 }} />
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <div className="stack">
        <SketchCanvas strokes={frame.strokes} onChange={(strokes) => set({ strokes })} ratio={ratio} background={background} />
        <div className="cluster">
          <Button size="sm" variant="quiet" icon={<ImageIcon size={14} />} onClick={() => void replaceImage()}>
            {frame.source === 'image' ? 'Replace image' : 'Use an image'}
          </Button>
          {project.compositions.length > 0 && (
            <SelectField
              label="Composition"
              value={frame.source === 'composition' ? (frame.compositionId ?? '') : ''}
              onChange={(v) => (v ? set({ source: 'composition', compositionId: v }) : set({ source: frame.imageId ? 'image' : 'drawing', compositionId: undefined }))}
              options={[{ value: '', label: 'None' }, ...project.compositions.map((c) => ({ value: c.id, label: c.name }))]}
            />
          )}
          {comp && (
            <Link to={`/frame/${comp.id}`} className="btn btn--sm btn--ghost">
              <FrameIcon size={14} /> Open composition
            </Link>
          )}
        </div>
        <TextField label="Caption" value={frame.caption} onChange={(v) => set({ caption: v })} placeholder="What we see" />
        <TextAreaField label="Dialogue" value={frame.dialogue} onChange={(v) => set({ dialogue: v })} rows={2} placeholder="What we hear" />
        <div className="grid-3">
          <SelectField label="Shot size" value={frame.size} onChange={(v) => set({ size: v as StoryboardFrame['size'] })} options={[{ value: '', label: '—' }, ...SHOT_SIZES.map((s) => ({ value: s.id, label: s.id }))]} />
          <SelectField label="Movement" value={frame.movement} onChange={(v) => set({ movement: v as StoryboardFrame['movement'] })} options={[{ value: '', label: '—' }, ...CAMERA_MOVES.map((m) => ({ value: m.id, label: m.label }))]} />
          <TextField label="Lens" value={frame.lens} onChange={(v) => set({ lens: v })} placeholder="35 mm" mono />
        </div>
        <div className="grid-2">
          <Stepper label="Duration" unit="s" value={frame.durationSec} onChange={(v) => set({ durationSec: v })} min={0.5} max={600} step={0.5} decimals={1} />
          <SelectField label="Linked shot" value={frame.shotId ?? ''} onChange={(v) => set({ shotId: v || undefined })} options={[{ value: '', label: 'None' }, ...project.shots.slice().sort((a, b) => a.order - b.order).map((s) => ({ value: s.id, label: `${s.scene}${s.shotNumber} ${s.description}`.trim() }))]} />
        </div>
      </div>
    </Sheet>
  );
}
