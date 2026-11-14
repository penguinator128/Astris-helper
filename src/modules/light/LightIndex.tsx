import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Sheet } from '@/components/Sheet';
import { useProject, useProjects } from '@/store/projects';
import { useSettings } from '@/store/settings';
import { getSensor } from '@/lib/calc/sensors';
import { fieldOfView } from '@/lib/calc/optics';
import { fmtDate } from '@/lib/format';
import { uid } from '@/lib/id';
import { toast } from '@/store/toast';
import { PRESETS, newDiagram, blankDiagram } from './presets';
import { renderDiagramPng } from './diagramPng';
import type { LightingDiagram } from '@/types/project';
import './light.css';

function Thumb({ d, fov, theme }: { d: LightingDiagram; fov: number; theme: 'light' | 'dark' }) {
  const src = useMemo(() => renderDiagramPng(d.objects, 320, 240, fov, theme, 1.5), [d.objects, fov, theme]);
  return <img src={src} alt="" className="diagram-thumb" />;
}

export default function LightIndex() {
  const project = useProject();
  const patch = useProjects((s) => s.patchCurrent);
  const theme = useSettings((s) => s.theme);
  const nav = useNavigate();
  const [picking, setPicking] = useState(false);
  const sensor = getSensor(project.camera.sensorId, project.camera.customSensor);
  const fov = fieldOfView(project.camera.focalLength, sensor.width, sensor.height).horizontal;
  const diagrams = project.diagrams.slice().sort((a, b) => b.updatedAt - a.updatedAt);

  function create(presetId: string | 'blank') {
    const name = `Diagram ${project.diagrams.length + 1}`;
    const d = presetId === 'blank' ? blankDiagram(name) : newDiagram(name, presetId);
    patch((p) => ({ diagrams: [...p.diagrams, d] }));
    setPicking(false);
    nav(`/light/${d.id}`);
  }

  return (
    <main className="page">
      <PageHead
        index="02 · Light"
        title="Lighting Diagram"
        sub="Top-down plans with a live 3D preview, exposure ratio and colour mix."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setPicking(true)}>
            New diagram
          </Button>
        }
      />
      {diagrams.length === 0 ? (
        <EmptyState title="No lighting diagrams yet" body="Start from a classic setup like three-point or Rembrandt, then drag lights into place and watch the mannequin update." action={<Button onClick={() => setPicking(true)}>Start a diagram</Button>} />
      ) : (
        <div className="diagram-cards">
          {diagrams.map((d) => (
            <div key={d.id} className="bp frame-card" style={{ padding: 'var(--s-2)' }}>
              <button type="button" style={{ display: 'block', width: '100%' }} onClick={() => nav(`/light/${d.id}`)} aria-label={`Open ${d.name}`}>
                <Thumb d={d} fov={fov} theme={theme} />
              </button>
              <div className="frame-card__meta">
                <div>
                  <div style={{ fontWeight: 500 }}>{d.name}</div>
                  <div className="tiny muted mono">
                    {d.objects.filter((o) => o.type === 'light').length} lights · {fmtDate(new Date(d.updatedAt))}
                  </div>
                </div>
                <div className="cluster" style={{ flexWrap: 'nowrap' }}>
                  <Button
                    size="sm"
                    variant="ghost"
                    iconOnly
                    icon={<Copy size={14} />}
                    onClick={() => {
                      const copy: LightingDiagram = { ...structuredClone(d), id: uid(), name: `${d.name} copy`, updatedAt: Date.now() };
                      patch((p) => ({ diagrams: [...p.diagrams, copy] }));
                      toast('Diagram duplicated');
                    }}
                  >
                    Duplicate
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    iconOnly
                    icon={<Trash2 size={14} />}
                    onClick={() => {
                      patch((p) => ({ diagrams: p.diagrams.filter((x) => x.id !== d.id), shots: p.shots.map((s) => (s.diagramId === d.id ? { ...s, diagramId: undefined } : s)) }));
                      toast('Diagram deleted');
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={picking} onClose={() => setPicking(false)} title="Start from" wide>
        <div className="preset-grid">
          <button type="button" className="preset-card" onClick={() => create('blank')}>
            <strong>Blank</strong>
            <span>Subject and camera only.</span>
          </button>
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className="preset-card" onClick={() => create(p.id)}>
              <strong>{p.name}</strong>
              <span>{p.note}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </main>
  );
}
