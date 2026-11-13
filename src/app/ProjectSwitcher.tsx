import { useState } from 'react';
import { Check, Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { useProjects } from '@/store/projects';
import { Sheet, Confirm } from '@/components/Sheet';
import { Button } from '@/components/Button';
import { TextField } from '@/components/Field';
import { toast } from '@/store/toast';
import { fmtDate } from '@/lib/format';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ProjectSwitcher({ open, onClose }: Props) {
  const { projects, currentId, select, create, duplicate, rename, remove } = useProjects();
  const list = Object.values(projects).sort((a, b) => b.updatedAt - a.updatedAt);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  function handleCreate() {
    const p = create(newName || 'Untitled project');
    setNewName('');
    toast(`Created “${p.name}”`);
    onClose();
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Projects">
        <div className="stack">
          <div className="rows">
            {list.map((p) => {
              const isCurrent = p.id === currentId;
              const isRenaming = renaming?.id === p.id;
              return (
                <div key={p.id} className="row" style={{ gridTemplateColumns: '28px 1fr auto' }}>
                  <span className="row__idx" aria-hidden="true">
                    {isCurrent ? <Check size={16} /> : ''}
                  </span>
                  <div className="row__main">
                    {isRenaming ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          rename(p.id, renaming.name);
                          setRenaming(null);
                        }}
                        className="cluster"
                        style={{ flexWrap: 'nowrap' }}
                      >
                        <input
                          className="input"
                          aria-label="Project name"
                          value={renaming.name}
                          autoFocus
                          onChange={(e) => setRenaming({ id: p.id, name: e.target.value })}
                          onBlur={() => {
                            rename(p.id, renaming.name);
                            setRenaming(null);
                          }}
                        />
                      </form>
                    ) : (
                      <button
                        type="button"
                        className="row__title"
                        style={{ display: 'block', width: '100%', minHeight: 36 }}
                        onClick={() => {
                          select(p.id);
                          onClose();
                        }}
                        aria-current={isCurrent ? 'true' : undefined}
                      >
                        {p.name}
                        <div className="row__sub mono tiny">
                          {p.shots.length} shots · {p.diagrams.length} diagrams · {fmtDate(new Date(p.updatedAt))}
                        </div>
                      </button>
                    )}
                  </div>
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
              );
            })}
          </div>
          <form
            className="cluster"
            style={{ flexWrap: 'nowrap' }}
            onSubmit={(e) => {
              e.preventDefault();
              handleCreate();
            }}
          >
            <div style={{ flex: 1 }}>
              <TextField label="New project" value={newName} onChange={setNewName} placeholder="Project name" />
            </div>
            <Button type="submit" variant="primary" icon={<Plus size={16} />} style={{ alignSelf: 'flex-end' }}>
              Create
            </Button>
          </form>
        </div>
      </Sheet>
      <Confirm
        open={deleting != null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) {
            remove(deleting);
            toast('Project deleted');
          }
        }}
        title="Delete this project?"
        body="Shots, storyboard, diagrams, palettes and the call sheet in this project will be removed from this device. This cannot be undone."
        confirmLabel="Delete project"
        danger
      />
    </>
  );
}
