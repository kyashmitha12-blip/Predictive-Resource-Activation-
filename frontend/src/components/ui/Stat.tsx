import clsx from "clsx";
import { ReactNode } from "react";

export function Stat({ label, value, note, tone = "light", icon }: { label: string; value: ReactNode; note?: ReactNode; tone?: "light" | "night"; icon?: ReactNode }) {
  return (
    <div className={clsx("rounded-panel p-4", tone === "night" ? "panel-night" : "panel")}>
      <div className={clsx("flex items-center justify-between text-sm", tone === "night" ? "text-white/70" : "text-ink-2")}>{label}{icon}</div>
      <div className="num mt-1 font-display text-3xl font-semibold">{value}</div>
      {note && <div className={clsx("mt-1 text-sm", tone === "night" ? "text-white/60" : "text-ink-3")}>{note}</div>}
    </div>
  );
}
