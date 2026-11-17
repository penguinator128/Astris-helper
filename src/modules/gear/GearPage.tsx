import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, ClipboardCheck, Download, Plus, Trash2, Cable, Wand2 } from 'lucide-react';
import { PageHead } from '@/components/PageHead';
import { Blueprint } from '@/components/Blueprint';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Sheet, Confirm } from '@/components/Sheet';
import { SelectField, TextAreaField, TextField } from '@/components/Field';
import { Stepper } from '@/components/Stepper';
import { Tabs } from '@/components/Tabs';
import { useProject, useProjects } from '@/store/projects';
import { toast } from '@/store/toast';
import { uid } from '@/lib/id';
import { toCsv } from '@/lib/csv';
import { downloadBlob, safeFilename } from '@/lib/download';
import { CATEGORIES, CONNECTORS, SIGNALS, TEMPLATES, blankGear, cableFor, categoryInfo, gearFromTemplate, nextName } from '@/lib/gear/catalog';
import { cableSummary, equipmentList } from '@/lib/gear/equipment';
import type { Connector, GearCategory, GearItem, GearPort, SignalKind } from '@/types/project';
import { ConnectSheet } from './ConnectSheet';
import { AutoConnectSheet } from './AutoConnectSheet';
import { check, checkProduction, portUsage, usedPorts } from '@/lib/gear/autoconnect';
import '@/modules/cameras/cameras.css';
import './gear.css';

const SIGNAL_COLOUR: Record<SignalKind, string> = { audio: '#3f6fa0', video: '#e0ab00', timecode: '#7a7a7c', power: '#b3261e', data: '#4a4a4c', mount: '#0b0b0c' };

type Tab = 'gear' | 'connections' | 'equipment';

export default function GearPage() {
  const project = useProject();
  const [tab, setTab] = useState<Tab>('gear');
  return (
    <main className="page">
      <PageHead
        index="02 · Gear"
        title="Gear"
        sub="Every camera, mic, recorder and light, with its inputs and outputs. The equipment list builds itself from this and the plan."
        actions={
          <Link to="/plan" className="btn btn--sm btn--quiet">
            Shoot plan <ArrowRight size={14} />
          </Link>
        }
      />
      <div className="stack">
        <Tabs
          value={tab}
          onChange={setTab}
          label="Gear views"
          tabs={[
            { id: 'gear', label: `Gear (${project.gear.length})` },
            { id: 'connections', label: `Connections (${project.connections.length})` },
            { id: 'equipment', label: 'Equipment list' },
          ]}
        />
        {tab === 'gear' && <GearList />}
        {tab === 'connections' && <Connections />}
        {tab === 'equipment' && <Equipment />}
      </div>
    </main>
  );
}

/* ---------- Gear list ---------- */

export function AddGearSheet({ open, onClose, onAdded, only }: { open: boolean; onClose: () => void; onAdded?: (g: GearItem) => void; only?: GearCategory[] }) {
  const project = useProject();
  const patch = useProjects((s) => s.patchCurrent);
  const cats = CATEGORIES.filter((c) => !only || only.includes(c.id));
  function add(g: GearItem) {
    patch((p) => ({ gear: [...p.gear, g] }));
    onAdded?.(g);
    onClose();
    toast(`Added ${g.name}`);
  }
  return (
    <Sheet open={open} onClose={onClose} title="Add gear" wide>
      <div className="stack">
        {cats.map((c) => (
          <div key={c.id} className="stack stack--sm">
            <span className="micro">{c.label}</span>
            <div className="template-grid">
              {TEMPLATES.filter((t) => t.category === c.id).map((t) => (
                <button key={t.id} type="button" className="preset-card" onClick={() => add(gearFromTemplate(t, nextName(project.gear, t.category, t.name)))}>
                  <strong>{t.name}</strong>
                  <span>{t.ports.length ? `${t.ports.filter((p) => p[1] === 'in').length} in · ${t.ports.filter((p) => p[1] === 'out').length} out` : 'No connections'}{t.power ? ` · ${t.power}` : ''}</span>
                </button>
              ))}
              <button type="button" className="preset-card" onClick={() => add(blankGear(c.id))}>
                <strong>Custom</strong>
                <span>Name it and add its ports.</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

function GearList() {
  const project = useProject();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const used = (id: string) => project.diagrams.filter((d) => d.objects.some((o) => 'gearId' in o && o.gearId === id)).length;

  function exportCsv() {
    const rows: (string | number)[][] = [['Category', 'Name', 'Model', 'Qty', 'Power', 'Inputs', 'Outputs', 'Notes']];
    for (const g of project.gear) {
      const ports = (dir: 'in' | 'out') => g.ports.filter((p) => p.dir === dir).map((p) => `${p.name} (${p.connector})`).join('; ');
      rows.push([categoryInfo(g.category).label, g.name, g.model, g.qty, g.power, ports('in'), ports('out'), g.notes]);
    }
    downloadBlob(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }), `${safeFilename(project.name)}-gear.csv`);
  }

  return (
    <div className="stack">
      <div className="cluster" style={{ justifyContent: 'space-between' }}>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>
          Add gear
        </Button>
        <Button size="sm" variant="quiet" icon={<Download size={14} />} onClick={exportCsv} disabled={!project.gear.length}>
          CSV
        </Button>
      </div>
      {project.gear.length === 0 ? (
        <EmptyState title="No gear yet" body="Add your cameras, mics, recorders and lights. Each comes with typical inputs and outputs that you can rename or change, so the connections and cable list match your kit." action={<Button onClick={() => setAdding(true)}>Add the first item</Button>} />
      ) : (
        CATEGORIES.filter((c) => project.gear.some((g) => g.category === c.id)).map((c) => (
          <section key={c.id} aria-labelledby={`cat-${c.id}`}>
            <h2 id={`cat-${c.id}`} className="micro" style={{ marginBottom: 4 }}>
              {c.label}
            </h2>
            {project.gear
              .filter((g) => g.category === c.id)
              .map((g) => {
                const n = used(g.id);
                return (
                  <button key={g.id} type="button" className="gear-row" onClick={() => setEditing(g.id)}>
                    <span className="gear-code" aria-hidden="true">
                      {c.code}
                    </span>
                    <span className="row__main">
                      <span className="row__title">
                        {g.name}
                        {g.qty > 1 && <span className="mono muted"> ×{g.qty}</span>}
                      </span>
                      <span className="row__sub mono tiny">
                        {g.ports.filter((p) => p.dir === 'in').length} in · {g.ports.filter((p) => p.dir === 'out').length} out{g.power ? ` · ${g.power}` : ''}
                      </span>
                    </span>
                    <span className={`tag ${n ? 'tag--wash' : ''}`}>{n ? `On ${n} plan${n === 1 ? '' : 's'}` : 'Not placed'}</span>
                  </button>
                );
              })}
          </section>
        ))
      )}
      <AddGearSheet open={adding} onClose={() => setAdding(false)} />
      {editing && <GearEditor id={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

export function GearEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const project = useProject();
  const patch = useProjects((s) => s.patchCurrent);
  const g = project.gear.find((x) => x.id === id);
  const [deleting, setDeleting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  if (!g) return null;
  const set = (d: Partial<GearItem>) => patch((p) => ({ gear: p.gear.map((x) => (x.id === id ? { ...x, ...d } : x)) }));
  const setPort = (pid: string, d: Partial<GearPort>) => set({ ports: g.ports.map((p) => (p.id === pid ? { ...p, ...d } : p)) });
  const conns = project.connections.filter((c) => c.fromGear === id || c.toGear === id);
  const name = (gid: string) => project.gear.find((x) => x.id === gid)?.name ?? 'Removed item';
  const portName = (gid: string, pid: string) => project.gear.find((x) => x.id === gid)?.ports.find((p) => p.id === pid)?.name ?? '';

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={g.name}
        wide
        footer={
          <>
            <Button variant="danger" onClick={() => setDeleting(true)}>
              Delete
            </Button>
            <span style={{ flex: 1 }} />
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </>
        }
      >
        <div className="stack">
          <div className="grid-2">
            <TextField label="Name" value={g.name} onChange={(v) => set({ name: v })} hint="What you call it on set, e.g. A cam, Boom, Lav 1." />
            <TextField label="Make and model" value={g.model} onChange={(v) => set({ model: v })} />
          </div>
          <div className="grid-3">
            <SelectField label="Category" value={g.category} onChange={(v) => set({ category: v as GearCategory })} options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} />
            <Stepper label="Quantity" value={g.qty} onChange={(v) => set({ qty: Math.max(1, Math.round(v)) })} min={1} />
            <TextField label="Power" value={g.power} onChange={(v) => set({ power: v })} placeholder="NP-F, AA, Mains" list="power-types" />
          </div>
          <datalist id="power-types">
            {['LP-E17', 'LP-E6NH', 'NP-F', 'NP-FZ100', 'V-mount', 'AA', 'Mains', 'Internal', 'Phantom 48 V', 'Plug-in power', 'USB-C'].map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
          <Blueprint
            title="Inputs and outputs"
            index="I/O"
            aside={
              <Button size="sm" variant="quiet" icon={<Plus size={14} />} onClick={() => set({ ports: [...g.ports, { id: uid(), name: `Port ${g.ports.length + 1}`, dir: 'in', connector: 'XLR', signal: 'audio' }] })}>
                Port
              </Button>
            }
          >
            {g.ports.length === 0 ? (
              <p className="small muted">No inputs or outputs. Add one if this connects to anything.</p>
            ) : (
              <div className="stack stack--sm">
                {g.ports.map((p) => (
                  <div key={p.id} className="port-row">
                    <TextField label="Name" value={p.name} onChange={(v) => setPort(p.id, { name: v })} />
                    <SelectField label="Direction" value={p.dir} onChange={(v) => setPort(p.id, { dir: v as 'in' | 'out' })} options={[{ value: 'in', label: 'In' }, { value: 'out', label: 'Out' }]} />
                    <SelectField label="Connector" value={p.connector} onChange={(v) => setPort(p.id, { connector: v as Connector })} options={CONNECTORS.map((c) => ({ value: c, label: c }))} />
                    <SelectField label="Signal" value={p.signal} onChange={(v) => setPort(p.id, { signal: v as SignalKind })} options={SIGNALS.map((x) => ({ value: x.id, label: x.label }))} />
                    <Button size="sm" variant="ghost" iconOnly icon={<Trash2 size={14} />} onClick={() => patch((pr) => ({ gear: pr.gear.map((x) => (x.id === id ? { ...x, ports: x.ports.filter((q) => q.id !== p.id) } : x)), connections: pr.connections.filter((c) => !((c.fromGear === id && c.fromPort === p.id) || (c.toGear === id && c.toPort === p.id))) }))}>
                      Remove port
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Blueprint>
          <Blueprint
            title="Connected to"
            index="→"
            aside={
              <Button size="sm" variant="quiet" icon={<Cable size={14} />} onClick={() => setConnecting(true)}>
                Connect
              </Button>
            }
          >
            {conns.length === 0 ? (
              <p className="small muted">Nothing connected yet.</p>
            ) : (
              conns.map((c) => (
                <div key={c.id} className="conn-row">
                  <span className="conn-flow">
                    {c.fromGear === id ? `${portName(c.fromGear, c.fromPort)} → ${name(c.toGear)} · ${portName(c.toGear, c.toPort)}` : `${name(c.fromGear)} · ${portName(c.fromGear, c.fromPort)} → ${portName(c.toGear, c.toPort)}`}
                  </span>
                  <Button size="sm" variant="ghost" iconOnly icon={<Trash2 size={14} />} onClick={() => patch((pr) => ({ connections: pr.connections.filter((x) => x.id !== c.id) }))}>
                    Remove connection
                  </Button>
                </div>
              ))
            )}
          </Blueprint>
          <TextAreaField label="Notes" value={g.notes} onChange={(v) => set({ notes: v })} rows={2} placeholder="Serial number, settings, who owns it" />
        </div>
      </Sheet>
      <ConnectSheet open={connecting} onClose={() => setConnecting(false)} fromGear={g.ports.some((p) => p.dir === 'out') ? id : undefined} toGear={g.ports.some((p) => p.dir === 'out') ? undefined : id} />
      <Confirm
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => {
          patch((p) => ({
            gear: p.gear.filter((x) => x.id !== id),
            connections: p.connections.filter((c) => c.fromGear !== id && c.toGear !== id),
            diagrams: p.diagrams.map((d) => ({ ...d, objects: d.objects.map((o) => ('gearId' in o && o.gearId === id ? { ...o, gearId: undefined } : o)) })),
          }));
          onClose();
          toast('Gear removed');
        }}
        title={`Delete ${g.name}?`}
        body="Its connections are removed too. Anything placed on a plan stays, without gear assigned."
        confirmLabel="Delete"
        danger
      />
    </>
  );
}

/* ---------- Connections ---------- */

function Connections() {
  const project = useProject();
  const patch = useProjects((s) => s.patchCurrent);
  const [adding, setAdding] = useState(false);
  const [auto, setAuto] = useState(false);
  const [view, setView] = useState<'signal' | 'item'>('signal');
  const rows = project.connections.map((c) => {
    const fg = project.gear.find((g) => g.id === c.fromGear);
    const tg = project.gear.find((g) => g.id === c.toGear);
    const fp = fg?.ports.find((p) => p.id === c.fromPort);
    const tp = tg?.ports.find((p) => p.id === c.toPort);
    const ok = fg && tg && fp && tp ? check(fg, fp, tg, tp) : null;
    return { c, fg, tg, fp, tp, ok, cable: fp && tp ? cableFor(fp.connector, tp.connector) : null };
  });
  const issues = checkProduction(project.gear, project.connections);
  const cables = cableSummary(project.gear, project.connections);
  const ports = project.gear.reduce((a, g) => a + g.ports.length, 0);
  const used = usedPorts(project.connections).size;
  const missing = cables.reduce((a, c) => a + Math.max(0, c.need - c.owned), 0);
  function exportCsv() {
    const out: (string | number)[][] = [['Signal', 'From', 'Output', 'To', 'Input', 'Cable', 'Compatible', 'Notes']];
    for (const r of rows) out.push([r.fp?.signal ?? '', r.fg?.name ?? '', r.fp ? `${r.fp.name} (${r.fp.connector})` : '', r.tg?.name ?? '', r.tp ? `${r.tp.name} (${r.tp.connector})` : '', r.cable ?? 'None', r.ok ? (r.ok.ok ? 'Yes' : `No: ${r.ok.reason}`) : 'Missing item', r.c.notes]);
    downloadBlob(new Blob([toCsv(out)], { type: 'text/csv;charset=utf-8' }), `${safeFilename(project.name)}-connections.csv`);
  }
  const remove = (id: string) => patch((p) => ({ connections: p.connections.filter((x) => x.id !== id) }));
  const setNotes = (id: string, notes: string) => patch((p) => ({ connections: p.connections.map((x) => (x.id === id ? { ...x, notes } : x)) }));
  const row = ({ c, fg, tg, fp, tp, cable, ok }: (typeof rows)[number]) => (
    <div key={c.id} className={`conn-row ${ok && !ok.ok ? 'is-bad' : ''}`}>
      <span className="conn-flow">
        <span className="signal-dot" style={{ background: SIGNAL_COLOUR[fp?.signal ?? 'data'] }} aria-hidden="true" />
        <strong>{fg?.name ?? 'Missing item'}</strong>
        <span className="mono">{fp?.name}</span>
        <span aria-hidden="true">→</span>
        <span className="visually-hidden">into</span>
        <strong>{tg?.name ?? 'Missing item'}</strong>
        <span className="mono">{tp?.name}</span>
        <span className="tag">{fp?.signal === 'mount' ? 'Mounted' : cable ?? 'Wireless'}</span>
        {ok && !ok.ok && <span className="tag tag--danger">Not compatible: {ok.reason}</span>}
        <input className="input input--sm conn-notes" aria-label="Connection notes" placeholder="Notes" value={c.notes} onChange={(e) => setNotes(c.id, e.target.value)} />
      </span>
      <Button size="sm" variant="ghost" iconOnly icon={<Trash2 size={14} />} onClick={() => remove(c.id)}>
        Remove connection
      </Button>
    </div>
  );
  return (
    <div className="stack">
      <div className="cluster" style={{ justifyContent: 'space-between' }}>
        <div className="cluster">
          <Button variant="primary" icon={<Wand2 size={16} />} onClick={() => setAuto(true)} disabled={project.gear.length < 2}>
            Auto Connect everything
          </Button>
          <Button icon={<Cable size={16} />} onClick={() => setAdding(true)} disabled={project.gear.length < 2}>
            Connect by hand
          </Button>
        </div>
        <Button size="sm" variant="quiet" icon={<Download size={14} />} onClick={exportCsv} disabled={!rows.length}>
          CSV
        </Button>
      </div>
      <div className="readout-grid">
        <div className="readout"><span className="readout__label">Connections</span><span className="readout__value readout__value--sm">{rows.length}</span></div>
        <div className="readout"><span className="readout__label">Ports in use</span><span className="readout__value readout__value--sm">{used} / {ports}</span></div>
        <div className="readout"><span className="readout__label">Cables to find</span><span className="readout__value readout__value--sm">{missing}</span></div>
        <div className="readout"><span className="readout__label">Issues</span><span className="readout__value readout__value--sm">{issues.filter((i) => i.level !== 'info').length}</span></div>
      </div>
      {issues.length > 0 && (
        <Blueprint title="Missing and incompatible" index="!">
          <ul className="issue-list">
            {issues.map((i, n) => (
              <li key={n} className={`issue issue--${i.level}`}>{i.text}</li>
            ))}
          </ul>
        </Blueprint>
      )}
      {cables.length > 0 && (
        <Blueprint title="Cables needed" index="C">
          <table className="table equip-table">
            <thead>
              <tr><th>Cable</th><th className="qty">Need</th><th className="qty">Have</th><th className="qty">Bring</th></tr>
            </thead>
            <tbody>
              {cables.map((c) => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td className="qty">{c.need}</td>
                  <td className="qty">{c.owned}</td>
                  <td className="qty">{c.need > c.owned ? <strong>{c.need - c.owned}</strong> : '0'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Blueprint>
      )}
      {rows.length === 0 ? (
        <EmptyState title="Nothing connected yet" body="Use Auto Connect to join everything that fits, or connect an output to an input by hand, for example the boom mic into recorder input 1. Lines appear on the plan and cables go on the equipment list." />
      ) : (
        <>
          <Tabs value={view} onChange={setView} label="Group connections" tabs={[{ id: 'signal', label: 'By signal' }, { id: 'item', label: 'By item' }]} />
          {view === 'signal'
            ? SIGNALS.filter((s) => rows.some((r) => r.fp?.signal === s.id)).map((s) => (
                <Blueprint key={s.id} title={s.label} index={String(rows.filter((r) => r.fp?.signal === s.id).length)}>
                  {rows.filter((r) => r.fp?.signal === s.id).map(row)}
                </Blueprint>
              ))
            : project.gear
                .filter((g) => g.ports.length)
                .map((g) => {
                  const usage = portUsage(g, project.gear, project.connections);
                  return (
                    <Blueprint key={g.id} title={g.name} index={`${usage.filter((u) => u.connection).length}/${g.ports.length}`}>
                      <ul className="port-usage">
                        {usage.map(({ port, other, otherPort }) => (
                          <li key={port.id} className={other ? 'is-used' : ''}>
                            <span className="mono">{port.dir === 'in' ? 'IN ' : 'OUT'}</span> {port.name} <span className="micro">{port.connector}{port.standard ? ` · ${port.standard}` : ''}</span>
                            <span className="port-usage__to">{other ? `${other.name} · ${otherPort?.name}` : <span className="micro">free</span>}</span>
                          </li>
                        ))}
                      </ul>
                    </Blueprint>
                  );
                })}
        </>
      )}
      <ConnectSheet open={adding} onClose={() => setAdding(false)} />
      <AutoConnectSheet open={auto} onClose={() => setAuto(false)} />
    </div>
  );
}

/* ---------- Equipment list ---------- */

function Equipment() {
  const project = useProject();
  const patch = useProjects((s) => s.patchCurrent);
  const list = useMemo(() => equipmentList(project), [project]);
  const groups = Array.from(new Set(list.map((r) => r.group)));
  const total = list.reduce((a, r) => a + r.qty, 0);

  function exportCsv() {
    const rows: (string | number)[][] = [['Group', 'Item', 'Qty', 'Why']];
    for (const r of list) rows.push([r.group, r.name, r.qty, r.why]);
    downloadBlob(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }), `${safeFilename(project.name)}-equipment-list.csv`);
  }
  function toChecklist() {
    const have = new Set(project.checklist.map((i) => `${i.group}|${i.label}`.toLowerCase()));
    const fresh = list.filter((r) => !have.has(`${r.group}|${r.name}`.toLowerCase())).map((r, i) => ({ id: uid(), group: r.group, label: r.name, done: false, qty: r.qty, order: project.checklist.length + i + 1 }));
    patch((p) => ({ checklist: [...p.checklist, ...fresh] }));
    toast(fresh.length ? `Added ${fresh.length} items to the packing checklist` : 'The packing checklist already has everything');
  }

  if (!list.length) return <EmptyState title="Nothing to list yet" body="Add gear, place things on the shoot plan and connect them. Stands, sandbags, cables, batteries and cards are worked out for you." />;
  return (
    <div className="stack">
      <div className="cluster" style={{ justifyContent: 'space-between' }}>
        <span className="small muted">
          {list.length} lines · {total} items in total
        </span>
        <div className="cluster">
          <Button size="sm" variant="quiet" icon={<Download size={14} />} onClick={exportCsv}>
            CSV
          </Button>
          <Link to="/export" className="btn btn--sm btn--quiet">
            <Download size={14} /> PDF
          </Link>
          <Button size="sm" variant="primary" icon={<ClipboardCheck size={14} />} onClick={toChecklist}>
            Add to packing checklist
          </Button>
        </div>
      </div>
      {groups.map((g) => (
        <Blueprint key={g} title={g} index={String(list.filter((r) => r.group === g).reduce((a, r) => a + r.qty, 0))} padding="none">
          <table className="table equip-table">
            <tbody>
              {list
                .filter((r) => r.group === g)
                .map((r, i) => (
                  <tr key={`${r.name}-${i}`}>
                    <td className="qty">{r.qty}</td>
                    <td style={{ whiteSpace: 'normal' }}>{r.name}</td>
                    <td className="why">{r.why}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Blueprint>
      ))}
      <p className="tiny muted">Counts use the busiest set-up, because kit moves between set-ups. Batteries are one per device plus a spare; cards are two per recording device.</p>
    </div>
  );
}
