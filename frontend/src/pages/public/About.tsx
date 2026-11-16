import { CheckCircle2, Code2, Database, ShieldCheck, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui";

const STACK = [
  { name: "React 18 & Vite", desc: "Fast component rendering with TypeScript" },
  { name: "Tailwind CSS", desc: "Utility-first modern design token architecture" },
  { name: "FastAPI & Python 3.12", desc: "High-performance asynchronous REST backend" },
  { name: "PostgreSQL & SQLAlchemy 2", desc: "Relational persistence with GiST overlap constraints" },
  { name: "Scikit-Learn & Pandas", desc: "Ridge, Gradient Boosting & baseline forecast models" },
  { name: "Argon2id & Cookie Auth", desc: "Modern cryptographic security & CSRF protection" },
];

export default function About() {
  return (
    <div className="container-x max-w-4xl py-12">
      <PageHeader
        title="About LEND &amp; LOOP"
        subtitle="An intelligent campus resource-sharing platform bridging student equipment demand with predictive idle activation."
      />

      <div className="mt-8 space-y-8">
        <section className="panel p-6 sm:p-8 shadow-card">
          <h2 className="text-xl font-bold text-ink">The Campus Problem &amp; Our Solution</h2>
          <div className="mt-3 space-y-3.5 text-sm text-ink-2 leading-relaxed">
            <p>
              Students frequently spend significant money purchasing specialized lab kits, cameras, calculators, and tools for single-semester coursework or hackathons — while identical gear gathers dust in dorms and lockers across campus.
            </p>
            <p>
              When exam seasons or project deadlines converge, traditional bulletin boards and listing apps fail because they cannot foresee shortages.
            </p>
            <p>
              <strong>LEND &amp; LOOP</strong> introduces a closed-loop intelligence system: it continuously projects demand surges, identifies verified idle resources that can close the gap, and sends timely, respectful activation requests to gear owners.
            </p>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-panel border border-line bg-white p-5 shadow-subtle">
            <div className="flex items-center gap-2 font-bold text-sm text-ink">
              <CheckCircle2 className="h-4.5 w-4.5 text-go" />
              <span>Core Guarantees</span>
            </div>
            <ul className="mt-3 space-y-2 text-xs text-ink-2">
              <li>• <strong>100% Consent-Based:</strong> Owners always hold absolute decision power.</li>
              <li>• <strong>Zero Double-Bookings:</strong> Database exclusion constraints guarantee no scheduling overlap.</li>
              <li>• <strong>Verified Student IDs:</strong> Only college-verified members can borrow or list.</li>
              <li>• <strong>Transparent Condition Checks:</strong> Photo inspections on pickup and dropoff.</li>
            </ul>
          </div>

          <div className="rounded-panel border border-line bg-white p-5 shadow-subtle">
            <div className="flex items-center gap-2 font-bold text-sm text-ink">
              <ShieldCheck className="h-4.5 w-4.5 text-lamp-700" />
              <span>Project Scope &amp; Transparency</span>
            </div>
            <ul className="mt-3 space-y-2 text-xs text-ink-2">
              <li>• <strong>Simulated Payments:</strong> Created for academic and demonstration purposes; no real fiat moves.</li>
              <li>• <strong>Honest Model Labels:</strong> Synthetic historical demo data is explicitly labelled.</li>
              <li>• <strong>Dispute Resolution:</strong> Deposits are never forfeited without admin review.</li>
              <li>• <strong>Decision Support:</strong> Forecasts act as advisory guidance for campus communities.</li>
            </ul>
          </div>
        </section>

        <section className="panel p-6 sm:p-8 shadow-card">
          <div className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-cobalt" />
            <h2 className="text-xl font-bold text-ink">Engineering Stack</h2>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STACK.map((s) => (
              <div key={s.name} className="rounded-ctl bg-paper-2/60 border border-line/60 p-3.5">
                <p className="font-bold text-xs text-ink">{s.name}</p>
                <p className="mt-1 text-[11px] text-ink-3">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
