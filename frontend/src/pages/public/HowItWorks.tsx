import { ArrowRight, CheckCircle2, Cpu, HelpCircle, Layers, RefreshCw, ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import { LinkButton, PageHeader } from "@/components/ui";

const STEPS = [
  {
    title: "Register & Verify Student Identity",
    desc: "Create an account, verify your college email, and submit your student details. A campus administrator reviews credentials before booking or listing is unlocked.",
    icon: UserCheck,
  },
  {
    title: "List or Discover Gear",
    desc: "Owners list underused items with photos, specs, fair pricing, and available calendar slots. Students find what they need with live availability filters and smart matching.",
    icon: Layers,
  },
  {
    title: "Request & Instant Overlap Protection",
    desc: "Send a reservation request. Our backend enforces database-level exclusion constraints to mathematically prevent double-bookings, even during concurrent requests.",
    icon: ShieldCheck,
  },
  {
    title: "Handoff, Return & Condition Ledger",
    desc: "Borrowers inspect items during pickup, record status, and log condition upon return. Transparent documentation removes disputes and keeps everyone safe.",
    icon: RefreshCw,
  },
  {
    title: "Build Campus Reputation",
    desc: "After every completed rental, both borrower and owner rate each other. On-time returns, gear care, and completed exchanges build verified trust scores.",
    icon: CheckCircle2,
  },
];

export default function HowItWorks() {
  return (
    <div className="container-x py-12">
      <PageHeader
        title="How LEND &amp; LOOP Works"
        subtitle="From verified onboarding to handovers and returns — plus the machine learning activation loop behind the platform."
      />

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.3fr_0.9fr]">
        <ol className="space-y-4">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <li
                key={s.title}
                className="panel p-6 shadow-card transition-all duration-200 hover:shadow-lift"
              >
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cobalt-50 text-cobalt font-bold text-sm">
                    0{i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4.5 w-4.5 text-cobalt" />
                      <h2 className="text-base font-bold text-ink">{s.title}</h2>
                    </div>
                    <p className="mt-1.5 text-sm text-ink-2 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <aside className="space-y-6">
          <section className="on-night rounded-panel-lg border border-white/10 p-7 shadow-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-lamp">
              <Cpu className="h-3.5 w-3.5" />
              <span>Predictive Activation Engine</span>
            </div>
            <h2 className="mt-4 text-2xl font-extrabold text-white">The Activation Loop</h2>
            <p className="mt-3 text-sm text-white/75 leading-relaxed">
              The platform analyzes historical booking patterns and campus event schedules to project weekly demand by category.
            </p>
            <div className="mt-5 space-y-3 border-y border-white/10 py-4 text-xs text-white/80">
              <div className="flex items-start gap-2.5">
                <span className="num font-bold text-lamp">1. Forecast</span>
                <span>Ridge regression &amp; gradient boosting predict impending category shortages.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="num font-bold text-lamp">2. Detect</span>
                <span>Scans verified campus inventories for underused, high-quality idle gear.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="num font-bold text-lamp">3. Ask</span>
                <span>Alerts owners with dates and potential earnings. Activation requires explicit consent.</span>
              </div>
            </div>
            <p className="mt-4 text-[11px] text-white/60">
              New rentals continuously refine model weights for subsequent predictions.
            </p>
          </section>

          <div className="panel p-6 text-center shadow-card">
            <Sparkles className="mx-auto h-8 w-8 text-lamp" />
            <h3 className="mt-2 text-base font-bold text-ink">Ready to get started?</h3>
            <p className="mt-1 text-xs text-ink-2">Join fellow students in unlocking idle gear across your campus.</p>
            <div className="mt-4 flex flex-col gap-2">
              <LinkButton to="/register" variant="primary">Create Student Account</LinkButton>
              <LinkButton to="/explore" variant="secondary">Browse Live Catalog</LinkButton>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
