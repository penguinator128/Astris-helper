import type { ReactNode } from 'react';

interface Props {
  index?: string;
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
}

export function PageHead({ index, title, sub, actions }: Props) {
  return (
    <header className="page__head">
      <div className="page__title">
        {index && <span className="page__idx">{index}</span>}
        <h1>{title}</h1>
        {sub && <p className="small muted">{sub}</p>}
      </div>
      {actions && <div className="page__actions">{actions}</div>}
    </header>
  );
}
