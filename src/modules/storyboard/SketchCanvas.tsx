import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Eraser, Minus, MoveUpRight, Pen, Undo2, Trash2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { Segmented } from '@/components/Segmented';
import type { Stroke } from '@/types/project';
import { StrokesSvg } from './FrameView';

interface Props {
  strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
  ratio: number;
  background?: React.ReactNode;
}

type Tool = Stroke['tool'];
const COLOURS = ['#0b0b0c', '#ffc400', '#fafaf7', '#b3261e'];
const WIDTHS = [{ id: '3', label: 'Thin' }, { id: '6', label: 'Medium' }, { id: '12', label: 'Thick' }];

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Vector sketch pad: pen, line, arrow, eraser (removes whole strokes), undo. Coordinates are normalised 0..1. */
export function SketchCanvas({ strokes, onChange, ratio, background }: Props) {
  const [tool, setTool] = useState<Tool>('pen');
  const [colour, setColour] = useState(COLOURS[0]);
  const [width, setWidth] = useState('6');
  const [draft, setDraft] = useState<Stroke | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);

  function pos(e: ReactPointerEvent) {
    const r = host.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
  }
  function erase(p: { x: number; y: number }) {
    const H = 1 / ratio;
    const hit = strokes.filter((s) => {
      for (let i = 0; i < s.points.length - 1 || (s.points.length === 1 && i === 0); i++) {
        const a = s.points[i];
        const b = s.points[i + 1] ?? a;
        if (s.tool === 'line' || s.tool === 'arrow') {
          const first = s.points[0];
          const last = s.points[s.points.length - 1];
          if (segDist(p.x, p.y * H, first.x, first.y * H, last.x, last.y * H) < 0.02) return true;
          break;
        }
        if (segDist(p.x, p.y * H, a.x, a.y * H, b.x, b.y * H) < 0.02) return true;
      }
      return false;
    });
    if (hit.length) onChange(strokes.filter((s) => !hit.includes(s)));
  }
  function down(e: ReactPointerEvent) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = pos(e);
    if (tool === 'eraser') return erase(p);
    setDraft({ tool, points: [p], width: Number(width), colour });
  }
  function move(e: ReactPointerEvent) {
    if (!drawing.current) return;
    const p = pos(e);
    if (tool === 'eraser') return erase(p);
    setDraft((d) => (d ? { ...d, points: tool === 'pen' ? [...d.points, p] : [d.points[0], p] } : d));
  }
  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    if (draft && (draft.points.length > 1 || draft.tool === 'pen')) {
      const s = draft.points.length === 1 ? { ...draft, points: [draft.points[0], { x: draft.points[0].x + 0.002, y: draft.points[0].y }] } : draft;
      onChange([...strokes, s]);
    }
    setDraft(null);
  }

  return (
    <div className="stack stack--sm">
      <div className="sketch-tools">
        <Segmented
          value={tool}
          onChange={setTool}
          size="sm"
          label="Drawing tool"
          options={[
            { value: 'pen', label: <Pen size={14} />, title: 'Pen' },
            { value: 'line', label: <Minus size={14} />, title: 'Line' },
            { value: 'arrow', label: <MoveUpRight size={14} />, title: 'Arrow' },
            { value: 'eraser', label: <Eraser size={14} />, title: 'Eraser' },
          ]}
        />
        <Segmented value={width} onChange={setWidth} size="sm" label="Stroke width" options={WIDTHS.map((w) => ({ value: w.id, label: w.label }))} />
        <span className="colour-dots" role="group" aria-label="Colour">
          {COLOURS.map((c) => (
            <button key={c} type="button" className="colour-dot" style={{ background: c }} aria-pressed={colour === c} aria-label={`Colour ${c}`} onClick={() => setColour(c)} />
          ))}
        </span>
        <span className="toolbar__spacer" />
        <Button size="sm" variant="ghost" icon={<Undo2 size={14} />} onClick={() => onChange(strokes.slice(0, -1))} disabled={strokes.length === 0}>
          Undo
        </Button>
        <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => onChange([])} disabled={strokes.length === 0}>
          Clear
        </Button>
      </div>
      <div ref={host} className="sketch" style={{ aspectRatio: `${ratio}`, cursor: tool === 'eraser' ? 'cell' : 'crosshair' }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="img" aria-label="Sketch area">
        {background}
        <StrokesSvg strokes={draft ? [...strokes, draft] : strokes} width={1000} height={Math.round(1000 / ratio)} />
      </div>
    </div>
  );
}
