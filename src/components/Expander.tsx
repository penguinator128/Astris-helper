import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface Props {
  title?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function Expander({ title = 'How this is calculated', children, defaultOpen }: Props) {
  return (
    <details className="expander" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <div className="expander__body">{children}</div>
    </details>
  );
}

export function Formula({ children }: { children: ReactNode }) {
  return <code className="formula">{children}</code>;
}
