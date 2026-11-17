import { useState } from 'react';
import { FileText, Printer, Download } from 'lucide-react';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { SelectField } from '@/components/Field';
import { useProject } from '@/store/projects';
import { useSettings } from '@/store/settings';
import { toast } from '@/store/toast';
import { downloadBlob, safeFilename } from '@/lib/download';

/** Camera department setup sheet: pick a set-up, then download or print. */
export function CameraSheetButton({ diagramId, size = 'sm' }: { diagramId?: string; size?: 'sm' | 'md' }) {
  const project = useProject();
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const [which, setWhich] = useState(diagramId ?? 'all');
  const [busy, setBusy] = useState<null | 'pdf' | 'print'>(null);

  async function make(): Promise<Blob> {
    const { buildCameraSheet } = await import('./pdf/cameraSheet');
    return buildCameraSheet(project, settings, { diagramId: which === 'all' ? undefined : which });
  }
  async function download() {
    setBusy('pdf');
    try {
      const blob = await make();
      const scene = project.diagrams.find((d) => d.id === which)?.name;
      downloadBlob(blob, `${safeFilename(project.name)}-camera-sheet${scene ? `-${safeFilename(scene)}` : ''}.pdf`);
      toast('Camera sheet downloaded');
    } catch {
      toast('Could not make the camera sheet. Try again.');
    } finally {
      setBusy(null);
    }
  }
  async function print() {
    setBusy('print');
    try {
      const blob = await make();
      const url = URL.createObjectURL(blob);
      const frame = document.createElement('iframe');
      frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
      frame.src = url;
      frame.onload = () => {
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        } catch {
          window.open(url, '_blank');
        }
        setTimeout(() => {
          frame.remove();
          URL.revokeObjectURL(url);
        }, 60000);
      };
      document.body.appendChild(frame);
    } catch {
      toast('Could not open the print view. Download the PDF and print it instead.');
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <Button size={size} icon={<FileText size={14} />} onClick={() => setOpen(true)}>
        Camera sheet
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Camera department setup sheet"
        footer={
          <div className="cluster">
            <Button variant="quiet" icon={<Printer size={16} />} onClick={print} disabled={!!busy}>
              {busy === 'print' ? 'Preparing…' : 'Print'}
            </Button>
            <Button variant="primary" icon={<Download size={16} />} onClick={download} disabled={!!busy}>
              {busy === 'pdf' ? 'Making PDF…' : 'Download PDF'}
            </Button>
          </div>
        }
      >
        <div className="stack stack--sm">
          <SelectField label="Set-up" value={which} onChange={setWhich} options={[{ value: 'all', label: 'Every set-up' }, ...project.diagrams.map((d) => ({ value: d.id, label: `${d.sceneNumber ? `Sc ${d.sceneNumber} · ` : ''}${d.name}` }))]} />
          <p className="tiny muted">A4, in eight parts: production, camera settings, rig drawings, equipment checklist, connection diagram with anything missing, lighting and environment, subjects and framing, then step-by-step setup.</p>
        </div>
      </Sheet>
    </>
  );
}
