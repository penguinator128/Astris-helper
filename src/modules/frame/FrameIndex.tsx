import { useNavigate } from 'react-router';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { PageHead } from '@/components/PageHead';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { useProject, useProjects } from '@/store/projects';
import { emptyComposition } from '@/store/actions';
import { CompositionSvg } from './CompositionSvg';
import { classifyShotSize } from '@/lib/frame/shotSize';
import { fmtDate } from '@/lib/format';
import { uid } from '@/lib/id';
import { toast } from '@/store/toast';
import './frame.css';

export default function FrameIndex() {
  const project = useProject();
  const patch = useProjects((s) => s.patchCurrent);
  const nav = useNavigate();
  const comps = project.compositions.slice().sort((a, b) => b.updatedAt - a.updatedAt);

  function create() {
    const c = emptyComposition(`Frame ${project.compositions.length + 1}`, project.camera.focalLength, project.camera.aperture);
    patch((p) => ({ compositions: [...p.compositions, c] }));
    nav(`/frame/${c.id}`);
  }

  return (
    <main className="page">
      <PageHead
        index="03 · Frame"
        title="Shot Designer"
        sub="Compose frames with guides and silhouettes, tied to your lens."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={create}>
            New frame
          </Button>
        }
      />
      {comps.length === 0 ? (
        <EmptyState title="No frames in this project" body="Start a frame to block a shot: pick an aspect ratio, place figures, and read the shot size and lens coverage." action={<Button onClick={create}>Start a frame</Button>} />
      ) : (
        <div className="frame-cards">
          {comps.map((c) => {
            const pal = project.palettes.find((p) => p.id === c.paletteId) ?? null;
            return (
              <div key={c.id} className="bp frame-card" style={{ padding: 'var(--s-2)' }}>
                <button type="button" className="frame-thumb" onClick={() => nav(`/frame/${c.id}`)} aria-label={`Open ${c.name}`}>
                  <CompositionSvg comp={c} palette={pal} showLabels={false} />
                </button>
                <div className="frame-card__meta">
                  <div>
                    <div style={{ fontWeight: 500 }}>{c.name}</div>
                    <div className="tiny muted mono">
                      {c.aspect} · {classifyShotSize(c.elements) ?? '—'} · {c.focalLength} mm · {fmtDate(new Date(c.updatedAt))}
                    </div>
                  </div>
                  <div className="cluster" style={{ flexWrap: 'nowrap' }}>
                    <Button
                      size="sm"
                      variant="ghost"
                      iconOnly
                      icon={<Copy size={14} />}
                      onClick={() => {
                        const copy = { ...structuredClone(c), id: uid(), name: `${c.name} copy`, updatedAt: Date.now() };
                        patch((p) => ({ compositions: [...p.compositions, copy] }));
                        toast('Frame duplicated');
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
                        patch((p) => ({ compositions: p.compositions.filter((x) => x.id !== c.id) }));
                        toast('Frame deleted');
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
