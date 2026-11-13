import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  tone?: 'paper' | 'bone' | 'yellow' | 'ink';
  className?: string;
  title?: ReactNode;
  index?: string;
  aside?: ReactNode;
  padding?: 'normal' | 'tight' | 'none';
  as?: 'div' | 'section' | 'article';
  id?: string;
  grain?: boolean;
  'aria-live'?: 'polite' | 'off';
  'aria-label'?: string;
}

/** Blueprint panel: hairline border with small corner crosses. */
export function Blueprint({
  children,
  tone = 'paper',
  className = '',
  title,
  index,
  aside,
  padding = 'normal',
  as: Tag = 'div',
  id,
  grain,
  ...aria
}: Props) {
  const toneClass = tone === 'paper' ? '' : `bp--${tone}`;
  const padClass = padding === 'normal' ? '' : `bp__body--${padding}`;
  return (
    <Tag className={`bp ${toneClass} ${grain ? 'grain' : ''} ${className}`} id={id} {...aria}>
      <span className="bp__cross bp__cross--tl" aria-hidden="true" />
      <span className="bp__cross bp__cross--tr" aria-hidden="true" />
      <span className="bp__cross bp__cross--bl" aria-hidden="true" />
      <span className="bp__cross bp__cross--br" aria-hidden="true" />
      {(title || aside) && (
        <div className="bp__head">
          <div className="cluster" style={{ gap: 'var(--s-2)' }}>
            {index && <span className="micro">{index}</span>}
            {title && <h2 style={{ fontSize: 'var(--fs-16)', fontWeight: 600 }}>{title}</h2>}
          </div>
          {aside}
        </div>
      )}
      <div className={`bp__body ${padClass}`}>{children}</div>
    </Tag>
  );
}
