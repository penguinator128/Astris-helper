import { useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/Button';
import { TextField } from '@/components/Field';
import { useProject, useProjects } from '@/store/projects';
import { useLibrary, liveRigs } from '@/store/library';
import { toast } from '@/store/toast';
import { captureRig } from '@/lib/gear/rigs';
import { cameraConfig } from '@/lib/camera/settings';
import type { GearItem } from '@/types/project';

/** Save a camera with everything on it, to reuse in any plan (and on any device once signed in). */
export function SaveRigSheet({ cam, onClose }: { cam: GearItem; onClose: () => void }) {
  const project = useProject();
  const patch = useProjects((s) => s.patchCurrent);
  const library = useLibrary();
  const saveRig = useLibrary((s) => s.saveRig);
  const linked = liveRigs(library).find((r) => r.id === cam.savedRigId);
  const [name, setName] = useState(linked?.name ?? `${cameraConfig(cam).model} rig`);
  const captured = captureRig(cam.id, project.gear, project.connections);
  const [busy, setBusy] = useState(false);

  async function save(asNew: boolean) {
    if (!captured || busy) return;
    setBusy(true);
    // Let the button show "Saving" before the picture is drawn.
    await new Promise((r) => setTimeout(r, 30));
    // A small picture of the rig for the card; skipped quietly if this device cannot draw it.
    let thumbnail: string | undefined;
    try {
      const { renderRigPng } = await import('@/modules/rig/rigScene');
      thumbnail = renderRigPng(cam, project.gear, project.connections, 480, 300, true) ?? undefined;
    } catch {
      thumbnail = undefined;
    }
    const rig = saveRig({ id: asNew ? undefined : linked?.id, name: name.trim() || 'My rig', ...captured, thumbnail });
    patch((p) => ({ gear: p.gear.map((g) => (g.id === cam.id ? { ...g, savedRigId: rig.id } : g)) }));
    toast(asNew || !linked ? `Saved "${rig.name}" to your rigs` : `Updated "${rig.name}"`);
    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Save this rig"
      footer={
        <div className="cluster">
          {linked && (
            <Button variant="quiet" disabled={busy} onClick={() => void save(true)}>
              Save as a new rig
            </Button>
          )}
          <Button variant="primary" disabled={busy} onClick={() => void save(false)}>
            {busy ? 'Saving…' : linked ? `Update "${linked.name}"` : 'Save rig'}
          </Button>
        </div>
      }
    >
      <div className="stack stack--sm">
        <TextField label="Rig name" value={name} onChange={setName} placeholder="e.g. R50 V run-and-gun" autoFocus />
        <p className="tiny muted">
          Saves the camera with its settings, lens and {captured ? captured.parts.length : 0} parts, and the {captured ? captured.connections.length : 0} connections between them. Next time, choose <strong>Use my {name || 'rig'}</strong> when you add a camera.
        </p>
      </div>
    </Sheet>
  );
}
