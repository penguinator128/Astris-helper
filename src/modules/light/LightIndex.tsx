import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Boxes, Copy, FileDown, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
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
import type { GearItem, LightingDiagram, Connection } from '@/types/project';
import { planLinks } from '@/lib/gear/catalog';
import './light.css';

function Thumb({ d, fov, theme, gear, connections }: { d: LightingDiagram; fov: number; theme: 'light' | 'dark'; gear: GearItem[]; connections: Connection[] }) {
  const src = useMemo(() => renderDiagramPng(d.objects, 320, 240, fov, theme, 1.5, 'all', planLinks(d.objects, gear, connections)), [d.objects, fov, theme, gear, connections]);
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
    const name = `Set-up ${project.diagrams.length + 1}`;
    const d = presetId === 'blank' ? blankDiagram(name) : newDiagram(name, presetId);
    patch((p) => ({ diagrams: [...p.diagrams, d] }));
    setPicking(false);
    nav(`/plan/${d.id}`);
  }

  return (
    <main className="page">
      <PageHead
        index="01 · Shoot plan"
        title="Shoot Plan"
        sub="One top-down plan per set-up: cameras, lighting, audio and home base, with a view for each and the connections between them."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setPicking(true)}>
            New set-up
          </Button>
        }
      />
      <div className="cluster" style={{ marginBottom: 'var(--s-4)' }}>
        <Link to="/gear" className="btn btn--sm btn--quiet">
          <Boxes size={14} /> Gear, connections and equipment list
        </Link>
        <Link to="/export" className="btn btn--sm btn--quiet">
          <FileDown size={14} /> Download Shoot Pack
        </Link>
      </div>
      {diagrams.length === 0 ? (
        <EmptyState title="No set-ups yet" body="Start a set-up for each scene or location. Place talent, cameras, lights, mics and recorders, mark home base, then switch views to plan each department." action={<Button onClick={() => setPicking(true)}>Start the first set-up</Button>} />
      ) : (
        <div className="diagram-cards">
          {diagrams.map((d) => (
            <div key={d.id} className="bp frame-card" style={{ padding: 'var(--s-2)' }}>
              <button type="button" style={{ display: 'block', width: '100%' }} onClick={() => nav(`/plan/${d.id}`)} aria-label={`Open ${d.name}`}>
                <Thumb d={d} fov={fov} theme={theme} gear={project.gear} connections={project.connections} />
              </button>
              <div className="frame-card__meta">
                <div>
                  <div style={{ fontWeight: 500 }}>{d.name}</div>
                  <div className="tiny muted mono">
                    {d.objects.filter((o) => o.type === 'camera').length} cam · {d.objects.filter((o) => o.type === 'light').length} lights · {d.objects.filter((o) => o.type === 'gear').length} gear · {fmtDate(new Date(d.updatedAt))}
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
                      toast('Set-up duplicated');
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
                      toast('Set-up deleted');
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
            <span>Talent and a camera. Add lights, audio and base from there.</span>
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
