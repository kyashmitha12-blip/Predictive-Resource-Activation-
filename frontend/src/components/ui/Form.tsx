import clsx from "clsx";
import { Eye, EyeOff } from "lucide-react";
import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef, useId, useState } from "react";

const control = "block w-full rounded-ctl border bg-white px-3 text-sm text-ink placeholder:text-ink-3 transition-colors focus:border-cobalt focus:outline-none focus:ring-2 focus:ring-cobalt/20 disabled:bg-paper-2 disabled:text-ink-3";

interface FieldProps { label: string; error?: string | null; hint?: string; children: (p: { id: string; "aria-invalid": boolean; "aria-describedby"?: string; className: string }) => ReactNode; className?: string; optional?: boolean }
export function Field({ label, error, hint, children, className, optional }: FieldProps) {
  const id = useId();
  const desc = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label} {optional && <span className="font-normal text-ink-3">(optional)</span>}
      </label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": desc, className: clsx(control, error ? "border-alert" : "border-line-2") })}
      {error ? <p id={`${id}-err`} role="alert" className="mt-1.5 text-sm text-alert">{error}</p>
        : hint ? <p id={`${id}-hint`} className="mt-1.5 text-sm text-ink-3">{hint}</p> : null}
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
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-3 hover:text-ink">
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
      {(p) => <select ref={ref} {...p} className={clsx(p.className, "h-10 pr-8", className)} {...rest}>{children}</select>}
    </Field>
  ));
Select.displayName = "Select";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & WithField>(
  ({ label, error, hint, optional, wrapperClassName, className, ...rest }, ref) => (
    <Field label={label} error={error} hint={hint} optional={optional} className={wrapperClassName}>
      {(p) => <textarea ref={ref} {...p} className={clsx(p.className, "min-h-[88px] py-2", className)} {...rest} />}
    </Field>
  ));
Textarea.displayName = "Textarea";

export function Checkbox({ label, hint, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" className="mt-1 h-4 w-4 rounded border-line-2 accent-[rgb(var(--cobalt))]" {...rest} />
      <label htmlFor={id} className="text-sm">
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-ink-3">{hint}</span>}
      </label>
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <div role="alert" className="rounded-ctl border border-alert/30 bg-alert-50 px-3 py-2 text-sm text-alert">{message}</div>;
}
