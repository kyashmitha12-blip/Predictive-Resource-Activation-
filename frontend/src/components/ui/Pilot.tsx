import clsx from "clsx";

/** Status dot: hollow = idle, solid terracotta = active/shared, tinted = waiting. Static by design. */
export function Pilot({ state = "idle", size = 10, className }: { state?: "idle" | "lit" | "pending"; size?: number; className?: string }) {
  const s = { width: size, height: size };
  return (
    <span aria-hidden className={clsx("relative inline-flex shrink-0", className)} style={s}>
      <span className={clsx("relative rounded-full", state === "lit" ? "bg-lamp" : state === "pending" ? "border-[1.5px] border-lamp bg-lamp/40" : "border-[1.5px] border-ink-3")} style={s} />
    </span>
  );
}

/** LEND & LOOP mark: two linked rings (one lends, one loops back) and a wordmark in Manrope. */
export function LogoMark({ size = 28, onNight = false }: { size?: number; onNight?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="12.5" cy="16" r="7" fill="none" stroke={onNight ? "#F5F2EA" : "rgb(var(--night))"} strokeWidth="2.8" />
      <circle cx="19.5" cy="16" r="7" fill="none" stroke="rgb(var(--lamp))" strokeWidth="2.8" />
    </svg>
  );
}

export function Logo({ onNight = false }: { onNight?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark onNight={onNight} />
      <span className={clsx("font-display text-[15px] font-extrabold uppercase leading-none", onNight ? "text-white" : "text-ink")} style={{ letterSpacing: "0.1em" }}>
        Lend <span className="text-lamp">&amp;</span> Loop
      </span>
    </span>
  );
}
