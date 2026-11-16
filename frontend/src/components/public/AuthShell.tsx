import { Check, ShieldCheck, Sparkles } from "lucide-react";
import { ReactNode } from "react";
import { LogoMark } from "@/components/ui";

const NEXT = [
  ["Confirm your email", "Follow the instant link provided to verify your college address."],
  ["Get student verified", "Campus administrators review your student ID for verified access."],
  ["Borrow and lend", "Request lab kits, gear, and cameras, or list underused items."],
] as const;

const POINTS = [
  "Verified student identity only — no anonymous accounts.",
  "Owners approve every request before anything is lent.",
  "Predictive demand activation alerts idle gear owners responsibly.",
  "Simulated campus payments with complete audit transparency.",
];

/** Split frame for auth pages: modern dark feature panel on the left (desktop), clean card form on the right. */
export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[5fr_6fr]">
      <aside className="on-night hidden lg:block border-r border-white/10">
        <div className="sticky top-0 mx-auto flex h-[calc(100vh-4rem)] min-h-[36rem] max-w-md flex-col justify-center px-10 py-12">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-lamp" />
              <span>Campus Resource Activation Network</span>
            </div>
            <div className="mt-6">
              <LogoMark size={46} onNight />
            </div>
            {eyebrow && <p className="eyebrow mt-6">{eyebrow}</p>}
            <h2 className="mt-2 text-3xl font-extrabold leading-tight text-white sm:text-4xl">
              Your campus has more. <span className="text-lamp">Share it.</span>
            </h2>
            <p className="mt-3 text-sm text-white/75 leading-relaxed">
              LEND &amp; LOOP connects students who need equipment with people who have gear to share — with predictive demand forecasting and verified trust.
            </p>

            <ol className="mt-8 space-y-3.5 text-xs text-white/85" aria-label="What happens next">
              {NEXT.map(([t, d], i) => (
                <li key={t} className="flex items-start gap-3.5 rounded-ctl bg-white/5 p-3 border border-white/5">
                  <span aria-hidden className="num font-display text-lg font-extrabold leading-none text-lamp">
                    0{i + 1}
                  </span>
                  <div>
                    <span className="block font-bold text-white text-sm">{t}</span>
                    <span className="mt-0.5 block text-white/70">{d}</span>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <ul className="mt-8 space-y-2 border-t border-white/10 pt-5 text-xs text-white/80">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lamp" aria-hidden />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <section className="px-4 py-10 sm:px-6 lg:flex lg:items-center lg:justify-center lg:py-14">
        <div className="mx-auto w-full max-w-md lg:max-w-lg">
          <div className="rounded-panel border border-line bg-white p-6 sm:p-8 shadow-card">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h1 className="mt-1.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-ink-2 leading-relaxed">{subtitle}</p>}
            <div className="mt-6">{children}</div>
            {footer && <div className="mt-6 border-t border-line/80 pt-4 text-xs sm:text-sm text-ink-2">{footer}</div>}
          </div>
        </div>
      </section>
    </div>
  );
}

export function DevBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="note" className="rounded-ctl border border-lamp/40 bg-lamp-50/70 p-4 text-xs sm:text-sm shadow-subtle">
      <div className="flex items-center gap-1.5 font-bold text-slate-950">
        <ShieldCheck className="h-4 w-4 text-lamp-700" />
        <span>Development mode: {title}</span>
      </div>
      <div className="mt-1 text-ink-2 leading-relaxed">{children}</div>
    </div>
  );
}
