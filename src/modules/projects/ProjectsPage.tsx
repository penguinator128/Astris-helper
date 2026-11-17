import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Copy, Pencil, Plus, Trash2, Check, History, Download } from 'lucide-react';
import { Blueprint } from '@/components/Blueprint';
import { LibraryPanel } from './LibraryPanel';
import '@/modules/cameras/cameras.css';
import { listBackups, deleteBackup, backupProject, type Backup } from '@/store/backups';
import { downloadBlob, safeFilename } from '@/lib/download';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/Button';
import { Confirm, Sheet } from '@/components/Sheet';
import { TextField } from '@/components/Field';
import { useProjects } from '@/store/projects';
import { fmtDate } from '@/lib/format';
import { toast } from '@/store/toast';

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export default function ProjectsPage() {
  const { projects, currentId, select, create, duplicate, rename, remove } = useProjects();
  const nav = useNavigate();
  const list = Object.values(projects).sort((a, b) => b.updatedAt - a.updatedAt);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [backups, setBackups] = useState<Backup[]>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    void listBackups().then((b) => live && setBackups(b));
    return () => {
      live = false;
    };
  }, [tick]);
  const refresh = () => setTimeout(() => setTick((t) => t + 1), 150);
  const importProject = useProjects((s) => s.importProject);

  return (
    <main className="page">
      <PageHead
        title="My Production Plans"
        sub="Each plan holds its own set-ups (scenes), cameras, gear, connections, shots, storyboard and call sheet. Everything saves on this device as you work."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
            New plan
          </Button>
        }
      />
      <div className="rows">
        {list.map((p) => (
          <div key={p.id} className="row" style={{ gridTemplateColumns: '28px 1fr auto' }}>
            <span className="row__idx">{p.id === currentId ? <Check size={16} aria-label="Current project" /> : ''}</span>
            <button
              type="button"
              className="row__main"
              style={{ textAlign: 'left', minHeight: 44 }}
              onClick={() => {
                select(p.id);
                nav('/');
              }}
            >
              <div className="row__title">{p.name}</div>
              <div className="row__sub mono tiny">
                {plural(p.diagrams.length, 'set-up')} · {plural(p.gear.filter((g) => g.category === 'camera').length, 'camera')} · {p.gear.length} gear · {plural(p.shots.length, 'shot')} · saved {fmtDate(new Date(p.updatedAt))}
              </div>
            </button>
            <div className="row__end">
              <Button variant="ghost" size="sm" iconOnly icon={<Pencil size={16} />} onClick={() => setRenaming({ id: p.id, name: p.name })}>
                Rename
              </Button>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                icon={<Copy size={16} />}
                onClick={() => {
                  duplicate(p.id);
                  toast('Plan duplicated');
                }}
              >
                Duplicate
              </Button>
              <Button variant="ghost" size="sm" iconOnly icon={<Trash2 size={16} />} onClick={() => setDeleting(p.id)}>
                Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                icon={<Download size={16} />}
                onClick={() => {
                  downloadBlob(new Blob([JSON.stringify({ format: 'astris-field-kit', version: 1, exportedAt: new Date().toISOString(), project: p, images: {} }, null, 2)], { type: 'application/json' }), `${safeFilename(p.name)}.json`);
                  void backupProject(p, 'Saved a copy').then(refresh);
                }}
              >
                Download a copy
              </Button>
            </div>
          </div>
        ))}
      </div>

      <LibraryPanel />

      <Blueprint title="Backups on this device" index="B" aside={<History size={16} aria-hidden />}>
        <div className="stack stack--sm">
          <p className="tiny muted">A copy of each plan is kept every day, before an app update changes how it is stored, and before a delete. Restoring always makes a new plan; nothing is overwritten.</p>
          {backups.length === 0 ? (
            <p className="tiny muted">No backups yet.</p>
          ) : (
            <ul className="rows">
              {backups.slice(0, 30).map((b) => (
                <li key={b.key} className="row" style={{ gridTemplateColumns: '1fr auto' }}>
                  <div className="row__main">
                    <div className="row__title">{b.name}</div>
                    <div className="row__sub mono tiny">{b.reason} · {fmtDate(new Date(b.at))} {new Date(b.at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <div className="row__end">
                    <Button
                      size="sm"
                      onClick={() => {
                        importProject({ ...b.project, id: `${b.project.id}-r${Date.now().toString(36)}`, name: `${b.name} (restored)` });
                        toast('Restored as a new plan');
                      }}
                    >
                      Restore
                    </Button>
                    <Button size="sm" variant="ghost" iconOnly icon={<Trash2 size={14} />} onClick={() => void deleteBackup(b.key).then(refresh)}>
                      Delete backup
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Blueprint>

      <Sheet
        open={creating}
        onClose={() => setCreating(false)}
        title="New production plan"
        footer={
          <Button
            variant="primary"
            block
            onClick={() => {
              create(newName);
              setNewName('');
              setCreating(false);
              nav('/');
            }}
          >
            Create plan
          </Button>
        }
      >
        <TextField label="Plan name" value={newName} onChange={setNewName} placeholder="Working title" autoFocus />
      </Sheet>

      <Sheet
        open={renaming != null}
        onClose={() => setRenaming(null)}
        title="Rename plan"
        footer={
          <Button
            variant="primary"
            block
            onClick={() => {
              if (renaming) rename(renaming.id, renaming.name);
              setRenaming(null);
            }}
          >
            Save
          </Button>
        }
      >
        {renaming && <TextField label="Plan name" value={renaming.name} onChange={(v) => setRenaming({ ...renaming, name: v })} autoFocus />}
      </Sheet>

      <Confirm
        open={deleting != null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) remove(deleting);
          toast('Plan deleted. A backup is kept below.');
          refresh();
        }}
        title="Delete this plan?"
        body="This removes the plan from your list. A backup copy is kept on this device, so you can restore it below."
        confirmLabel="Delete plan"
        danger
      />
    </main>
  );
}
