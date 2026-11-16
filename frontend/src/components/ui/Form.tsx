import clsx from "clsx";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef, useId, useState } from "react";

const control = "block w-full rounded-ctl border bg-white px-3.5 text-sm text-ink placeholder:text-ink-3 transition-all duration-150 focus:border-cobalt focus:outline-none focus:ring-4 focus:ring-cobalt/15 disabled:bg-paper-2 disabled:text-ink-3 shadow-subtle";

interface FieldProps { label: string; error?: string | null; hint?: string; children: (p: { id: string; "aria-invalid": boolean; "aria-describedby"?: string; className: string }) => ReactNode; className?: string; optional?: boolean }
export function Field({ label, error, hint, children, className, optional }: FieldProps) {
  const id = useId();
  const desc = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-2">
        {label} {optional && <span className="font-normal lowercase tracking-normal text-ink-3">(optional)</span>}
      </label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": desc, className: clsx(control, error ? "border-alert focus:border-alert focus:ring-alert/15" : "border-line hover:border-line-2") })}
      {error ? (
        <p id={`${id}-err`} role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-alert">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

type WithField = { label: string; error?: string | null; hint?: string; optional?: boolean; wrapperClassName?: string };
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & WithField>(
  ({ label, error, hint, optional, wrapperClassName, className, ...rest }, ref) => (
    <Field label={label} error={error} hint={hint} optional={optional} className={wrapperClassName}>
      {(p) => <input ref={ref} {...p} className={clsx(p.className, "h-10", className)} {...rest} />}
    </Field>
  ));
Input.displayName = "Input";

/** Password field with a show/hide toggle. The toggle is a real button, reachable by keyboard and announced as pressed. */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & WithField>(
  ({ label, error, hint, optional, wrapperClassName, className, ...rest }, ref) => {
    const [shown, setShown] = useState(false);
    return (
      <Field label={label} error={error} hint={hint} optional={optional} className={wrapperClassName}>
        {(p) => (
          <div className="relative">
            <input ref={ref} {...p} type={shown ? "text" : "password"} className={clsx(p.className, "h-10 pr-11", className)} {...rest} />
            <button type="button" onClick={() => setShown(!shown)} aria-pressed={shown} aria-label={shown ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-3 hover:text-ink transition-colors">
              {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        )}
      </Field>
    );
  });
PasswordInput.displayName = "PasswordInput";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & WithField>(
  ({ label, error, hint, optional, wrapperClassName, className, children, ...rest }, ref) => (
    <Field label={label} error={error} hint={hint} optional={optional} className={wrapperClassName}>
      {(p) => <select ref={ref} {...p} className={clsx(p.className, "h-10 pr-8 cursor-pointer", className)} {...rest}>{children}</select>}
    </Field>
  ));
Select.displayName = "Select";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & WithField>(
  ({ label, error, hint, optional, wrapperClassName, className, ...rest }, ref) => (
    <Field label={label} error={error} hint={hint} optional={optional} className={wrapperClassName}>
      {(p) => <textarea ref={ref} {...p} className={clsx(p.className, "min-h-[96px] py-2.5", className)} {...rest} />}
    </Field>
  ));
Textarea.displayName = "Textarea";

export function Checkbox({ label, hint, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" className="mt-1 h-4 w-4 rounded border-line accent-[rgb(var(--cobalt))] cursor-pointer transition-colors" {...rest} />
      <label htmlFor={id} className="text-sm cursor-pointer select-none">
        <span className="font-semibold text-ink">{label}</span>
        {hint && <span className="block text-xs text-ink-3">{hint}</span>}
      </label>
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-center gap-2 rounded-ctl border border-alert/30 bg-alert-50 px-3.5 py-2.5 text-sm font-medium text-alert shadow-subtle">
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
