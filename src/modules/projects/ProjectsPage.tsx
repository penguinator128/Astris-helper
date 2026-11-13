import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Copy, Pencil, Plus, Trash2, Check } from 'lucide-react';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/Button';
import { Confirm, Sheet } from '@/components/Sheet';
import { TextField } from '@/components/Field';
import { useProjects } from '@/store/projects';
import { fmtDate } from '@/lib/format';
import { toast } from '@/store/toast';

export default function ProjectsPage() {
  const { projects, currentId, select, create, duplicate, rename, remove } = useProjects();
  const nav = useNavigate();
  const list = Object.values(projects).sort((a, b) => b.updatedAt - a.updatedAt);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  return (
    <main className="page">
      <PageHead
        title="Projects"
        sub="Each project holds its own shots, storyboard, diagrams, palettes, call sheet and checklist."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
            New
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
                {p.shots.length} shots · {p.storyboard.length} frames · {p.diagrams.length} diagrams · {p.palettes.length} palettes · edited {fmtDate(new Date(p.updatedAt))}
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
                  toast('Project duplicated');
                }}
              >
                Duplicate
              </Button>
              <Button variant="ghost" size="sm" iconOnly icon={<Trash2 size={16} />} onClick={() => setDeleting(p.id)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Sheet
        open={creating}
        onClose={() => setCreating(false)}
        title="New project"
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
            Create project
          </Button>
        }
      >
        <TextField label="Project name" value={newName} onChange={setNewName} placeholder="Working title" autoFocus />
      </Sheet>

      <Sheet
        open={renaming != null}
        onClose={() => setRenaming(null)}
        title="Rename project"
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
        {renaming && <TextField label="Project name" value={renaming.name} onChange={(v) => setRenaming({ ...renaming, name: v })} autoFocus />}
      </Sheet>

      <Confirm
        open={deleting != null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) remove(deleting);
          toast('Project deleted');
        }}
        title="Delete this project?"
        body="This removes the project and everything in it from this device."
        confirmLabel="Delete project"
        danger
      />
    </main>
  );
}
