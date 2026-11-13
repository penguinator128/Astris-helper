import type { ReactNode } from 'react';

interface Option<T extends string> {
  value: T;
  label: ReactNode;
  title?: string;
}

interface Props<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: Option<T>[];
  label?: string;
  block?: boolean;
  mono?: boolean;
  scroll?: boolean;
  size?: 'sm' | 'md';
}

export function Segmented<T extends string>({ value, onChange, options, label, block, mono, scroll, size = 'md' }: Props<T>) {
  return (
    <div
      className={`seg ${block ? 'seg--block' : ''} ${mono ? 'seg--mono' : ''} ${scroll ? 'seg--scroll' : ''}`}
      role="group"
      aria-label={label}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="seg__btn"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          title={o.title}
          style={size === 'sm' ? { minHeight: 32, fontSize: 'var(--fs-12)' } : undefined}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
