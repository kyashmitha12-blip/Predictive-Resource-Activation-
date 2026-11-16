import clsx from "clsx";

/** Status dot: hollow = idle, solid glowing amber = active/shared, pulsing = waiting. */
export function Pilot({ state = "idle", size = 10, className }: { state?: "idle" | "lit" | "pending"; size?: number; className?: string }) {
  const s = { width: size, height: size };
  return (
    <span aria-hidden className={clsx("relative inline-flex items-center justify-center shrink-0", className)} style={s}>
      {state === "lit" && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lamp opacity-40" />
      )}
      {state === "pending" && (
        <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-lamp/50" />
      )}
      <span
        className={clsx(
          "relative rounded-full transition-colors",
          state === "lit"
            ? "bg-lamp shadow-[0_0_8px_rgba(245,158,11,0.6)]"
            : state === "pending"
            ? "border-[1.5px] border-lamp bg-lamp/30"
            : "border-[1.5px] border-ink-3/70 bg-transparent"
        )}
        style={s}
      />
    </span>
  );
}

/** LEND & LOOP mark: two dynamically linked rings (one lends, one loops back) with modern gradients. */
export function LogoMark({ size = 28, onNight = false }: { size?: number; onNight?: boolean }) {
  const strokeColor = onNight ? "#FFFFFF" : "rgb(var(--cobalt))";
  const loopColor = "rgb(var(--lamp))";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden className="shrink-0 transition-transform hover:scale-105">
      <defs>
        <linearGradient id={`grad-lend-${onNight ? "dark" : "light"}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={strokeColor} />
          <stop offset="100%" stopColor={onNight ? "#CBD5E1" : "rgb(var(--cobalt-700))"} />
        </linearGradient>
      </defs>
      <circle cx="12.5" cy="16" r="7" stroke={`url(#grad-lend-${onNight ? "dark" : "light"})`} strokeWidth="3" strokeLinecap="round" />
      <circle cx="19.5" cy="16" r="7" stroke={loopColor} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ onNight = false }: { onNight?: boolean }) {
  return (
    <span className="group inline-flex items-center gap-2.5">
      <LogoMark onNight={onNight} />
      <span className={clsx("font-display text-[15px] font-extrabold tracking-wider uppercase leading-none transition-colors", onNight ? "text-white" : "text-ink")}>
        Lend <span className="text-lamp transition-transform group-hover:scale-110 inline-block">&amp;</span> Loop
      </span>
    </span>
  );
}
