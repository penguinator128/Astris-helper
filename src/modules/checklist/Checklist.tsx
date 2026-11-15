import { useMemo, useState } from 'react';
import { ChevronDown, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { PageHead } from '@/components/PageHead';
import { Blueprint } from '@/components/Blueprint';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Sheet } from '@/components/Sheet';
import { TextField, SelectField } from '@/components/Field';
import { useProject, useProjects } from '@/store/projects';
import { uid } from '@/lib/id';
import { toast } from '@/store/toast';
import type { ChecklistItem } from '@/types/project';
import { GEAR_TEMPLATES } from './templates';

export default function Checklist() {
  const project = useProject();
  const { projects, patchCurrent: patch } = useProjects();
  const items = project.checklist.slice().sort((a, b) => a.order - b.order);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [copyFrom, setCopyFrom] = useState('');

  const groups = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>();
    for (const it of items) {
      if (!map.has(it.group)) map.set(it.group, []);
      map.get(it.group)!.push(it);
    }
    return Array.from(map.entries());
  }, [items]);
  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  function addTemplate(id: string) {
    const t = GEAR_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    const existing = new Set(items.filter((i) => i.group === t.group).map((i) => i.label.toLowerCase()));
    const fresh = t.items.filter((label) => !existing.has(label.toLowerCase())).map((label, i) => ({ id: uid(), group: t.group, label, done: false, qty: 1, order: items.length + i + 1 }));
    if (fresh.length === 0) return toast(`${t.group} is already in the list`);
    patch((p) => ({ checklist: [...p.checklist, ...fresh] }));
    toast(`Added ${fresh.length} ${t.group.toLowerCase()} items`);
  }
  function addItem() {
    if (!newLabel.trim()) return;
    patch((p) => ({ checklist: [...p.checklist, { id: uid(), group: newGroup.trim() || 'Other', label: newLabel.trim(), done: false, qty: 1, order: p.checklist.length + 1 }] }));
    setNewLabel('');
    setAdding(false);
  }
  function update(id: string, d: Partial<ChecklistItem>) {
    patch((p) => ({ checklist: p.checklist.map((i) => (i.id === id ? { ...i, ...d } : i)) }));
  }
  function remove(id: string) {
    patch((p) => ({ checklist: p.checklist.filter((i) => i.id !== id) }));
  }
  function resetTicks() {
    patch((p) => ({ checklist: p.checklist.map((i) => ({ ...i, done: false })) }));
    toast('All items unticked');
  }
  function copyFromProject(id: string) {
    const src = projects[id];
    if (!src) return;
    const copied = src.checklist.map((i, n) => ({ ...i, id: uid(), done: false, order: items.length + n + 1 }));
    patch((p) => ({ checklist: [...p.checklist, ...copied] }));
    toast(`Copied ${copied.length} items from ${src.name}`);
    setCopyFrom('');
  }
  function toggleGroup(g: string) {
    setCollapsed((prev) => {
      const n = new Set(prev);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });
  }

  const others = Object.values(projects).filter((p) => p.id !== project.id && p.checklist.length > 0);

  return (
    <main className="page">
      <PageHead
        index="11 · Gear"
        title="Gear Checklist"
        sub={items.length ? `${done} of ${items.length} packed · ${pct}%` : 'Templated kit lists, ticked off per project.'}
        actions={
          <>
            <Button size="sm" variant="quiet" icon={<RotateCcw size={14} />} onClick={resetTicks} disabled={done === 0}>
              Untick all
            </Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>
              Add
            </Button>
          </>
        }
      />
      <div className="stack">
        {items.length > 0 && (
          <div aria-hidden="true" style={{ height: 6, background: 'var(--bg-2)', border: '1px solid var(--hair)' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--yellow)', transition: 'width var(--t-base) var(--ease)' }} />
          </div>
        )}
        <Blueprint title="Templates" index="A">
          <div className="cluster">
            {GEAR_TEMPLATES.map((t) => (
              <Button key={t.id} size="sm" variant="quiet" icon={<Plus size={14} />} onClick={() => addTemplate(t.id)}>
                {t.group}
              </Button>
            ))}
            {others.length > 0 && (
              <SelectField
                label="Copy from project"
                value={copyFrom}
                onChange={(v) => {
                  setCopyFrom(v);
                  if (v) copyFromProject(v);
                }}
                options={[{ value: '', label: 'Choose' }, ...others.map((p) => ({ value: p.id, label: `${p.name} (${p.checklist.length})` }))]}
              />
            )}
          </div>
        </Blueprint>

        {items.length === 0 ? (
          <EmptyState title="Nothing on the list yet" body="Add a template group to start, then tick things off as they go in the bag. Lists are kept per project." action={<Button onClick={() => addTemplate('camera')}>Add camera template</Button>} />
        ) : (
          groups.map(([group, list]) => {
            const g = list.filter((i) => i.done).length;
            const isCollapsed = collapsed.has(group);
            return (
              <section key={group} className="bp" aria-labelledby={`g-${group}`}>
                <button type="button" className="bp__head" style={{ width: '100%', paddingBottom: 'var(--s-3)', cursor: 'pointer' }} onClick={() => toggleGroup(group)} aria-expanded={!isCollapsed}>
                  <span className="cluster" style={{ gap: 'var(--s-2)' }}>
                    <h2 id={`g-${group}`} style={{ fontSize: 'var(--fs-16)', fontWeight: 600 }}>
                      {group}
                    </h2>
                    <span className="tag">
                      {g}/{list.length}
                    </span>
                  </span>
                  <ChevronDown size={16} style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform var(--t-fast)' }} />
                </button>
                {!isCollapsed && (
                  <div className="bp__body bp__body--none">
                    {list.map((it) => (
                      <div key={it.id} className="row" style={{ gridTemplateColumns: '44px 1fr auto', paddingLeft: 'var(--s-2)', paddingRight: 'var(--s-2)', minHeight: 48 }}>
                        <input type="checkbox" checked={it.done} onChange={(e) => update(it.id, { done: e.target.checked })} aria-label={it.label} style={{ width: 24, height: 24 }} />
                        <label className="row__main" style={{ cursor: 'pointer', textDecoration: it.done ? 'line-through' : 'none', color: it.done ? 'var(--fg-3)' : 'inherit' }} onClick={() => update(it.id, { done: !it.done })}>
                          <span className="row__title" style={{ fontSize: 'var(--fs-14)' }}>
                            {it.label}
                          </span>
                        </label>
                        <span className="row__end">
                          <input type="number" className="input input--mono" value={it.qty} min={1} onChange={(e) => update(it.id, { qty: Math.max(1, Number(e.target.value) || 1) })} aria-label={`Quantity of ${it.label}`} style={{ width: 56, minHeight: 32, padding: '0 6px', textAlign: 'center' }} />
                          <Button size="sm" variant="ghost" iconOnly icon={<Trash2 size={14} />} onClick={() => remove(it.id)}>
                            Remove {it.label}
                          </Button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>

      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title="Add an item"
        footer={
          <Button variant="primary" block onClick={addItem} disabled={!newLabel.trim()}>
            Add item
          </Button>
        }
      >
        <div className="stack">
          <TextField label="Item" value={newLabel} onChange={setNewLabel} placeholder="e.g. Spare lens cap" autoFocus onKeyDown={(e) => e.key === 'Enter' && addItem()} />
          <TextField label="Group" value={newGroup} onChange={setNewGroup} placeholder="Camera, Audio, Other…" list="gear-groups" />
          <datalist id="gear-groups">
            {Array.from(new Set([...GEAR_TEMPLATES.map((t) => t.group), ...items.map((i) => i.group)])).map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </div>
      </Sheet>
    </main>
  );
}
