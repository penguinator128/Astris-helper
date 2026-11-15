import { forwardRef } from 'react';

/** Trophy mark: a faceted star on a stepped plinth, drawn in SVG. */
export function Trophy({ x, y, size, colour = '#FFC400', ink = '#0B0B0C' }: { x: number; y: number; size: number; colour?: string; ink?: string }) {
  const s = size / 100;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M50 4 L61 34 L94 36 L68 56 L77 88 L50 70 L23 88 L32 56 L6 36 L39 34 Z" fill={colour} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
      <path d="M50 4 L50 70 M6 36 L68 56 M94 36 L32 56" stroke={ink} strokeWidth="1.2" opacity="0.35" />
      <rect x="44" y="88" width="12" height="18" fill={ink} />
      <rect x="30" y="106" width="40" height="8" fill={ink} />
      <rect x="22" y="114" width="56" height="10" fill={ink} />
    </g>
  );
}

interface Props {
  kind: 'nominee' | 'winner';
  ceremony: string;
  year: number;
  category: string;
  name: string;
  work: string;
}

const W = 600;
const H = 840;

/** Nominee or winner card in the Astris style: ink and yellow, blueprint corners, letter-spaced type. */
export const AwardCard = forwardRef<SVGSVGElement, Props>(function AwardCard({ kind, ceremony, year, category, name, work }, ref) {
  const winner = kind === 'winner';
  const bg = winner ? '#FFC400' : '#0B0B0C';
  const fg = winner ? '#0B0B0C' : '#F3F1EA';
  const accent = winner ? '#0B0B0C' : '#FFC400';
  const muted = winner ? 'rgba(11,11,12,0.68)' : '#A7A59D';
  const cross = (cx: number, cy: number) => (
    <g stroke={accent} strokeWidth="2">
      <line x1={cx - 9} y1={cy} x2={cx + 9} y2={cy} />
      <line x1={cx} y1={cy - 9} x2={cx} y2={cy + 9} />
    </g>
  );
  const nameSize = name.length > 22 ? 40 : name.length > 14 ? 50 : 62;
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="award-card-svg" role="img" aria-label={`${winner ? 'Winner' : 'Nominee'} card: ${name}, ${category}`} xmlns="http://www.w3.org/2000/svg">
      <rect width={W} height={H} fill={bg} />
      <rect x="30" y="30" width={W - 60} height={H - 60} fill="none" stroke={accent} strokeWidth="1.5" opacity="0.7" />
      {cross(30, 30)}
      {cross(W - 30, 30)}
      {cross(30, H - 30)}
      {cross(W - 30, H - 30)}
      <text x={W / 2} y="92" textAnchor="middle" fill={fg} fontFamily="Inter Tight, Helvetica, Arial, sans-serif" fontSize="18" fontWeight="600" letterSpacing="7">
        ASTRIS PRODUCTIONS
      </text>
      <text x={W / 2} y="124" textAnchor="middle" fill={muted} fontFamily="IBM Plex Mono, monospace" fontSize="15" letterSpacing="4">
        {`${ceremony.toUpperCase()} · ${year}`}
      </text>
      <Trophy x={W / 2 - 95} y={170} size={190} colour={winner ? '#FAFAF7' : '#FFC400'} ink="#0B0B0C" />
      <text x={W / 2} y="470" textAnchor="middle" fill={accent} fontFamily="IBM Plex Mono, monospace" fontSize="18" letterSpacing="8" fontWeight="500">
        {winner ? 'WINNER' : 'NOMINEE'}
      </text>
      <line x1={W / 2 - 60} y1="492" x2={W / 2 + 60} y2="492" stroke={accent} strokeWidth="2" />
      <text x={W / 2} y="580" textAnchor="middle" fill={fg} fontFamily="Inter Tight, Helvetica, Arial, sans-serif" fontSize={nameSize} fontWeight="600" letterSpacing="-1">
        {name || 'Name'}
      </text>
      {work && (
        <text x={W / 2} y="628" textAnchor="middle" fill={muted} fontFamily="Inter Tight, Helvetica, Arial, sans-serif" fontSize="22" fontStyle="italic">
          {work}
        </text>
      )}
      <text x={W / 2} y={H - 90} textAnchor="middle" fill={fg} fontFamily="IBM Plex Mono, monospace" fontSize="16" letterSpacing="4">
        {category.toUpperCase()}
      </text>
    </svg>
  );
});
