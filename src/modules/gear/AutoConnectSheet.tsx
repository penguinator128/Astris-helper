import { useMemo, useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/Button';
import { Check } from '@/components/Field';
import { useProject, useProjects } from '@/store/projects';
import { toast } from '@/store/toast';
import { proposeConnections } from '@/lib/gear/autoconnect';
import type { Connection } from '@/types/project';

/** Shows every connection Auto Connect would make. Nothing changes until you approve. */
export function AutoConnectSheet({ open, onClose, cameraId }: { open: boolean; onClose: () => void; cameraId?: string }) {
  const project = useProject();
  const patch = useProjects((s) => s.patchCurrent);
  const proposals = useMemo(() => (open ? proposeConnections(project.gear, project.connections, cameraId) : []), [open, project.gear, project.connections, cameraId]);
  // Everything starts ticked; this holds the ones you untick.
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const picked = new Set(proposals.filter((p) => !skipped.has(p.id)).map((p) => p.id));
  const setPicked = (next: Set<string> | ((s: Set<string>) => Set<string>)) => {
    const n = typeof next === 'function' ? next(picked) : next;
    setSkipped(new Set(proposals.filter((p) => !n.has(p.id)).map((p) => p.id)));
  };
  const byId = (id: string) => project.gear.find((g) => g.id === id);
  const portName = (gid: string, pid: string) => byId(gid)?.ports.find((p) => p.id === pid)?.name ?? '?';

  function apply(ids: Set<string>) {
    const add: Connection[] = proposals.filter((p) => ids.has(p.id)).map((p) => ({ id: p.id, fromGear: p.fromGear, fromPort: p.fromPort, toGear: p.toGear, toPort: p.toPort, notes: p.cable ? `Auto: ${p.cable}` : 'Auto' }));
    if (!add.length) return onClose();
    patch((pr) => ({ connections: [...pr.connections, ...add] }));
    toast(`Made ${add.length} connection${add.length === 1 ? '' : 's'}`);
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Auto Connect"
      wide
      footer={
        proposals.length > 0 && (
          <div className="cluster">
            <Button variant="quiet" onClick={onClose}>Cancel</Button>
            <Button onClick={() => apply(picked)} disabled={!picked.size}>Approve selected ({picked.size})</Button>
            <Button variant="primary" onClick={() => apply(new Set(proposals.map((p) => p.id)))}>Approve all</Button>
          </div>
        )
      }
    >
      {proposals.length === 0 ? (
        <p className="muted">Nothing left to connect. Every compatible port is already in use, or the remaining items need an adapter or cable you have not added.</p>
      ) : (
        <div className="stack stack--sm">
          <p className="muted">These links only join ports that genuinely fit: matching mounts, voltages, phantom power and signal type. Untick any you do not want.</p>
          <div className="cluster">
            <Button size="sm" variant="quiet" onClick={() => setPicked(new Set(proposals.map((p) => p.id)))}>Select all</Button>
            <Button size="sm" variant="quiet" onClick={() => setPicked(new Set())}>Select none</Button>
          </div>
          <ul className="rows" aria-label="Proposed connections">
            {proposals.map((p) => (
              <li key={p.id} className="ac-row">
                <Check
                  checked={picked.has(p.id)}
                  onChange={(v) => setPicked((s) => { const n = new Set(s); if (v) n.add(p.id); else n.delete(p.id); return n; })}
                  label={
                    <span className="ac-label">
                      <span>
                        <strong>{byId(p.fromGear)?.name}</strong> <span className="mono muted">{portName(p.fromGear, p.fromPort)}</span> → <strong>{byId(p.toGear)?.name}</strong> <span className="mono muted">{portName(p.toGear, p.toPort)}</span>
                      </span>
                      <span className="micro">{p.reason}{p.cable ? ` · needs ${p.cable}` : ''}</span>
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
