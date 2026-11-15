import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Download, FileDown, FileJson, Upload, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { PageHead } from '@/components/PageHead';
import { Blueprint } from '@/components/Blueprint';
import { Button } from '@/components/Button';
import { Check } from '@/components/Field';
import { Segmented } from '@/components/Segmented';
import { Confirm } from '@/components/Sheet';
import { useProject, useProjects } from '@/store/projects';
import { useSettings } from '@/store/settings';
import { toast } from '@/store/toast';
import { downloadBlob, downloadDataUrl, safeFilename } from '@/lib/download';
import { exportAll, exportProject, importFile } from '@/lib/backup';
import { todayIso } from '@/lib/format';
import { getSensor } from '@/lib/calc/sensors';
import { fieldOfView } from '@/lib/calc/optics';
import { renderDiagramPng } from '@/modules/light/diagramPng';
import { renderColourScript } from '@/modules/colour/colourScriptImage';
import { SECTIONS, sectionCount, type SectionId } from './pdf/sections';

export default function ExportPage() {
  const project = useProject();
  const projects = useProjects((s) => s.projects);
  const settings = useSettings();
  const defaults = useMemo(() => {
    const on = new Set<SectionId>();
    for (const s of SECTIONS) {
      const n = sectionCount(s.id, project);
      if (n == null || n > 0) on.add(s.id);
    }
    return on;
    // Defaults are computed once per project.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);
  const [selected, setSelected] = useState<Set<SectionId>>(defaults);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [busy, setBusy] = useState<string | null>(null);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function toggle(id: SectionId, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function makePdf() {
    setBusy('Preparing');
    try {
      await document.fonts.ready;
      const { buildShootPack } = await import('./pdf/shootPack');
      const blob = await buildShootPack(project, settings, {
        sections: SECTIONS.map((s) => s.id).filter((id) => selected.has(id)),
        orientation,
        onProgress: (label) => setBusy(label),
      });
      const name = `${safeFilename(project.name)}-shoot-pack-${todayIso()}.pdf`;
      downloadBlob(blob, name);
      if (lastUrl) URL.revokeObjectURL(lastUrl);
      setLastUrl(URL.createObjectURL(blob));
      toast('Shoot Pack saved');
    } catch (e) {
      toast(e instanceof Error ? `PDF failed: ${e.message}` : 'PDF failed');
    } finally {
      setBusy(null);
    }
  }

  async function saveProjectJson() {
    const data = await exportProject(project);
    downloadBlob(new Blob([JSON.stringify(data)], { type: 'application/json' }), `${safeFilename(project.name)}-${todayIso()}.astris.json`);
    toast('Project exported');
  }
  async function saveBackup() {
    const data = await exportAll(Object.values(projects));
    downloadBlob(new Blob([JSON.stringify(data)], { type: 'application/json' }), `astris-field-kit-backup-${todayIso()}.json`);
    toast(`Backed up ${Object.keys(projects).length} projects`);
  }
  async function runImport(file: File) {
    try {
      const res = await importFile(await file.text());
      toast(`Imported ${res.imported.join(', ')}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Import failed');
    }
  }

  const sensor = getSensor(project.camera.sensorId, project.camera.customSensor);
  const fov = fieldOfView(project.camera.focalLength, sensor.width, sensor.height).horizontal;
  const any = selected.size > 0;

  return (
    <main className="page">
      <PageHead index="12 · Export" title="Shoot Pack" sub={`A branded PDF of ${project.name}, plus image and backup exports.`} />
      <div className="tool">
        <div className="stack">
          <Blueprint title="Include" index="01">
            <div className="stack stack--sm">
              {SECTIONS.map((s) => {
                const n = sectionCount(s.id, project);
                return (
                  <div key={s.id} className="cluster" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                    <Check label={s.label} checked={selected.has(s.id)} onChange={(v) => toggle(s.id, v)} />
                    {n != null && <span className={`tag ${n === 0 ? '' : 'tag--wash'}`}>{n}</span>}
                  </div>
                );
              })}
              <div className="cluster">
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(SECTIONS.map((s) => s.id)))}>
                  All
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(defaults)}>
                  Only sections with content
                </Button>
              </div>
            </div>
          </Blueprint>
          <Blueprint title="Page" index="02">
            <div className="stack">
              <Segmented
                value={orientation}
                onChange={setOrientation}
                block
                label="Page orientation"
                options={[
                  { value: 'portrait', label: 'A4 portrait' },
                  { value: 'landscape', label: 'A4 landscape' },
                ]}
              />
              <p className="tiny muted">Landscape suits wide shot lists and storyboards. Text stays vector in Inter Tight and IBM Plex Mono; frames and diagrams are embedded as high-resolution images.</p>
            </div>
          </Blueprint>
        </div>

        <div className="stack">
          <Blueprint tone="yellow" aria-live="polite" aria-label="Generate PDF">
            <div className="stack">
              <div>
                <span className="readout__label">Shoot Pack</span>
                <div className="readout__value readout__value--sm">{busy ? `${busy}…` : `${selected.size} section${selected.size === 1 ? '' : 's'}`}</div>
              </div>
              <div className="cluster">
                <Button variant="default" size="lg" icon={<FileDown size={18} />} onClick={() => void makePdf()} disabled={!any || !!busy} style={{ background: 'var(--ink)', color: 'var(--yellow)', borderColor: 'var(--ink)' }}>
                  {busy ? 'Building PDF' : 'Download PDF'}
                </Button>
                {lastUrl && !busy && (
                  <a className="btn btn--lg btn--ghost" href={lastUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--ink)' }}>
                    <ExternalLink size={16} /> Open last
                  </a>
                )}
              </div>
            </div>
          </Blueprint>

          <Blueprint title="Images" index="03">
            <div className="stack stack--sm">
              {project.compositions.length === 0 && project.diagrams.length === 0 && project.colourScript.length === 0 ? (
                <p className="small muted">
                  Frames, lighting diagrams and the colour script export as PNG from here once they exist. Award cards export from <Link to="/awards">Awards</Link>.
                </p>
              ) : (
                <div className="rows">
                  {project.compositions.map((c) => (
                    <div key={c.id} className="row" style={{ gridTemplateColumns: '36px 1fr auto' }}>
                      <span className="row__idx">FR</span>
                      <span className="row__main">
                        <span className="row__title small">{c.name}</span>
                        <span className="row__sub tiny mono">
                          {c.aspect} · {c.focalLength} mm
                        </span>
                      </span>
                      <Button
                        size="sm"
                        variant="quiet"
                        icon={<ImageIcon size={14} />}
                        onClick={async () => {
                          const { compositionPng } = await import('./pdf/raster');
                          downloadDataUrl(await compositionPng(c, project, 2400), `${safeFilename(project.name)}-${safeFilename(c.name)}.png`);
                        }}
                      >
                        PNG
                      </Button>
                    </div>
                  ))}
                  {project.diagrams.map((d) => (
                    <div key={d.id} className="row" style={{ gridTemplateColumns: '36px 1fr auto' }}>
                      <span className="row__idx">LT</span>
                      <span className="row__main">
                        <span className="row__title small">{d.name}</span>
                        <span className="row__sub tiny mono">{d.objects.filter((o) => o.type === 'light').length} lights</span>
                      </span>
                      <Button size="sm" variant="quiet" icon={<ImageIcon size={14} />} onClick={() => downloadDataUrl(renderDiagramPng(d.objects, 1600, 1200, fov, 'light', 1), `${safeFilename(project.name)}-${safeFilename(d.name)}.png`)}>
                        PNG
                      </Button>
                    </div>
                  ))}
                  {project.colourScript.length > 0 && (
                    <div className="row" style={{ gridTemplateColumns: '36px 1fr auto' }}>
                      <span className="row__idx">CS</span>
                      <span className="row__main">
                        <span className="row__title small">Colour script</span>
                        <span className="row__sub tiny mono">{project.colourScript.length} scenes</span>
                      </span>
                      <Button size="sm" variant="quiet" icon={<ImageIcon size={14} />} onClick={() => downloadDataUrl(renderColourScript(project.colourScript, project.name), `${safeFilename(project.name)}-colour-script.png`)}>
                        PNG
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Blueprint>

          <Blueprint title="Backup" index="04">
            <div className="stack">
              <p className="small muted">Everything stays on this device. Export JSON to move a project to another phone or keep a backup. Images are included.</p>
              <div className="cluster">
                <Button icon={<FileJson size={16} />} onClick={() => void saveProjectJson()}>
                  This project
                </Button>
                <Button icon={<Download size={16} />} onClick={() => void saveBackup()}>
                  All projects
                </Button>
                <Button variant="quiet" icon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>
                  Import
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="visually-hidden"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) setPendingImport(f);
                  }}
                />
              </div>
            </div>
          </Blueprint>
        </div>
      </div>
      <Confirm
        open={pendingImport != null}
        onClose={() => setPendingImport(null)}
        onConfirm={() => {
          if (pendingImport) void runImport(pendingImport);
        }}
        title="Import this file?"
        body={`${pendingImport?.name ?? ''} will be added alongside your current projects. Nothing existing is overwritten; a project that already exists arrives as a copy.`}
        confirmLabel="Import"
      />
    </main>
  );
}
