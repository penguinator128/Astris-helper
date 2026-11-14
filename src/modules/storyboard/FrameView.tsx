import { useEffect, useState, type ReactNode } from 'react';
import type { AspectId, Composition, Palette, Stroke, StoryboardFrame } from '@/types/project';
import { aspectRatio } from '@/types/project';
import { getImageUrl } from '@/store/images';
import { CompositionSvg } from '@/modules/frame/CompositionSvg';

export function StrokesSvg({ strokes, width = 1000, height = 562, children, className }: { strokes: Stroke[]; width?: number; height?: number; children?: ReactNode; className?: string }) {
  const pts = (s: Stroke) => s.points.map((p) => `${(p.x * width).toFixed(1)},${(p.y * height).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className ?? 'frame-view__svg'} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <marker id="sb-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
        </marker>
      </defs>
      {strokes.map((s, i) => {
        const w = s.width * (width / 1000);
        if (s.tool === 'line' || s.tool === 'arrow') {
          const a = s.points[0];
          const b = s.points[s.points.length - 1];
          if (!a || !b) return null;
          return <line key={i} x1={a.x * width} y1={a.y * height} x2={b.x * width} y2={b.y * height} stroke={s.colour} strokeWidth={w} strokeLinecap="round" markerEnd={s.tool === 'arrow' ? 'url(#sb-arrow)' : undefined} />;
        }
        return <polyline key={i} points={pts(s)} fill="none" stroke={s.colour} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;
      })}
      {children}
    </svg>
  );
}

interface Props {
  frame: StoryboardFrame;
  aspect: AspectId;
  compositions: Composition[];
  palettes: Palette[];
  className?: string;
}

/** Renders a storyboard frame: its source (composition, image or blank) with sketch strokes on top. */
export function FrameView({ frame, aspect, compositions, palettes, className = '' }: Props) {
  const ratio = aspectRatio(aspect);
  const comp = frame.source === 'composition' ? compositions.find((c) => c.id === frame.compositionId) : undefined;
  const [img, setImg] = useState<{ id: string; url: string | null } | null>(null);
  const imgUrl = img && img.id === frame.imageId ? img.url : null;
  useEffect(() => {
    let alive = true;
    const id = frame.imageId;
    if (frame.source === 'image' && id) void getImageUrl(id).then((url) => alive && setImg({ id, url }));
    return () => {
      alive = false;
    };
  }, [frame.imageId, frame.source]);
  const H = Math.round(1000 / ratio);
  return (
    <div className={`frame-view ${!comp && !imgUrl ? 'frame-view--blank' : ''} ${className}`} style={{ aspectRatio: `${ratio}` }}>
      {comp && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <CompositionSvg comp={{ ...comp, aspect }} palette={palettes.find((p) => p.id === comp.paletteId) ?? null} showLabels={false} />
        </div>
      )}
      {imgUrl && <img src={imgUrl} alt="" className="frame-view__img" />}
      <StrokesSvg strokes={frame.strokes} width={1000} height={H} />
    </div>
  );
}
