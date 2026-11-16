import { Check } from "lucide-react";
import { ReactNode } from "react";
import { LogoMark } from "@/components/ui";

const NEXT = [["Confirm your email", "Follow the link we prepare for you."], ["Get verified", "An administrator checks your student details."], ["Borrow and lend", "Request gear, or list your own."]] as const;
const POINTS = ["Only verified students can list and book.", "Owners approve every request before anything is lent.", "Payments are simulated; no real money moves."];

/** Split frame for sign-in style pages: forest editorial panel on the left (desktop), the form on ivory on the right. */
export function AuthShell({ eyebrow, title, subtitle, children, footer }: { eyebrow?: string; title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[5fr_6fr]">
      <aside className="on-night hidden lg:block">
        <div className="sticky top-0 mx-auto flex h-[calc(100vh-4rem)] min-h-[34rem] max-w-md flex-col justify-center px-10 py-14">
          <div>
            <LogoMark size={44} onNight />
            <p className="eyebrow mt-8">Share More. Own Less.</p>
            <h2 className="mt-3 text-4xl leading-tight text-white">Your campus has more. Share it.</h2>
            <p className="mt-4 text-white/75">LEND &amp; LOOP connects students who need equipment with people who have resources to lend.</p>
            <ol className="mt-10 space-y-4 text-sm text-white/85" aria-label="What happens next">
              {NEXT.map(([t, d], i) => <li key={t} className="flex gap-4"><span aria-hidden className="num font-display text-2xl font-extrabold leading-none text-lamp">{i + 1}</span><span><span className="block font-display font-bold text-white">{t}</span>{d}</span></li>)}
            </ol>
          </div>
          <ul className="mt-10 space-y-3 border-t border-white/15 pt-6 text-sm text-white/85">
            {POINTS.map((p) => <li key={p} className="flex items-start gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-lamp" aria-hidden />{p}</li>)}
          </ul>
        </div>
      </aside>
      <section className="px-4 py-10 sm:px-6 lg:flex lg:items-center lg:justify-center lg:py-14">
        <div className="mx-auto w-full max-w-md lg:max-w-lg">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className="mt-2 text-3xl sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-2 text-ink-2">{subtitle}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 border-t border-line pt-5 text-sm text-ink-2">{footer}</div>}
        </div>
      </section>
    </div>
  );
}

export function DevBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="note" className="rounded-panel border border-lamp/50 bg-lamp-50 p-4 text-sm">
      <p className="font-semibold text-lamp-700">Development mode: {title}</p>
      <div className="mt-1 text-ink-2">{children}</div>
    </div>
  );
}
