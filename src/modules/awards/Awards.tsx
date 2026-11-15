import { useRef, useState } from 'react';
import { Award, Download, Plus, Trash2, Sparkles, Star, X } from 'lucide-react';
import { PageHead } from '@/components/PageHead';
import { Blueprint } from '@/components/Blueprint';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Sheet, Confirm } from '@/components/Sheet';
import { SelectField, TextField } from '@/components/Field';
import { Stepper } from '@/components/Stepper';
import { Tabs } from '@/components/Tabs';
import { useProject, useProjects } from '@/store/projects';
import { uid } from '@/lib/id';
import { toast } from '@/store/toast';
import { svgToPng } from '@/lib/svgExport';
import { downloadDataUrl, safeFilename } from '@/lib/download';
import { StarMark } from '@/brand/Wordmark';
import type { AwardCategory, AwardNominee, Ceremony } from '@/types/project';
import { AwardCard } from './AwardCard';
import './awards.css';

export default function Awards() {
  const project = useProject();
  const patch = useProjects((s) => s.patchCurrent);
  const [currentId, setCurrentId] = useState<string | null>(project.awards[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('Astris Awards');
  const [deleting, setDeleting] = useState(false);
  const ceremony = project.awards.find((c) => c.id === currentId) ?? project.awards[0] ?? null;

  function createCeremony() {
    const c: Ceremony = { id: uid(), title: title.trim() || 'Astris Awards', year: new Date().getFullYear(), tagline: '', categories: [], createdAt: Date.now() };
    patch((p) => ({ awards: [...p.awards, c] }));
    setCurrentId(c.id);
    setCreating(false);
  }
  function update(c: Ceremony) {
    patch((p) => ({ awards: p.awards.map((x) => (x.id === c.id ? c : x)) }));
  }

  return (
    <main className="page">
      <PageHead
        index="09 · Awards"
        title="Astris Awards"
        sub="Ceremonies, categories and nominees, with printable cards and an envelope reveal."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
            Ceremony
          </Button>
        }
      />
      {!ceremony ? (
        <EmptyState title="No ceremony yet" body="Set one up for the wrap party or a festival screening: add categories, nominees and pick the winners." action={<Button onClick={() => setCreating(true)}>Create a ceremony</Button>} />
      ) : (
        <div className="stack">
          {project.awards.length > 1 && (
            <SelectField label="Ceremony" value={ceremony.id} onChange={setCurrentId} options={project.awards.map((c) => ({ value: c.id, label: `${c.title} ${c.year}` }))} />
          )}
          <CeremonyEditor key={ceremony.id} ceremony={ceremony} onChange={update} onDelete={() => setDeleting(true)} />
        </div>
      )}

      <Sheet
        open={creating}
        onClose={() => setCreating(false)}
        title="New ceremony"
        footer={
          <Button variant="primary" block onClick={createCeremony}>
            Create
          </Button>
        }
      >
        <TextField label="Title" value={title} onChange={setTitle} autoFocus />
      </Sheet>
      <Confirm
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => {
          if (!ceremony) return;
          patch((p) => ({ awards: p.awards.filter((c) => c.id !== ceremony.id) }));
          setCurrentId(null);
          toast('Ceremony deleted');
        }}
        title="Delete this ceremony?"
        body="Its categories, nominees and winners will be removed."
        confirmLabel="Delete ceremony"
        danger
      />
    </main>
  );
}

function CeremonyEditor({ ceremony, onChange, onDelete }: { ceremony: Ceremony; onChange: (c: Ceremony) => void; onDelete: () => void }) {
  const [tab, setTab] = useState<'setup' | 'cards'>('setup');
  const [revealing, setRevealing] = useState<AwardCategory | null>(null);
  const set = (d: Partial<Ceremony>) => onChange({ ...ceremony, ...d });
  const setCat = (id: string, d: Partial<AwardCategory>) => set({ categories: ceremony.categories.map((c) => (c.id === id ? { ...c, ...d } : c)) });

  function addCategory() {
    set({ categories: [...ceremony.categories, { id: uid(), name: `Category ${ceremony.categories.length + 1}`, nominees: [{ id: uid(), name: '', work: '' }] }] });
  }

  return (
    <div className="stack">
      <Blueprint
        title="Ceremony"
        index="A"
        aside={
          <Button size="sm" variant="ghost" iconOnly icon={<Trash2 size={14} />} onClick={onDelete}>
            Delete ceremony
          </Button>
        }
      >
        <div className="stack">
          <div className="grid-2">
            <TextField label="Title" value={ceremony.title} onChange={(v) => set({ title: v })} />
            <Stepper label="Year" value={ceremony.year} onChange={(v) => set({ year: Math.round(v) })} min={1900} max={2200} />
          </div>
          <TextField label="Tagline" value={ceremony.tagline} onChange={(v) => set({ tagline: v })} placeholder="Optional line for the programme" />
        </div>
      </Blueprint>

      <Tabs
        value={tab}
        onChange={setTab}
        label="Ceremony views"
        tabs={[
          { id: 'setup', label: 'Categories' },
          { id: 'cards', label: 'Cards' },
        ]}
      />

      {tab === 'setup' && (
        <div className="stack">
          {ceremony.categories.length === 0 && <EmptyState title="No categories" body="Add a category such as Best Short, Best Cinematography or Crew Member of the Shoot." action={<Button onClick={addCategory}>Add a category</Button>} />}
          {ceremony.categories.map((cat, ci) => (
            <Blueprint
              key={cat.id}
              title={cat.name || 'Untitled category'}
              index={String(ci + 1).padStart(2, '0')}
              aside={
                <div className="cluster">
                  <Button size="sm" variant="primary" icon={<Sparkles size={14} />} onClick={() => setRevealing(cat)} disabled={!cat.winnerId}>
                    Reveal
                  </Button>
                  <Button size="sm" variant="ghost" iconOnly icon={<Trash2 size={14} />} onClick={() => set({ categories: ceremony.categories.filter((c) => c.id !== cat.id) })}>
                    Delete category
                  </Button>
                </div>
              }
            >
              <div className="stack stack--sm">
                <TextField label="Category name" value={cat.name} onChange={(v) => setCat(cat.id, { name: v })} />
                <div>
                  {cat.nominees.map((n) => (
                    <div key={n.id} className="nominee-row">
                      <button type="button" className="winner-toggle" aria-pressed={cat.winnerId === n.id} aria-label={`Mark ${n.name || 'nominee'} as winner`} onClick={() => setCat(cat.id, { winnerId: cat.winnerId === n.id ? undefined : n.id })}>
                        <Star size={18} />
                      </button>
                      <TextField label="Nominee" value={n.name} onChange={(v) => setCat(cat.id, { nominees: cat.nominees.map((x) => (x.id === n.id ? { ...x, name: v } : x)) })} />
                      <TextField label="For" value={n.work} onChange={(v) => setCat(cat.id, { nominees: cat.nominees.map((x) => (x.id === n.id ? { ...x, work: v } : x)) })} placeholder="Film or role" />
                      <Button size="sm" variant="ghost" iconOnly icon={<X size={14} />} onClick={() => setCat(cat.id, { nominees: cat.nominees.filter((x) => x.id !== n.id), winnerId: cat.winnerId === n.id ? undefined : cat.winnerId })}>
                        Remove nominee
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="cluster" style={{ justifyContent: 'space-between' }}>
                  <Button size="sm" variant="quiet" icon={<Plus size={14} />} onClick={() => setCat(cat.id, { nominees: [...cat.nominees, { id: uid(), name: '', work: '' }] })}>
                    Nominee
                  </Button>
                  <span className="tiny muted">{cat.winnerId ? 'Winner chosen. Keep it secret until the reveal.' : 'Tap the star to choose the winner.'}</span>
                </div>
              </div>
            </Blueprint>
          ))}
          {ceremony.categories.length > 0 && (
            <Button variant="quiet" icon={<Plus size={16} />} onClick={addCategory}>
              Add category
            </Button>
          )}
        </div>
      )}

      {tab === 'cards' && <CardsView ceremony={ceremony} />}

      {revealing && <Reveal ceremony={ceremony} category={revealing} onClose={() => setRevealing(null)} />}
    </div>
  );
}

function CardsView({ ceremony }: { ceremony: Ceremony }) {
  const refs = useRef(new Map<string, SVGSVGElement | null>());
  const entries: { key: string; cat: AwardCategory; nominee: AwardNominee; winner: boolean }[] = [];
  for (const cat of ceremony.categories) for (const n of cat.nominees) if (n.name.trim()) entries.push({ key: `${cat.id}-${n.id}`, cat, nominee: n, winner: cat.winnerId === n.id });

  async function exportCard(key: string, filename: string) {
    const svg = refs.current.get(key);
    if (!svg) return;
    const png = await svgToPng(svg, 1200, 1680);
    downloadDataUrl(png, filename);
  }
  async function exportAll() {
    for (const e of entries) await exportCard(e.key, `${safeFilename(ceremony.title)}-${e.winner ? 'winner' : 'nominee'}-${safeFilename(e.cat.name)}-${safeFilename(e.nominee.name)}.png`);
    toast(`Exported ${entries.length} cards`);
  }

  if (entries.length === 0) return <EmptyState title="No cards to show" body="Name at least one nominee in a category and their card appears here." />;
  return (
    <div className="stack">
      <div className="cluster" style={{ justifyContent: 'space-between' }}>
        <span className="tiny muted">Winner cards are yellow; nominee cards are ink. Each exports as a 1200 × 1680 PNG.</span>
        <Button size="sm" variant="quiet" icon={<Download size={14} />} onClick={() => void exportAll()}>
          Export all
        </Button>
      </div>
      <div className="award-grid">
        {entries.map((e) => (
          <div key={e.key} className="stack stack--sm">
            <AwardCard
              ref={(el) => {
                refs.current.set(e.key, el);
              }}
              kind={e.winner ? 'winner' : 'nominee'}
              ceremony={ceremony.title}
              year={ceremony.year}
              category={e.cat.name}
              name={e.nominee.name}
              work={e.nominee.work}
            />
            <Button size="sm" variant="quiet" icon={<Download size={14} />} onClick={() => void exportCard(e.key, `${safeFilename(ceremony.title)}-${e.winner ? 'winner' : 'nominee'}-${safeFilename(e.nominee.name)}.png`)}>
              PNG
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Reveal({ ceremony, category, onClose }: { ceremony: Ceremony; category: AwardCategory; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const winner = category.nominees.find((n) => n.id === category.winnerId);
  return (
    <div className={`reveal ${open ? 'is-open' : ''}`} role="dialog" aria-modal="true" aria-label={`Reveal for ${category.name}`}>
      <div className="reveal__rays" aria-hidden="true" />
      <div className="stack stack--sm reveal__head" style={{ alignItems: 'center' }}>
        <span className="cluster" style={{ gap: 8, letterSpacing: '0.22em', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>
          <StarMark size={14} /> {ceremony.title} {ceremony.year}
        </span>
        <div className="reveal__category">And the award for {category.name} goes to</div>
      </div>
      <div className="reveal__stage">
        <button type="button" className="envelope" onClick={() => setOpen(true)} aria-label={open ? 'Envelope opened' : 'Open the envelope'} disabled={open}>
          <div className="envelope__back" />
          <div className="envelope__card" aria-live="polite">
            {open && (
              <>
                <span className="micro">Winner</span>
                <span className="envelope__winner">{winner?.name ?? 'No winner set'}</span>
                {winner?.work && <span className="envelope__work">{winner.work}</span>}
              </>
            )}
          </div>
          <div className="envelope__flap" />
          <div className="envelope__front" />
          <div className="envelope__seal">
            <Award size={28} />
          </div>
        </button>
      </div>
      <div className="reveal__actions">
        {!open && (
          <Button variant="primary" onClick={() => setOpen(true)}>
            Open envelope
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}
