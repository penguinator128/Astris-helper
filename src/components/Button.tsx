import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router';

type Variant = 'default' | 'primary' | 'ghost' | 'quiet' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface BaseProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconOnly?: boolean;
  block?: boolean;
  active?: boolean;
  children?: ReactNode;
}

type ButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement>;

function cls({ variant = 'default', size = 'md', iconOnly, block, active }: BaseProps, extra = '') {
  return [
    'btn',
    variant !== 'default' && `btn--${variant}`,
    size !== 'md' && `btn--${size}`,
    iconOnly && 'btn--icon',
    block && 'btn--block',
    active && 'btn--active',
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, icon, iconOnly, block, active, children, className = '', type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cls({ variant, size, iconOnly, block, active }, className)} {...rest}>
      {icon}
      {!iconOnly && children}
      {iconOnly && <span className="visually-hidden">{children}</span>}
    </button>
  );
});

interface LinkButtonProps extends BaseProps {
  to: string;
  className?: string;
  'aria-label'?: string;
}

export function LinkButton({ to, variant, size, icon, iconOnly, block, active, children, className = '', ...rest }: LinkButtonProps) {
  return (
    <Link to={to} className={cls({ variant, size, iconOnly, block, active }, className)} {...rest}>
      {icon}
      {!iconOnly && children}
      {iconOnly && <span className="visually-hidden">{children}</span>}
    </Link>
  );
}
