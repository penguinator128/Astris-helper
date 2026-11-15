import { useMemo, useState } from 'react';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Download, GripVertical, Plus, Hash } from 'lucide-react';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { SelectField, TextField } from '@/components/Field';
import { useProject, useProjects } from '@/store/projects';
import { createShot, nextShotNumber } from '@/store/actions';
import { useMedia } from '@/lib/useMedia';
import { toCsv } from '@/lib/csv';
import { downloadBlob, safeFilename } from '@/lib/download';
import { uid } from '@/lib/id';
import { toast } from '@/store/toast';
import { CAMERA_ANGLES, CAMERA_MOVES, type Shot, type ShotStatus } from '@/types/project';
import { ShotForm } from './ShotForm';
import { STATUS_LABEL } from './status';
import './shots.css';

type SortKey = 'order' | 'scene' | 'status' | 'size';

const moveLabel = (id: string) => CAMERA_MOVES.find((m) => m.id === id)?.label ?? '';
const angleLabel = (id: string) => CAMERA_ANGLES.find((a) => a.id === id)?.label ?? '';

export default function ShotList() {
  const project = useProject();
  const patch = useProjects((s) => s.patchCurrent);
  const desktop = useMedia('(min-width: 900px)');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | ShotStatus>('all');
  const [scene, setScene] = useState<'all' | string>('all');
  const [sort, setSort] = useState<SortKey>('order');
  const [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const shots = project.shots;
  const scenes = useMemo(() => Array.from(new Set(shots.map((s) => s.scene))).sort((a, b) => a - b), [shots]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = shots.filter((s) => (status === 'all' || s.status === status) && (scene === 'all' || s.scene === Number(scene)) && (!q || [s.description, s.location, s.equipment, s.lens, `${s.scene}${s.shotNumber}`].join(' ').toLowerCase().includes(q)));
    const sizeOrder = ['EWS', 'WS', 'MWS', 'MS', 'MCU', 'CU', 'ECU'];
    const statusOrder: ShotStatus[] = ['planned', 'pickup', 'shot'];
    list = list.slice().sort((a, b) => {
      if (sort === 'scene') return a.scene - b.scene || a.shotNumber.localeCompare(b.shotNumber) || a.order - b.order;
      if (sort === 'status') return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status) || a.order - b.order;
      if (sort === 'size') return sizeOrder.indexOf(a.size) - sizeOrder.indexOf(b.size) || a.order - b.order;
      return a.order - b.order;
    });
    return list;
  }, [shots, query, status, scene, sort]);

  const canReorder = sort === 'order' && status === 'all' && scene === 'all' && !query;

  function update(shot: Shot) {
    patch((p) => ({ shots: p.shots.map((s) => (s.id === shot.id ? shot : s)) }));
  }
  function add() {
    const shot = createShot(project);
    patch((p) => ({ shots: [...p.shots, shot] }));
    setEditing(shot.id);
  }
  function remove(id: string) {
    patch((p) => ({ shots: p.shots.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i + 1 })) }));
    setEditing(null);
    toast('Shot deleted');
  }
  function duplicate(id: string) {
    const src = shots.find((s) => s.id === id);
    if (!src) return;
    const copy: Shot = { ...src, id: uid(), shotNumber: nextShotNumber(project, src.scene), status: 'planned', order: src.order + 0.5 };
    patch((p) => ({ shots: [...p.shots, copy].sort((a, b) => a.order - b.order).map((s, i) => ({ ...s, order: i + 1 })) }));
    setEditing(copy.id);
  }
  function renumber() {
    const sorted = shots.slice().sort((a, b) => a.order - b.order);
    const counters = new Map<number, number>();
    const next = sorted.map((s) => {
      const n = counters.get(s.scene) ?? 0;
      counters.set(s.scene, n + 1);
      return { ...s, shotNumber: String.fromCharCode(65 + (n % 26)) + (n >= 26 ? Math.floor(n / 26) + 1 : '') };
    });
    patch({ shots: next });
    toast('Shots renumbered in list order');
  }
  function bulkStatus(st: ShotStatus) {
    patch((p) => ({ shots: p.shots.map((s) => (selected.has(s.id) ? { ...s, status: st } : s)) }));
    setSelected(new Set());
    toast(`${selected.size} shot${selected.size === 1 ? '' : 's'} marked ${STATUS_LABEL[st].toLowerCase()}`);
  }
  function exportCsv() {
    const rows: (string | number)[][] = [['Scene', 'Shot', 'Size', 'Angle', 'Movement', 'Lens', 'Aperture', 'FPS', 'Location', 'Description', 'Equipment', 'Status']];
    for (const s of shots.slice().sort((a, b) => a.order - b.order)) rows.push([s.scene, s.shotNumber, s.size, angleLabel(s.angle), moveLabel(s.movement), s.lens, s.aperture, s.fps, s.location, s.description, s.equipment, STATUS_LABEL[s.status]]);
    downloadBlob(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }), `${safeFilename(project.name)}-shot-list.csv`);
    toast('CSV exported');
  }
  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ordered = shots.slice().sort((a, b) => a.order - b.order);
    const from = ordered.findIndex((s) => s.id === active.id);
    const to = ordered.findIndex((s) => s.id === over.id);
    const moved = arrayMove(ordered, from, to).map((s, i) => ({ ...s, order: i + 1 }));
    patch({ shots: moved });
  }

  const editingShot = shots.find((s) => s.id === editing) ?? null;
  const done = shots.filter((s) => s.status === 'shot').length;

  return (
    <main className="page page--wide">
      <PageHead
        index="06 · Shots"
        title="Shot List"
        sub={shots.length ? `${shots.length} shots · ${done} shot · ${shots.length - done} to go` : 'Scenes and shots for this project.'}
        actions={
          <>
            <Button variant="quiet" size="sm" icon={<Download size={14} />} onClick={exportCsv} disabled={shots.length === 0}>
              CSV
            </Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={add}>
              Add shot
            </Button>
          </>
        }
      />

      {shots.length === 0 ? (
        <EmptyState title="No shots yet" body="Add the first shot, or send a frame here from the Shot Designer. Shots are numbered automatically within each scene." action={<Button onClick={add}>Add the first shot</Button>} />
      ) : (
        <div className="stack">
          <div className="shots-controls">
            <TextField label="Search" value={query} onChange={setQuery} placeholder="Description, location, lens…" />
            <SelectField label="Status" value={status} onChange={(v) => setStatus(v as typeof status)} options={[{ value: 'all', label: 'All' }, ...(Object.keys(STATUS_LABEL) as ShotStatus[]).map((k) => ({ value: k, label: STATUS_LABEL[k] }))]} />
            <SelectField label="Scene" value={scene} onChange={setScene} options={[{ value: 'all', label: 'All scenes' }, ...scenes.map((s) => ({ value: String(s), label: `Scene ${s}` }))]} />
            <SelectField label="Sort" value={sort} onChange={(v) => setSort(v as SortKey)} options={[{ value: 'order', label: 'List order' }, { value: 'scene', label: 'Scene and shot' }, { value: 'status', label: 'Status' }, { value: 'size', label: 'Shot size' }]} />
          </div>
          <div className="cluster" style={{ justifyContent: 'space-between' }}>
            <span className="tiny muted">{canReorder ? 'Drag the handle to reorder.' : 'Clear filters and sort by list order to reorder.'}</span>
            <Button size="sm" variant="ghost" icon={<Hash size={14} />} onClick={renumber}>
              Renumber
            </Button>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={visible.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {desktop ? (
                <div className="table-wrap">
                  <table className="table shots-table">
                    <thead>
                      <tr>
                        <th style={{ width: 28 }} />
                        <th style={{ width: 28 }}>
                          <span className="visually-hidden">Select</span>
                        </th>
                        <th>Shot</th>
                        <th>Size</th>
                        <th>Angle</th>
                        <th>Move</th>
                        <th>Lens</th>
                        <th>f/</th>
                        <th>fps</th>
                        <th>Location</th>
                        <th>Description</th>
                        <th>Equipment</th>
                        <th>Links</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((s) => (
                        <Row key={s.id} shot={s} project={project} selected={selected.has(s.id)} onToggle={() => toggle(s.id)} onOpen={() => setEditing(s.id)} onStatus={(st) => update({ ...s, status: st })} canReorder={canReorder} />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="shot-cards">
                  {visible.map((s) => (
                    <Card key={s.id} shot={s} selected={selected.has(s.id)} onToggle={() => toggle(s.id)} onOpen={() => setEditing(s.id)} onStatus={(st) => update({ ...s, status: st })} canReorder={canReorder} />
                  ))}
                </div>
              )}
            </SortableContext>
          </DndContext>
          {visible.length === 0 && <p className="small muted">No shots match these filters.</p>}

          {selected.size > 0 && (
            <div className="bulk-bar" role="region" aria-label="Bulk actions">
              <span className="mono tiny">{selected.size} selected</span>
              {(Object.keys(STATUS_LABEL) as ShotStatus[]).map((k) => (
                <Button key={k} size="sm" onClick={() => bulkStatus(k)}>
                  Mark {STATUS_LABEL[k].toLowerCase()}
                </Button>
              ))}
              <Button size="sm" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </div>
          )}
        </div>
      )}

      {editingShot && <ShotForm shot={editingShot} onChange={update} onClose={() => setEditing(null)} onDelete={() => remove(editingShot.id)} onDuplicate={() => duplicate(editingShot.id)} />}
    </main>
  );
}

function StatusSelect({ value, onChange }: { value: ShotStatus; onChange: (s: ShotStatus) => void }) {
  return (
    <select className={`select status-select status-select--${value}`} value={value} onChange={(e) => onChange(e.target.value as ShotStatus)} aria-label="Status" onClick={(e) => e.stopPropagation()}>
      {(Object.keys(STATUS_LABEL) as ShotStatus[]).map((k) => (
        <option key={k} value={k}>
          {STATUS_LABEL[k]}
        </option>
      ))}
    </select>
  );
}

function Links({ shot }: { shot: Shot }) {
  return (
    <span className="link-tags">
      {shot.compositionId && (
        <a href={`/frame/${shot.compositionId}`} className="tag tag--wash" onClick={(e) => e.stopPropagation()}>
          Frame
        </a>
      )}
      {shot.diagramId && (
        <a href={`/light/${shot.diagramId}`} className="tag tag--wash" onClick={(e) => e.stopPropagation()}>
          Light
        </a>
      )}
      {shot.paletteId && <span className="tag">Palette</span>}
    </span>
  );
}

interface RowProps {
  shot: Shot;
  project: ReturnType<typeof useProject>;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onStatus: (s: ShotStatus) => void;
  canReorder: boolean;
}

function Row({ shot, selected, onToggle, onOpen, onStatus, canReorder }: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: shot.id, disabled: !canReorder });
  return (
    <tr ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, cursor: 'pointer' }} className={`${isDragging ? 'is-dragging' : ''} ${selected ? 'is-selected' : ''}`} onClick={onOpen}>
      <td onClick={(e) => e.stopPropagation()}>
        <button type="button" className="drag-handle" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Reorder shot ${shot.scene}${shot.shotNumber}`} disabled={!canReorder}>
          <GripVertical size={16} />
        </button>
      </td>
      <td onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select shot ${shot.scene}${shot.shotNumber}`} />
      </td>
      <td className="mono" style={{ fontWeight: 500 }}>
        {shot.scene}
        {shot.shotNumber}
      </td>
      <td className="mono">{shot.size}</td>
      <td>{angleLabel(shot.angle)}</td>
      <td>{moveLabel(shot.movement)}</td>
      <td className="mono">{shot.lens}</td>
      <td className="mono">{shot.aperture}</td>
      <td className="mono">{shot.fps}</td>
      <td>{shot.location}</td>
      <td className="wrap">{shot.description}</td>
      <td className="wrap">{shot.equipment}</td>
      <td>
        <Links shot={shot} />
      </td>
      <td>
        <StatusSelect value={shot.status} onChange={onStatus} />
      </td>
    </tr>
  );
}

function Card({ shot, selected, onToggle, onOpen, onStatus, canReorder }: Omit<RowProps, 'project'>) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: shot.id, disabled: !canReorder });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }} className={`shot-card ${selected ? 'is-selected' : ''}`}>
      <button type="button" className="drag-handle" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Reorder shot ${shot.scene}${shot.shotNumber}`} disabled={!canReorder}>
        <GripVertical size={16} />
      </button>
      <button type="button" className="shot-card__num" onClick={onOpen}>
        <span className="visually-hidden">Edit shot </span>
        {shot.scene}
        {shot.shotNumber}
        <small>{shot.size || '—'}</small>
      </button>
      <div className="shot-card__body">
        <button type="button" onClick={onOpen} style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="shot-card__desc">{shot.description || 'Untitled shot'}</span>
        <span className="shot-card__meta">
          {shot.angle && <span>{angleLabel(shot.angle)}</span>}
          {shot.movement && <span>{moveLabel(shot.movement)}</span>}
          {shot.lens && <span>{shot.lens}</span>}
          {shot.aperture && <span>{shot.aperture}</span>}
          {shot.fps && <span>{shot.fps} fps</span>}
          {shot.location && <span>{shot.location}</span>}
        </span>
        </button>
        <Links shot={shot} />
      </div>
      <div className="stack stack--sm" style={{ alignItems: 'flex-end' }}>
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select shot ${shot.scene}${shot.shotNumber}`} />
        <StatusSelect value={shot.status} onChange={onStatus} />
      </div>
    </div>
  );
}
