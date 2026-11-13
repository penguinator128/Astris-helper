import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  labelEnd?: ReactNode;
  children: (id: string) => ReactNode;
  className?: string;
}

export function Field({ label, hint, labelEnd, children, className = '' }: FieldProps) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      <label className="field__label" htmlFor={id}>
        <span>{label}</span>
        {labelEnd && <span>{labelEnd}</span>}
      </label>
      <div className="field__control">{children(id)}</div>
      {hint && <div className="field__hint">{hint}</div>}
    </div>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: ReactNode;
  hint?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
}

export function TextField({ label, hint, value, onChange, mono, className = '', ...rest }: TextFieldProps) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <input
          id={id}
          className={`input ${mono ? 'input--mono' : ''} ${className}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...rest}
        />
      )}
    </Field>
  );
}

interface NumberFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: ReactNode;
  hint?: ReactNode;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  labelEnd?: ReactNode;
}

/** Numeric input that allows free typing (incl. blank) and commits parsed numbers. */
export function NumberField({ label, hint, value, onChange, unit, labelEnd, className = '', step, ...rest }: NumberFieldProps) {
  return (
    <Field label={label} hint={hint} labelEnd={labelEnd}>
      {(id) => (
        <>
          <input
            id={id}
            type="number"
            inputMode="decimal"
            step={step ?? 'any'}
            className={`input ${unit ? 'input--unit' : ''} ${className}`}
            value={Number.isFinite(value) ? value : ''}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              if (Number.isFinite(n)) onChange(n);
              else if (e.target.value === '' || e.target.value === '-') onChange(NaN);
            }}
            {...rest}
          />
          {unit && (
            <span className="field__unit" aria-hidden="true">
              {unit}
            </span>
          )}
        </>
      )}
    </Field>
  );
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  label: ReactNode;
  hint?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  labelEnd?: ReactNode;
}

export function SelectField({ label, hint, value, onChange, options, labelEnd, className = '', ...rest }: SelectFieldProps) {
  return (
    <Field label={label} hint={hint} labelEnd={labelEnd}>
      {(id) => (
        <select id={id} className={`select ${className}`} value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label: ReactNode;
  hint?: ReactNode;
  value: string;
  onChange: (v: string) => void;
}

export function TextAreaField({ label, hint, value, onChange, className = '', ...rest }: TextAreaFieldProps) {
  return (
    <Field label={label} hint={hint}>
      {(id) => <textarea id={id} className={`textarea ${className}`} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />}
    </Field>
  );
}

interface CheckProps {
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

export function Check({ label, checked, onChange, disabled }: CheckProps) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
