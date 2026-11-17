import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Blueprint } from '@/components/Blueprint';
import { Button } from '@/components/Button';
import { Confirm, Sheet } from '@/components/Sheet';
import { TextField } from '@/components/Field';
import { useLibrary, liveCameras, liveLenses, liveRigs } from '@/store/library';
import { toast } from '@/store/toast';

/** Saved rigs, cameras and lenses: shared by every plan. */
export function LibraryPanel() {
  const lib = useLibrary();
  const rigs = liveRigs(lib);
  const cams = liveCameras(lib);
  const lenses = liveLenses(lib);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<{ kind: 'rig' | 'camera' | 'lens'; id: string; name: string } | null>(null);
  return (
    <Blueprint title="My rigs, cameras and lenses" index="K">
      <div className="stack stack--sm">
        <p className="tiny muted">Saved once, ready in every plan. Save a rig from its camera on the Cameras page; cameras and lenses you describe are kept here automatically.</p>
        {rigs.length + cams.length + lenses.length === 0 && <p className="tiny muted">Nothing saved yet.</p>}
        {rigs.length > 0 && (
          <ul className="rows" aria-label="Saved rigs">
            {rigs.map((r) => (
              <li key={r.id} className="row" style={{ gridTemplateColumns: '64px 1fr auto' }}>
                {r.thumbnail ? <img src={r.thumbnail} alt="" className="lib-thumb" /> : <span className="lib-thumb" />}
                <div className="row__main">
                  <div className="row__title">{r.name}</div>
                  <div className="row__sub mono tiny">Rig · {r.camera.camera?.model ?? r.camera.model} · {r.parts.length} parts</div>
                </div>
                <div className="row__end">
                  <Button variant="ghost" size="sm" iconOnly icon={<Pencil size={16} />} onClick={() => setRenaming({ id: r.id, name: r.name })}>
                    Rename rig
                  </Button>
                  <Button variant="ghost" size="sm" iconOnly icon={<Trash2 size={16} />} onClick={() => setDeleting({ kind: 'rig', id: r.id, name: r.name })}>
                    Delete rig
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {(cams.length > 0 || lenses.length > 0) && (
          <ul className="rows" aria-label="Saved cameras and lenses">
            {cams.map((c) => (
              <li key={c.id} className="row" style={{ gridTemplateColumns: '1fr auto' }}>
                <div className="row__main">
                  <div className="row__title">{c.body.manufacturer} {c.body.model}</div>
                  <div className="row__sub mono tiny">Camera · {c.body.mount} mount · {c.body.battery}</div>
                </div>
                <div className="row__end">
                  <Button variant="ghost" size="sm" iconOnly icon={<Trash2 size={16} />} onClick={() => setDeleting({ kind: 'camera', id: c.id, name: `${c.body.manufacturer} ${c.body.model}` })}>
                    Delete camera
                  </Button>
                </div>
              </li>
            ))}
            {lenses.map((l) => (
              <li key={l.id} className="row" style={{ gridTemplateColumns: '1fr auto' }}>
                <div className="row__main">
                  <div className="row__title">{l.lens.manufacturer} {l.lens.model}</div>
                  <div className="row__sub mono tiny">Lens · {l.lens.mount} mount</div>
                </div>
                <div className="row__end">
                  <Button variant="ghost" size="sm" iconOnly icon={<Trash2 size={16} />} onClick={() => setDeleting({ kind: 'lens', id: l.id, name: `${l.lens.manufacturer} ${l.lens.model}` })}>
                    Delete lens
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Sheet
        open={renaming != null}
        onClose={() => setRenaming(null)}
        title="Rename rig"
        footer={
          <Button
            variant="primary"
            block
            onClick={() => {
              if (renaming) lib.renameRig(renaming.id, renaming.name);
              setRenaming(null);
            }}
          >
            Save
          </Button>
        }
      >
        {renaming && <TextField label="Rig name" value={renaming.name} onChange={(v) => setRenaming({ ...renaming, name: v })} autoFocus />}
      </Sheet>
      <Confirm
        open={deleting != null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          if (deleting.kind === 'rig') lib.deleteRig(deleting.id);
          if (deleting.kind === 'camera') lib.deleteCamera(deleting.id);
          if (deleting.kind === 'lens') lib.deleteLens(deleting.id);
          toast(`Deleted ${deleting.name}`);
        }}
        title={`Delete ${deleting?.name ?? ''}?`}
        body="It leaves your saved list. Plans that already use it keep their copy."
        confirmLabel="Delete"
        danger
      />
    </Blueprint>
  );
}
