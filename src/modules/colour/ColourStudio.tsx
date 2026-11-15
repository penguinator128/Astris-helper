import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Download, Image as ImageIcon, Plus, Save, Trash2 } from 'lucide-react';
import { PageHead } from '@/components/PageHead';
import { Tabs } from '@/components/Tabs';
import { Blueprint } from '@/components/Blueprint';
import { Button } from '@/components/Button';
import { Segmented } from '@/components/Segmented';
import { SelectField, TextField } from '@/components/Field';
import { Sheet } from '@/components/Sheet';
import { EmptyState } from '@/components/EmptyState';
import { Readout } from '@/components/Readout';
import { useProject, useProjects } from '@/store/projects';
import { toast } from '@/store/toast';
import { uid } from '@/lib/id';
import { scheme, preset, SCHEMES, PRESETS, roughName, contrastRatio, extractPalette, type SchemeId, type PresetId } from '@/lib/colour/colour';
import { downloadDataUrl, safeFilename } from '@/lib/download';
import { Swatch } from './Swatch';
import { ColourPicker } from './ColourPicker';
import { renderColourScript } from './colourScriptImage';
import type { Palette } from '@/types/project';
import './colour.css';

type Tab = 'palette' | 'extract' | 'contrast' | 'script' | 'saved';

export default function ColourStudio() {
  const [tab, setTab] = useState<Tab>('palette');
  const project = useProject();
  return (
    <main className="page">
      <PageHead index="Toolkit · Colour" title="Colour Studio" sub="Palettes in OKLCH, extraction from stills, contrast checks and a colour script for the project." />
      <div className="stack">
        <Tabs
          value={tab}
          onChange={setTab}
          label="Colour tools"
          tabs={[
            { id: 'palette', label: 'Palette' },
            { id: 'extract', label: 'Extract' },
            { id: 'contrast', label: 'Contrast' },
            { id: 'script', label: 'Colour script' },
            { id: 'saved', label: `Saved (${project.palettes.length})` },
          ]}
        />
        {tab === 'palette' && <PaletteTab />}
        {tab === 'extract' && <ExtractTab />}
        {tab === 'contrast' && <ContrastTab />}
        {tab === 'script' && <ScriptTab />}
        {tab === 'saved' && <SavedTab />}
      </div>
    </main>
  );
}

function useSavePalette() {
  const patch = useProjects((s) => s.patchCurrent);
  return (name: string, swatches: string[], schemeName: string) => {
    const palette: Palette = { id: uid(), name: name.trim() || schemeName, swatches: swatches.map((hex) => ({ hex, name: roughName(hex) })), scheme: schemeName, updatedAt: Date.now() };
    patch((p) => ({ palettes: [palette, ...p.palettes] }));
    toast(`Saved “${palette.name}”`);
    return palette;
  };
}

function SaveSheet({ open, onClose, swatches, defaultName, schemeName }: { open: boolean; onClose: () => void; swatches: string[]; defaultName: string; schemeName: string }) {
  const save = useSavePalette();
  const [name, setName] = useState('');
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Save palette"
      footer={
        <Button
          variant="primary"
          block
          onClick={() => {
            save(name || defaultName, swatches, schemeName);
            setName('');
            onClose();
          }}
        >
          Save to project
        </Button>
      }
    >
      <div className="stack">
        <TextField label="Palette name" value={name} onChange={setName} placeholder={defaultName} autoFocus />
        <div className="cluster">
          {swatches.map((hex) => (
            <span key={hex} style={{ width: 32, height: 32, background: hex, border: '1px solid var(--hair-strong)', borderRadius: 4 }} />
          ))}
        </div>
      </div>
    </Sheet>
  );
}

function PaletteTab() {
  const [hex, setHex] = useState('#ffc400');
  const [mode, setMode] = useState<'scheme' | 'preset'>('scheme');
  const [schemeId, setSchemeId] = useState<SchemeId>('complementary');
  const [presetId, setPresetId] = useState<PresetId>('teal-orange');
  const [saving, setSaving] = useState(false);
  const swatches = useMemo(() => (mode === 'scheme' ? scheme(hex, schemeId) : preset(hex, presetId)), [hex, mode, schemeId, presetId]);
  const schemeName = mode === 'scheme' ? SCHEMES.find((s) => s.id === schemeId)!.name : PRESETS.find((p) => p.id === presetId)!.name;
  const presetNote = PRESETS.find((p) => p.id === presetId)?.note;

  return (
    <div className="tool">
      <div className="tool__controls stack">
        <Blueprint title="Start colour" index="01">
          <ColourPicker value={hex} onChange={setHex} />
        </Blueprint>
        <Blueprint title="Build around it" index="02">
          <div className="stack">
            <Segmented
              value={mode}
              onChange={setMode}
              block
              label="Palette type"
              options={[
                { value: 'scheme', label: 'Harmony' },
                { value: 'preset', label: 'Film look' },
              ]}
            />
            {mode === 'scheme' ? (
              <SelectField label="Harmony" value={schemeId} onChange={(v) => setSchemeId(v as SchemeId)} options={SCHEMES.map((s) => ({ value: s.id, label: s.name }))} />
            ) : (
              <SelectField label="Look" value={presetId} onChange={(v) => setPresetId(v as PresetId)} options={PRESETS.map((p) => ({ value: p.id, label: p.name }))} hint={presetNote} />
            )}
          </div>
        </Blueprint>
      </div>
      <div className="tool__results stack">
        <Blueprint
          title={schemeName}
          index="03"
          aside={
            <Button size="sm" variant="primary" icon={<Save size={14} />} onClick={() => setSaving(true)}>
              Save
            </Button>
          }
        >
          <div className="swatches">
            {swatches.map((h, i) => (
              <Swatch key={`${h}-${i}`} hex={h} name={roughName(h)} />
            ))}
          </div>
          <p className="tiny muted" style={{ marginTop: 'var(--s-3)' }}>
            Tap a swatch to copy its hex. Hues rotate in OKLCH so lightness stays even across the set.
          </p>
        </Blueprint>
      </div>
      <SaveSheet open={saving} onClose={() => setSaving(false)} swatches={swatches} defaultName={`${schemeName} from ${hex}`} schemeName={schemeName} />
    </div>
  );
}

function ExtractTab() {
  const [src, setSrc] = useState<string | null>(null);
  const [swatches, setSwatches] = useState<string[]>([]);
  const [k, setK] = useState(6);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function run(file: File, count = k) {
    setBusy(true);
    const url = URL.createObjectURL(file);
    setSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, 240 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bmp.width * s));
    canvas.height = Math.max(1, Math.round(bmp.height * s));
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    setSwatches(extractPalette(data, count));
    setBusy(false);
  }

  const lastFile = useRef<File | null>(null);

  return (
    <div className="tool">
      <div className="tool__controls stack">
        <Blueprint title="Still" index="01">
          <div className="stack">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="visually-hidden"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  lastFile.current = f;
                  void run(f);
                }
              }}
            />
            <Button icon={<ImageIcon size={16} />} onClick={() => fileRef.current?.click()}>
              Choose an image
            </Button>
            {src && <img src={src} alt="Uploaded still" className="extract-preview" />}
            <Segmented
              value={String(k)}
              onChange={(v) => {
                setK(Number(v));
                if (lastFile.current) void run(lastFile.current, Number(v));
              }}
              block
              mono
              label="Number of colours"
              options={[3, 4, 5, 6, 8].map((n) => ({ value: String(n), label: `${n}` }))}
            />
            <p className="tiny muted">The image never leaves this device. Colours are clustered with k-means on a downscaled copy.</p>
          </div>
        </Blueprint>
      </div>
      <div className="tool__results stack">
        {swatches.length === 0 ? (
          <EmptyState title="No still yet" body="Pick a frame, reference photo or location scout shot to pull its dominant colours." />
        ) : (
          <Blueprint
            title={busy ? 'Extracting…' : 'Extracted palette'}
            index="02"
            aside={
              <Button size="sm" variant="primary" icon={<Save size={14} />} onClick={() => setSaving(true)}>
                Save
              </Button>
            }
          >
            <div className="swatches">
              {swatches.map((h, i) => (
                <Swatch key={`${h}-${i}`} hex={h} name={roughName(h)} />
              ))}
            </div>
          </Blueprint>
        )}
      </div>
      <SaveSheet open={saving} onClose={() => setSaving(false)} swatches={swatches} defaultName="Extracted from still" schemeName="Extracted" />
    </div>
  );
}

function ContrastTab() {
  const [fg, setFg] = useState('#0b0b0c');
  const [bg, setBg] = useState('#ffc400');
  const ratio = contrastRatio(fg, bg);
  const pass = (min: number) => (ratio >= min ? 'Pass' : 'Fail');
  return (
    <div className="tool">
      <div className="tool__controls stack">
        <Blueprint title="Text" index="01">
          <ColourPicker value={fg} onChange={setFg} label="Text colour" />
        </Blueprint>
        <Blueprint title="Background" index="02">
          <ColourPicker value={bg} onChange={setBg} label="Background colour" />
        </Blueprint>
      </div>
      <div className="tool__results stack">
        <Blueprint tone="yellow" aria-live="polite" aria-label="Contrast result">
          <div className="readout-grid">
            <Readout label="Contrast ratio" value={`${ratio.toFixed(2)}:1`} size="lg" />
            <Readout label="Body text AA" value={pass(4.5)} size="sm" sub="4.5:1 minimum" />
            <Readout label="Large text AA" value={pass(3)} size="sm" sub="3:1 at 24 px or 19 px bold" />
            <Readout label="Body text AAA" value={pass(7)} size="sm" sub="7:1 minimum" />
          </div>
        </Blueprint>
        <div className="contrast-preview" style={{ background: bg, color: fg }}>
          <span className="micro" style={{ color: fg }}>
            Title card preview
          </span>
          <h3>Night exterior, the river</h3>
          <p className="small">Lower-third name and role at body size, to judge legibility over the colour.</p>
        </div>
        <Button
          variant="quiet"
          size="sm"
          onClick={() => {
            setFg(bg);
            setBg(fg);
          }}
        >
          Swap colours
        </Button>
      </div>
    </div>
  );
}

function ScriptTab() {
  const project = useProject();
  const patch = useProjects((s) => s.patchCurrent);
  const scenes = project.colourScript.slice().sort((a, b) => a.order - b.order);

  function update(id: string, delta: Partial<(typeof scenes)[number]>) {
    patch((p) => ({ colourScript: p.colourScript.map((s) => (s.id === id ? { ...s, ...delta } : s)) }));
  }
  function add() {
    const n = scenes.length + 1;
    const last = scenes[scenes.length - 1];
    patch((p) => ({ colourScript: [...p.colourScript, { id: uid(), label: `Scene ${n}`, colour: last?.colour ?? '#e0ab00', mood: '', order: n }] }));
  }
  function move(id: string, dir: -1 | 1) {
    const idx = scenes.findIndex((s) => s.id === id);
    const j = idx + dir;
    if (j < 0 || j >= scenes.length) return;
    const reordered = scenes.slice();
    [reordered[idx], reordered[j]] = [reordered[j], reordered[idx]];
    patch({ colourScript: reordered.map((s, i) => ({ ...s, order: i + 1 })) });
  }
  function remove(id: string) {
    patch((p) => ({ colourScript: p.colourScript.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i + 1 })) }));
  }
  function exportPng() {
    if (scenes.length === 0) return;
    downloadDataUrl(renderColourScript(scenes, project.name), `${safeFilename(project.name)}-colour-script.png`);
    toast('Colour script exported');
  }

  return (
    <div className="stack">
      <Blueprint
        title="Colour script"
        index="01"
        aside={
          <div className="cluster">
            <Button size="sm" variant="quiet" icon={<Download size={14} />} onClick={exportPng} disabled={scenes.length === 0}>
              PNG
            </Button>
            <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={add}>
              Scene
            </Button>
          </div>
        }
      >
        {scenes.length === 0 ? (
          <EmptyState title="No scenes in the colour script" body="Add one block per scene with its dominant colour and a mood note. The strip exports as an image and appears in the Shoot Pack." action={<Button size="sm" onClick={add}>Add first scene</Button>} />
        ) : (
          <div className="stack">
            <div className="strip" aria-label="Colour script strip">
              {scenes.map((s, i) => {
                const ink = contrastRatio(s.colour, '#000') >= contrastRatio(s.colour, '#fff') ? '#0b0b0c' : '#fafaf7';
                return (
                  <div key={s.id} className="strip__scene" style={{ background: s.colour, color: ink }}>
                    <span className="micro">{String(i + 1).padStart(2, '0')}</span>
                    <strong>{s.label || `Scene ${i + 1}`}</strong>
                    <span className="tiny">{s.mood}</span>
                  </div>
                );
              })}
            </div>
            <div>
              {scenes.map((s, i) => (
                <div key={s.id} className="scene-row">
                  <div className="scene-row__chip" style={{ background: s.colour }}>
                    <input type="color" value={s.colour} onChange={(e) => update(s.id, { colour: e.target.value })} aria-label={`Colour for ${s.label}`} />
                  </div>
                  <TextField label={`Scene ${i + 1}`} value={s.label} onChange={(v) => update(s.id, { label: v })} />
                  <TextField label="Mood" value={s.mood} onChange={(v) => update(s.id, { mood: v })} placeholder="e.g. cold, isolated" />
                  <div className="cluster" style={{ flexWrap: 'nowrap' }}>
                    <Button size="sm" variant="ghost" iconOnly icon={<ArrowUp size={14} />} onClick={() => move(s.id, -1)} disabled={i === 0}>
                      Move up
                    </Button>
                    <Button size="sm" variant="ghost" iconOnly icon={<ArrowDown size={14} />} onClick={() => move(s.id, 1)} disabled={i === scenes.length - 1}>
                      Move down
                    </Button>
                    <Button size="sm" variant="ghost" iconOnly icon={<Trash2 size={14} />} onClick={() => remove(s.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Blueprint>
    </div>
  );
}

function SavedTab() {
  const project = useProject();
  const patch = useProjects((s) => s.patchCurrent);
  const [renaming, setRenaming] = useState<Palette | null>(null);
  const [name, setName] = useState('');
  if (project.palettes.length === 0) {
    return <EmptyState title="No saved palettes" body="Build a harmony or extract one from a still, then save it here. Saved palettes can be applied to frames and attached to shots." />;
  }
  return (
    <div className="stack">
      {project.palettes.map((pal) => (
        <Blueprint
          key={pal.id}
          title={pal.name}
          index={pal.scheme}
          aside={
            <div className="cluster">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setRenaming(pal);
                  setName(pal.name);
                }}
              >
                Rename
              </Button>
              <Button size="sm" variant="ghost" iconOnly icon={<Trash2 size={14} />} onClick={() => patch((p) => ({ palettes: p.palettes.filter((x) => x.id !== pal.id) }))}>
                Delete palette
              </Button>
            </div>
          }
        >
          <div className="swatches">
            {pal.swatches.map((s, i) => (
              <Swatch key={`${s.hex}-${i}`} hex={s.hex} name={s.name} compact />
            ))}
          </div>
        </Blueprint>
      ))}
      <Sheet
        open={renaming != null}
        onClose={() => setRenaming(null)}
        title="Rename palette"
        footer={
          <Button
            variant="primary"
            block
            onClick={() => {
              if (renaming) patch((p) => ({ palettes: p.palettes.map((x) => (x.id === renaming.id ? { ...x, name: name.trim() || x.name } : x)) }));
              setRenaming(null);
            }}
          >
            Save
          </Button>
        }
      >
        <TextField label="Name" value={name} onChange={setName} autoFocus />
      </Sheet>
    </div>
  );
}
