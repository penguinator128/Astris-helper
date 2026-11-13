import type { ReactNode } from 'react';
import { Blueprint } from '@/components/Blueprint';

interface Props {
  children: ReactNode;
  title?: string;
  tone?: 'yellow' | 'ink' | 'bone';
}

/** Key readouts panel; announced politely to screen readers as values change. */
export function ResultPanel({ children, title = 'Result', tone = 'yellow' }: Props) {
  return (
    <Blueprint tone={tone} aria-live="polite" aria-label={title}>
      <div className="readout-grid">{children}</div>
    </Blueprint>
  );
}
