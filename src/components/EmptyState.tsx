import type { ReactNode } from 'react';

interface Props {
  title: string;
  body?: string;
  action?: ReactNode;
}

export function EmptyState({ title, body, action }: Props) {
  return (
    <div className="empty">
      <div className="empty__title">{title}</div>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}
