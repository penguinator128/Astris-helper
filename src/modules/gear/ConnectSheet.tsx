import { useState } from 'react';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { SelectField, TextField } from '@/components/Field';
import { useProject, useProjects } from '@/store/projects';
import { cableFor } from '@/lib/gear/catalog';
import { uid } from '@/lib/id';
import { toast } from '@/store/toast';

interface Props {
  open: boolean;
  onClose: () => void;
  fromGear?: string;
  toGear?: string;
}

/** Pick an output and an input; the cable is worked out from the two connectors. */
export function ConnectSheet({ open, onClose, fromGear, toGear }: Props) {
  const project = useProject();
  const patch = useProjects((s) => s.patchCurrent);
  const sources = project.gear.filter((g) => g.ports.some((p) => p.dir === 'out'));
  const sinks = project.gear.filter((g) => g.ports.some((p) => p.dir === 'in'));
  const [from, setFrom] = useState(fromGear ?? sources[0]?.id ?? '');
  const [fromPort, setFromPort] = useState('');
  const [to, setTo] = useState(toGear ?? '');
  const [toPort, setToPort] = useState('');
  const [notes, setNotes] = useState('');

  const fromItem = project.gear.find((g) => g.id === from);
  const outPorts = fromItem?.ports.filter((p) => p.dir === 'out') ?? [];
  const fp = outPorts.find((p) => p.id === fromPort) ?? outPorts[0];
  const taken = new Set(project.connections.map((c) => `${c.toGear}:${c.toPort}`));
  const targets = sinks.filter((g) => g.id !== from);
  const toItem = project.gear.find((g) => g.id === to) ?? targets[0];
  const inPorts = toItem?.ports.filter((p) => p.dir === 'in') ?? [];
  // Prefer a free input carrying the same signal.
  const suggested = inPorts.find((p) => p.signal === fp?.signal && !taken.has(`${toItem?.id}:${p.id}`)) ?? inPorts[0];
  const tp = inPorts.find((p) => p.id === toPort) ?? suggested;
  const cable = fp && tp ? cableFor(fp.connector, tp.connector) : null;

  function save() {
    if (!fromItem || !fp || !toItem || !tp) return;
    patch((p) => ({ connections: [...p.connections, { id: uid(), fromGear: fromItem.id, fromPort: fp.id, toGear: toItem.id, toPort: tp.id, notes }] }));
    toast(`${fromItem.name} to ${toItem.name}${cable ? ` · ${cable}` : ''}`);
    setNotes('');
    setFromPort('');
    setToPort('');
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Connect"
      footer={
        <Button variant="primary" block onClick={save} disabled={!fp || !tp}>
          Add connection
        </Button>
      }
    >
      {sources.length === 0 || sinks.length < 1 ? (
        <p className="small muted">Add gear with outputs and inputs first, for example a mic and a recorder or camera.</p>
      ) : (
        <div className="stack">
          <div className="grid-2">
            <SelectField label="From" value={fromItem?.id ?? ''} onChange={(v) => { setFrom(v); setFromPort(''); }} options={sources.map((g) => ({ value: g.id, label: g.name }))} />
            <SelectField label="Output" value={fp?.id ?? ''} onChange={setFromPort} options={outPorts.map((p) => ({ value: p.id, label: `${p.name} · ${p.connector}` }))} />
          </div>
          <div className="grid-2">
            <SelectField label="To" value={toItem?.id ?? ''} onChange={(v) => { setTo(v); setToPort(''); }} options={targets.map((g) => ({ value: g.id, label: g.name }))} />
            <SelectField label="Input" value={tp?.id ?? ''} onChange={setToPort} options={inPorts.map((p) => ({ value: p.id, label: `${p.name} · ${p.connector}${taken.has(`${toItem?.id}:${p.id}`) ? ' (in use)' : ''}` }))} />
          </div>
          <div className="bp bp--bone" style={{ padding: 'var(--s-3)' }}>
            <span className="micro">Cable</span>
            <div className="mono" style={{ marginTop: 4 }}>{fp && tp ? cable ?? 'None needed (wireless or shoe mount)' : '—'}</div>
            {fp && tp && fp.signal !== tp.signal && <div className="tiny muted" style={{ marginTop: 4 }}>Heads up: {fp.signal} output into a {tp.signal} input.</div>}
          </div>
          <TextField label="Note" value={notes} onChange={setNotes} placeholder="e.g. channel 1, pad -10 dB" />
        </div>
      )}
    </Sheet>
  );
}
