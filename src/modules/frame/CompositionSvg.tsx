import { forwardRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { Composition, FrameElement, Palette } from '@/types/project';
import { aspectRatio } from '@/types/project';
import { silhouette, type Shape } from '@/lib/frame/silhouettes';

export const FRAME_W = 1000;

interface Props {
  comp: Composition;
  palette?: Palette | null;
  backgroundUrl?: string | null;
  selectedId?: string | null;
  interactive?: boolean;
  onElementPointerDown?: (e: ReactPointerEvent, id: string) => void;
  onHandlePointerDown?: (e: ReactPointerEvent, id: string) => void;
  onBackgroundPointerDown?: (e: ReactPointerEvent) => void;
  showLabels?: boolean;
}

function ShapeEl({ s }: { s: Shape }) {
  if (s.kind === 'circle') return <circle cx={s.cx} cy={s.cy} r={s.r} />;
  if (s.kind === 'rect') return <rect x={s.x} y={s.y} width={s.w} height={s.h} />;
  return <path d={s.d} />;
}

function Figure({ el, H, fill }: { el: FrameElement; H: number; fill: string }) {
  const def = silhouette(el.kind);
  const s = (el.scale * H) / def.box.h;
  const w = def.box.w * s;
  const h = def.box.h * s;
  const x = el.x * FRAME_W - w / 2;
  const y = el.y * H - h;
  const flip = el.flip ? `translate(${w} 0) scale(-1 1)` : '';
  return (
    <g transform={`translate(${x} ${y}) ${flip} scale(${s})`} fill={el.colour ?? fill} stroke="none">
      {def.parts
        ? def.parts.map((p, i) => {
            const part = silhouette(p.ref);
            return (
              <g key={i} transform={`translate(${p.dx} ${p.dy + part.box.h * (1 - p.s)}) scale(${p.s})`}>
                {part.shapes.map((sh, j) => (
                  <ShapeEl key={j} s={sh} />
                ))}
              </g>
            );
          })
        : def.shapes.map((sh, j) => <ShapeEl key={j} s={sh} />)}
    </g>
  );
}

function goldenSpiralPath(W: number, H: number): string {
  // Approximate golden spiral with quarter arcs in nested golden rectangles, starting from the full frame.
  let x = 0;
  let y = 0;
  let w = W;
  let h = H;
  let dir = 0;
  const segs: string[] = [];
  for (let i = 0; i < 8; i++) {
    const side = Math.min(w, h);
    const r = side;
    if (dir === 0) {
      // square on the left
      segs.push(`M ${x} ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y}`);
      x += r;
      w -= r;
    } else if (dir === 1) {
      segs.push(`M ${x} ${y} A ${r} ${r} 0 0 1 ${x + r} ${y + r}`);
      y += r;
      h -= r;
    } else if (dir === 2) {
      segs.push(`M ${x + w} ${y} A ${r} ${r} 0 0 1 ${x + w - r} ${y + r}`);
      w -= r;
    } else {
      segs.push(`M ${x + w} ${y + h} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h - r}`);
      h -= r;
    }
    dir = (dir + 1) % 4;
    if (w < 2 || h < 2) break;
  }
  return segs.join(' ');
}

export const CompositionSvg = forwardRef<SVGSVGElement, Props>(function CompositionSvg(
  { comp, palette, backgroundUrl, selectedId, interactive, onElementPointerDown, onHandlePointerDown, onBackgroundPointerDown, showLabels = true },
  ref,
) {
  const H = Math.round(FRAME_W / aspectRatio(comp.aspect));
  const g = comp.guides;
  const guideStroke = 'rgba(255, 196, 0, 0.9)';
  const guideThin = 1.5;
  const bgColour = palette?.swatches.length ? darkest(palette) : '#D9D6CC';
  const figColour = palette?.swatches.length ? mid(palette) : '#0B0B0C';
  const dutch = comp.angle === 'dutch' ? -8 : 0;

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${FRAME_W} ${H}`}
      className="frame-svg"
      role="img"
      aria-label={`Composition ${comp.name}, ${comp.aspect}`}
      style={{ touchAction: 'none', userSelect: 'none' }}
      onPointerDown={interactive ? onBackgroundPointerDown : undefined}
    >
      <defs>
        <clipPath id={`clip-${comp.id}`}>
          <rect x="0" y="0" width={FRAME_W} height={H} />
        </clipPath>
      </defs>
      <rect x="0" y="0" width={FRAME_W} height={H} fill={bgColour} />
      <g clipPath={`url(#clip-${comp.id})`}>
        {backgroundUrl && <image href={backgroundUrl} x="0" y="0" width={FRAME_W} height={H} preserveAspectRatio="xMidYMid slice" opacity={comp.backgroundOpacity} />}
        {/* Horizon / dutch cue */}
        <g transform={`rotate(${dutch} ${FRAME_W / 2} ${H / 2})`}>
          <line x1={-200} y1={H * (comp.angle === 'low' ? 0.72 : comp.angle === 'high' ? 0.3 : comp.angle === 'overhead' ? 0.1 : 0.5)} x2={FRAME_W + 200} y2={H * (comp.angle === 'low' ? 0.72 : comp.angle === 'high' ? 0.3 : comp.angle === 'overhead' ? 0.1 : 0.5)} stroke="rgba(11,11,12,0.18)" strokeWidth={2} strokeDasharray="12 10" />
        </g>
        {comp.elements.map((el) => (
          <g
            key={el.id}
            className={interactive ? 'frame-el' : undefined}
            onPointerDown={interactive ? (e) => onElementPointerDown?.(e, el.id) : undefined}
            style={interactive ? { cursor: 'grab' } : undefined}
          >
            <Figure el={el} H={H} fill={figColour} />
          </g>
        ))}
      </g>

      {/* Guides */}
      <g fill="none" stroke={guideStroke} strokeWidth={guideThin} pointerEvents="none">
        {g.thirds && (
          <>
            <line x1={FRAME_W / 3} y1={0} x2={FRAME_W / 3} y2={H} />
            <line x1={(2 * FRAME_W) / 3} y1={0} x2={(2 * FRAME_W) / 3} y2={H} />
            <line x1={0} y1={H / 3} x2={FRAME_W} y2={H / 3} />
            <line x1={0} y1={(2 * H) / 3} x2={FRAME_W} y2={(2 * H) / 3} />
          </>
        )}
        {g.goldenRatio && (
          <g strokeDasharray="6 6">
            <line x1={FRAME_W * 0.382} y1={0} x2={FRAME_W * 0.382} y2={H} />
            <line x1={FRAME_W * 0.618} y1={0} x2={FRAME_W * 0.618} y2={H} />
            <line x1={0} y1={H * 0.382} x2={FRAME_W} y2={H * 0.382} />
            <line x1={0} y1={H * 0.618} x2={FRAME_W} y2={H * 0.618} />
          </g>
        )}
        {g.goldenSpiral && <path d={goldenSpiralPath(FRAME_W, H)} strokeWidth={2} />}
        {g.goldenTriangles && (
          <>
            <line x1={0} y1={H} x2={FRAME_W} y2={0} />
            <line x1={0} y1={0} x2={(FRAME_W * H * H) / (FRAME_W * FRAME_W + H * H)} y2={H - (FRAME_W * FRAME_W * H) / (FRAME_W * FRAME_W + H * H)} />
            <line x1={FRAME_W} y1={H} x2={FRAME_W - (FRAME_W * H * H) / (FRAME_W * FRAME_W + H * H)} y2={(FRAME_W * FRAME_W * H) / (FRAME_W * FRAME_W + H * H)} />
          </>
        )}
        {g.diagonals && (
          <>
            <line x1={0} y1={0} x2={FRAME_W} y2={H} />
            <line x1={FRAME_W} y1={0} x2={0} y2={H} />
          </>
        )}
        {g.centre && (
          <>
            <line x1={FRAME_W / 2} y1={H / 2 - 40} x2={FRAME_W / 2} y2={H / 2 + 40} />
            <line x1={FRAME_W / 2 - 40} y1={H / 2} x2={FRAME_W / 2 + 40} y2={H / 2} />
          </>
        )}
        {g.actionSafe && <rect x={FRAME_W * 0.05} y={H * 0.05} width={FRAME_W * 0.9} height={H * 0.9} strokeDasharray="10 8" />}
        {g.titleSafe && <rect x={FRAME_W * 0.1} y={H * 0.1} width={FRAME_W * 0.8} height={H * 0.8} strokeDasharray="4 6" />}
        {g.headroom && (
          <g>
            <line x1={0} y1={H * 0.12} x2={FRAME_W} y2={H * 0.12} strokeDasharray="2 8" />
            {showLabels && (
              <text x={12} y={H * 0.12 - 8} fill={guideStroke} stroke="none" fontSize={18} fontFamily="IBM Plex Mono, monospace">
                HEADROOM
              </text>
            )}
          </g>
        )}
        {g.leadRoom && (
          <g>
            <line x1={FRAME_W * 0.62} y1={0} x2={FRAME_W * 0.62} y2={H} strokeDasharray="2 8" />
            {showLabels && (
              <text x={FRAME_W * 0.62 + 8} y={H - 12} fill={guideStroke} stroke="none" fontSize={18} fontFamily="IBM Plex Mono, monospace">
                LEAD ROOM
              </text>
            )}
          </g>
        )}
      </g>

      {/* Movement arrows */}
      <g fill="none" stroke="#FFC400" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
        <MovementArrows move={comp.movement} W={FRAME_W} H={H} />
      </g>

      {/* Palette bar */}
      {palette && palette.swatches.length > 0 && (
        <g pointerEvents="none">
          {palette.swatches.map((s, i) => (
            <rect key={i} x={(i * FRAME_W) / palette.swatches.length} y={H - 18} width={FRAME_W / palette.swatches.length} height={18} fill={s.hex} />
          ))}
        </g>
      )}

      {/* Selection */}
      {interactive &&
        selectedId &&
        (() => {
          const el = comp.elements.find((x) => x.id === selectedId);
          if (!el) return null;
          const def = silhouette(el.kind);
          const s = (el.scale * H) / def.box.h;
          const w = def.box.w * s;
          const h = def.box.h * s;
          const x = el.x * FRAME_W - w / 2;
          const y = el.y * H - h;
          return (
            <g data-chrome="selection">
              <rect x={x} y={y} width={w} height={h} fill="none" stroke="#FFC400" strokeWidth={3} strokeDasharray="8 6" pointerEvents="none" />
              <circle cx={x + w} cy={y + h} r={18} fill="#FFC400" stroke="#0B0B0C" strokeWidth={3} style={{ cursor: 'nwse-resize' }} onPointerDown={(e) => onHandlePointerDown?.(e, el.id)} />
            </g>
          );
        })()}

      {/* Frame edge */}
      <rect x="1" y="1" width={FRAME_W - 2} height={H - 2} fill="none" stroke="#0B0B0C" strokeWidth={2} pointerEvents="none" />
    </svg>
  );
});

function MovementArrows({ move, W, H }: { move: Composition['movement']; W: number; H: number }) {
  const cx = W / 2;
  const cy = H / 2;
  const arrow = (x1: number, y1: number, x2: number, y2: number) => {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const hl = 28;
    const a1 = ang + Math.PI * 0.8;
    const a2 = ang - Math.PI * 0.8;
    return `M ${x1} ${y1} L ${x2} ${y2} M ${x2} ${y2} L ${x2 + hl * Math.cos(a1)} ${y2 + hl * Math.sin(a1)} M ${x2} ${y2} L ${x2 + hl * Math.cos(a2)} ${y2 + hl * Math.sin(a2)}`;
  };
  switch (move) {
    case 'push':
      return (
        <>
          <path d={arrow(80, 80, 200, 170)} />
          <path d={arrow(W - 80, 80, W - 200, 170)} />
          <path d={arrow(80, H - 80, 200, H - 170)} />
          <path d={arrow(W - 80, H - 80, W - 200, H - 170)} />
        </>
      );
    case 'pull':
      return (
        <>
          <path d={arrow(200, 170, 80, 80)} />
          <path d={arrow(W - 200, 170, W - 80, 80)} />
          <path d={arrow(200, H - 170, 80, H - 80)} />
          <path d={arrow(W - 200, H - 170, W - 80, H - 80)} />
        </>
      );
    case 'pan-l':
      return <path d={arrow(cx + 140, 70, cx - 140, 70)} />;
    case 'pan-r':
      return <path d={arrow(cx - 140, 70, cx + 140, 70)} />;
    case 'tilt-u':
      return <path d={arrow(W - 70, cy + 140, W - 70, cy - 140)} />;
    case 'tilt-d':
      return <path d={arrow(W - 70, cy - 140, W - 70, cy + 140)} />;
    case 'track-l':
      return <path d={arrow(cx + 180, H - 60, cx - 180, H - 60)} strokeDasharray="18 12" />;
    case 'track-r':
      return <path d={arrow(cx - 180, H - 60, cx + 180, H - 60)} strokeDasharray="18 12" />;
    case 'crane-u':
      return <path d={arrow(70, cy + 180, 70, cy - 180)} strokeDasharray="18 12" />;
    case 'crane-d':
      return <path d={arrow(70, cy - 180, 70, cy + 180)} strokeDasharray="18 12" />;
    case 'handheld':
      return <path d={`M ${cx - 160} 70 q 40 -30 80 0 t 80 0 t 80 0 t 80 0`} />;
    default:
      return null;
  }
}

function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function darkest(p: Palette): string {
  return p.swatches.slice().sort((a, b) => lum(a.hex) - lum(b.hex))[0].hex;
}
function mid(p: Palette): string {
  const sorted = p.swatches.slice().sort((a, b) => lum(a.hex) - lum(b.hex));
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.6))].hex;
}
