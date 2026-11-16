import clsx from "clsx";
import { ReactNode } from "react";

/** Surface for grouped content. tone: "white" (default), "stone" (recessed), "forest" (dark feature block). */
export function Card({ tone = "white", pad = true, className, children }: { tone?: "white" | "stone" | "forest"; pad?: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={clsx("rounded-panel border", pad && "p-5", tone === "white" && "border-line bg-white", tone === "stone" && "border-line bg-paper-2", tone === "forest" && "on-night border-white/10", className)}>
      {children}
    </div>
  );
}

/** Eyebrow + heading + optional lead, used to open page sections consistently. */
export function SectionHeading({ eyebrow, title, lead, as: H = "h2", className }: { eyebrow?: string; title: ReactNode; lead?: ReactNode; as?: "h1" | "h2" | "h3"; className?: string }) {
  return (
    <div className={className}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <H className={clsx(eyebrow && "mt-2", "text-3xl")}>{title}</H>
      {lead && <p className="mt-2 max-w-2xl text-ink-2">{lead}</p>}
    </div>
  );
}
