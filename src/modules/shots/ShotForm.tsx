import { Link } from 'react-router';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/Button';
import { SelectField, TextAreaField, TextField } from '@/components/Field';
import { Stepper } from '@/components/Stepper';
import { useProject } from '@/store/projects';
import { CAMERA_ANGLES, CAMERA_MOVES, SHOT_SIZES, type Shot, type ShotStatus } from '@/types/project';
import { STATUS_LABEL } from './status';

interface Props {
  shot: Shot | null;
  onChange: (s: Shot) => void;
  onClose: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function ShotForm({ shot, onChange, onClose, onDelete, onDuplicate }: Props) {
  const project = useProject();
  if (!shot) return null;
  const set = (d: Partial<Shot>) => onChange({ ...shot, ...d });
  const comp = project.compositions.find((c) => c.id === shot.compositionId);
  const diagram = project.diagrams.find((d) => d.id === shot.diagramId);
  const palette = project.palettes.find((p) => p.id === shot.paletteId);
  return (
    <Sheet
      open
      onClose={onClose}
      title={`Shot ${shot.scene}${shot.shotNumber}`}
      wide
      footer={
        <>
          <Button variant="danger" onClick={onDelete}>
            Delete
          </Button>
          <Button variant="quiet" onClick={onDuplicate}>
            Duplicate
          </Button>
          <span style={{ flex: 1 }} />
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="grid-3">
          <Stepper label="Scene" value={shot.scene} onChange={(v) => set({ scene: Math.max(1, Math.round(v)) })} min={1} />
          <TextField label="Shot" value={shot.shotNumber} onChange={(v) => set({ shotNumber: v.toUpperCase() })} mono maxLength={4} />
          <SelectField label="Status" value={shot.status} onChange={(v) => set({ status: v as ShotStatus })} options={(Object.keys(STATUS_LABEL) as ShotStatus[]).map((k) => ({ value: k, label: STATUS_LABEL[k] }))} />
        </div>
        <TextField label="Description" value={shot.description} onChange={(v) => set({ description: v })} placeholder="What happens in the shot" />
        <div className="grid-3">
          <SelectField label="Size" value={shot.size} onChange={(v) => set({ size: v as Shot['size'] })} options={[{ value: '', label: '—' }, ...SHOT_SIZES.map((s) => ({ value: s.id, label: `${s.id} · ${s.label}` }))]} />
          <SelectField label="Angle" value={shot.angle} onChange={(v) => set({ angle: v as Shot['angle'] })} options={[{ value: '', label: '—' }, ...CAMERA_ANGLES.map((a) => ({ value: a.id, label: a.label }))]} />
          <SelectField label="Movement" value={shot.movement} onChange={(v) => set({ movement: v as Shot['movement'] })} options={[{ value: '', label: '—' }, ...CAMERA_MOVES.map((m) => ({ value: m.id, label: m.label }))]} />
        </div>
        <div className="grid-3">
          <TextField label="Lens" value={shot.lens} onChange={(v) => set({ lens: v })} placeholder="35 mm" mono />
          <TextField label="Aperture" value={shot.aperture} onChange={(v) => set({ aperture: v })} placeholder="f/2.8" mono />
          <TextField label="Frame rate" value={shot.fps} onChange={(v) => set({ fps: v })} placeholder="24" mono />
        </div>
        <TextField label="Location" value={shot.location} onChange={(v) => set({ location: v })} />
        <TextAreaField label="Equipment" value={shot.equipment} onChange={(v) => set({ equipment: v })} rows={2} placeholder="Tripod, slider, key light, lav mic" />
        <div className="stack stack--sm">
          <span className="micro">Attached</span>
          <div className="cluster">
            {comp ? (
              <Link to={`/frame/${comp.id}`} className="tag tag--wash">
                Frame · {comp.name}
              </Link>
            ) : (
              <span className="tag">No frame</span>
            )}
            {diagram ? (
              <Link to={`/plan/${diagram.id}`} className="tag tag--wash">
                Plan · {diagram.name}
              </Link>
            ) : (
              <span className="tag">No diagram</span>
            )}
            <SelectField label="Palette" value={shot.paletteId ?? ''} onChange={(v) => set({ paletteId: v || undefined })} options={[{ value: '', label: 'None' }, ...project.palettes.map((p) => ({ value: p.id, label: p.name }))]} />
            {palette && (
              <span className="cluster" style={{ gap: 2 }}>
                {palette.swatches.map((s, i) => (
                  <span key={i} style={{ width: 16, height: 16, background: s.hex, border: '1px solid var(--hair-strong)' }} />
                ))}
              </span>
            )}
          </div>
          <p className="tiny muted">Attach a frame from the Shot Designer or a diagram from the Lighting tool with their “send” and “attach” buttons.</p>
        </div>
      </div>
    </Sheet>
  );
}
