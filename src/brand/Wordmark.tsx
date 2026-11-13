/*
  ASTRIS PRODUCTIONS wordmark.
  To swap in the real logo later, replace this component's SVG (and public/wordmark.svg,
  which the PDF export and the manifest use). Keep the viewBox proportions roughly 7:1.
*/

interface Props {
  height?: number;
  tone?: 'ink' | 'paper' | 'current';
  withStar?: boolean;
  className?: string;
  title?: string;
}

export function StarMark({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none">
      <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93 4.93 19.07" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3" fill="var(--yellow)" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function Wordmark({ height = 16, tone = 'current', withStar = true, className = '', title = 'ASTRIS PRODUCTIONS' }: Props) {
  const colour = tone === 'ink' ? '#0B0B0C' : tone === 'paper' ? '#FAFAF7' : 'currentColor';
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(height * 0.5), color: colour, lineHeight: 1 }}
      role="img"
      aria-label={title}
    >
      {withStar && <StarMark size={Math.round(height * 1.15)} />}
      <span
        style={{
          fontFamily: 'var(--font-ui)',
          fontWeight: 600,
          fontSize: height,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        Astris
        <span style={{ fontWeight: 400, marginLeft: '0.5em', opacity: 0.85 }}>Productions</span>
      </span>
    </span>
  );
}
