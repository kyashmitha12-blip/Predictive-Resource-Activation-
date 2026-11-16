import clsx from "clsx";
import { ReactNode } from "react";

export function Stat({ label, value, note, tone = "light", icon }: { label: string; value: ReactNode; note?: ReactNode; tone?: "light" | "night"; icon?: ReactNode }) {
  return (
    <div className={clsx("rounded-panel p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift", tone === "night" ? "panel-night" : "panel")}>
      <div className={clsx("flex items-center justify-between text-sm font-medium", tone === "night" ? "text-white/75" : "text-ink-2")}>
        <span>{label}</span>
        {icon && (
          <span className={clsx("flex h-8 w-8 items-center justify-center rounded-ctl", tone === "night" ? "bg-white/10 text-white" : "bg-cobalt-50 text-cobalt")}>
            {icon}
          </span>
        )}
      </div>
      <div className={clsx("num mt-2 font-display text-3xl sm:text-4xl font-extrabold tracking-tight", tone === "night" ? "text-white" : "text-ink")}>
        {value}
      </div>
      {note && <div className={clsx("mt-1.5 text-xs font-medium", tone === "night" ? "text-white/60" : "text-ink-3")}>{note}</div>}
    </div>
  );
}
