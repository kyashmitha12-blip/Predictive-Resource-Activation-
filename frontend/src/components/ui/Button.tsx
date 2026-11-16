import clsx from "clsx";
import { Loader2 } from "lucide-react";
import { ButtonHTMLAttributes, forwardRef } from "react";
import { Link, LinkProps } from "react-router-dom";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "lamp";
type Size = "sm" | "md" | "lg";
const base = "inline-flex items-center justify-center gap-2 rounded-ctl font-semibold transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap";
const variants: Record<Variant, string> = {
  primary: "bg-cobalt text-white shadow-sm hover:bg-cobalt-700 hover:shadow-md hover:shadow-cobalt/20",
  secondary: "border border-line bg-white text-ink shadow-sm hover:bg-paper-2 hover:border-line-2 hover:text-ink",
  ghost: "text-ink-2 shadow-none hover:bg-paper-2 hover:text-ink",
  danger: "bg-alert text-white shadow-sm hover:bg-alert/90 hover:shadow-md hover:shadow-alert/20",
  lamp: "bg-lamp text-slate-900 font-bold shadow-sm hover:brightness-105 hover:shadow-md hover:shadow-lamp/25",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};
export const buttonClass = (variant: Variant = "primary", size: Size = "md", extra?: string) => clsx(base, variants[variant], sizes[size], extra);

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: Size; loading?: boolean }
export const Button = forwardRef<HTMLButtonElement, Props>(({ variant = "primary", size = "md", loading, className, children, disabled, type = "button", ...rest }, ref) => (
  <button ref={ref} type={type} disabled={disabled || loading} className={clsx(base, variants[variant], sizes[size], className)} {...rest}>
    {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
    {children}
  </button>
));
Button.displayName = "Button";

export function LinkButton({ variant = "primary", size = "md", className, ...rest }: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={clsx(base, variants[variant], sizes[size], className)} {...rest} />;
}
