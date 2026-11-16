import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Cpu,
  Layers,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Photo } from "@/components/Photo";
import { LinkButton, Pilot } from "@/components/ui";
import { api } from "@/lib/api";
import { CategoryIcon } from "@/lib/categories";
import { money } from "@/lib/format";
import type { Page, Resource } from "@/lib/types";

const STEPS = [
  {
    num: "01",
    title: "Discover Campus Gear",
    desc: "Find equipment, lab kits, cameras, and spaces available across your college. Filter by dates, category, and campus area.",
    icon: Search,
  },
  {
    num: "02",
    title: "Request with Confidence",
    desc: "Reserve dates with smart conflict checks. The platform guarantees no double-bookings and calculates fair demo deposits.",
    icon: Layers,
  },
  {
    num: "03",
    title: "Lend, Loop & Build Trust",
    desc: "Owners approve with one tap. Condition inspections at pickup and return ensure total accountability and trusted reviews.",
    icon: RefreshCw,
  },
] as const;

const WHY = [
  {
    title: "Reduce Unnecessary Purchases",
    desc: "Borrow high-end equipment like 4K projectors or VR headsets for one project instead of buying costly single-use gear.",
    icon: RefreshCw,
  },
  {
    title: "Intelligent Predictive Activation",
    desc: "When a campus shortage is forecast for an upcoming event or exam week, owners of idle items are notified to activate and earn.",
    icon: Radio,
  },
  {
    title: "Verified Student Community",
    desc: "Only registered students with verified college credentials can list or book, establishing safety from day one.",
    icon: ShieldCheck,
  },
  {
    title: "Transparent Condition Checks",
    desc: "Handover checklists log condition at handover and return, removing disputes and protecting both borrowers and owners.",
    icon: CheckCircle2,
  },
  {
    title: "Equal Equipment Access",
    desc: "Democratizes access so every student has the tools they need for labs, research, hackathons, and creative projects.",
    icon: Users,
  },
  {
    title: "ML Demand Forecasting",
    desc: "Real-time demand models analyze campus calendar trends, closing supply gaps before students even search.",
    icon: Cpu,
  },
] as const;

function Shelf({ items }: { items: Resource[] }) {
  return (
    <aside
      aria-labelledby="shelf-h"
      className="rounded-panel-lg border border-white/10 bg-white/10 backdrop-blur-xl p-5 sm:p-6 text-white shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
        <div className="flex items-center gap-2">
          <Pilot state="lit" size={8} />
          <h2 id="shelf-h" className="text-sm font-bold uppercase tracking-wider text-white">
            Available on Campus Now
          </h2>
        </div>
        <Link to="/explore" className="inline-flex items-center gap-1 text-xs font-semibold text-lamp hover:underline">
          Browse all <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="py-8 text-center text-sm text-white/70">
          <p>Listings from verified students will appear here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-white/10">
          {items.map((r) => (
            <li key={r.id}>
              <Link
                to={`/explore/${r.id}`}
                className="group flex items-center gap-3.5 py-3 transition-colors hover:text-lamp"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ctl bg-white/10 text-white group-hover:bg-lamp group-hover:text-slate-950 transition-colors">
                  <CategoryIcon category={r.category} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-white group-hover:text-lamp">
                    {r.name}
                  </span>
                  <span className="block truncate text-xs text-white/60">
                    {r.category_label} · {r.pickup_area || "Campus Hub"}
                  </span>
                </span>
                <span className="num rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-white group-hover:bg-white/20">
                  {money(r.price_per_day)}
                  {!!r.price_per_day && <span className="font-normal text-white/60">/d</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 border-t border-white/10 pt-3 flex items-center justify-between text-[11px] text-white/60">
        <span>Verified student inventory</span>
        <span className="text-lamp font-medium">Instant Booking</span>
      </div>
    </aside>
  );
}

export default function Landing() {
  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<{ value: string; label: string; count: number }[]>("/api/resources/categories"),
  });
  const feat = useQuery({
    queryKey: ["featured"],
    queryFn: () => api.get<Page<Resource>>("/api/resources", { page_size: 5 }),
  });
  const total = (cats.data ?? []).reduce((n, c) => n + c.count, 0);

  return (
    <>
      {/* Hero Section */}
      <section className="on-night relative overflow-hidden border-b border-white/10">
        {/* Ambient Gradient Glows */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-cobalt/20 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 -z-10 h-[350px] w-[450px] rounded-full bg-lamp/15 blur-[100px]" />

        <div className="container-x grid gap-12 py-16 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-28">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1 text-xs font-medium text-white/90 backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-lamp" />
              <span>Campus Predictive Resource Activation</span>
            </div>

            <h1 className="mt-5 text-4xl sm:text-6xl lg:text-[4rem] font-extrabold tracking-tight leading-[1.08] text-white">
              Your Campus Has More. <br />
              <span className="bg-gradient-to-r from-lamp via-amber-300 to-lamp bg-clip-text text-transparent">
                Share &amp; Activate It.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-base sm:text-lg text-white/80 leading-relaxed">
              Discover, borrow, and share the equipment, lab kits, and spaces your campus already owns. Intelligent demand forecasting helps students activate underused gear before shortages happen.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <LinkButton to="/explore" variant="lamp" size="lg" className="shadow-lg shadow-lamp/20">
                Explore Resources
              </LinkButton>
              <LinkButton
                to="/register"
                variant="secondary"
                size="lg"
                className="!border-white/30 !bg-white/10 !text-white hover:!bg-white/20 backdrop-blur-md"
              >
                Join Campus Network
              </LinkButton>
            </div>

            {total > 0 && (
              <div className="mt-10 flex flex-wrap items-center gap-6 border-t border-white/15 pt-5 text-sm text-white/70">
                <div className="flex items-baseline gap-2">
                  <span className="num font-display text-2xl font-extrabold text-white">{total}</span>
                  <span className="text-xs uppercase tracking-wider text-white/60">Live Resources</span>
                </div>
                <div className="h-4 w-px bg-white/20" />
                <div className="flex items-baseline gap-2">
                  <span className="num font-display text-2xl font-extrabold text-white">{cats.data?.length ?? 0}</span>
                  <span className="text-xs uppercase tracking-wider text-white/60">Categories</span>
                </div>
                <div className="h-4 w-px bg-white/20" />
                <div className="flex items-center gap-1.5 text-xs text-white/75">
                  <ShieldCheck className="h-4 w-4 text-go" />
                  <span>Verified Student ID Only</span>
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <Photo
              src="/images/hero.jpg"
              alt="Students sharing equipment on campus"
              className="aspect-[4/3] w-full rounded-panel-lg border border-white/15 object-cover shadow-2xl"
              fallback={<Shelf items={feat.data?.items ?? []} />}
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-h" className="container-x py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Seamless Experience</p>
          <h2 id="how-h" className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">
            How LEND &amp; LOOP Works
          </h2>
          <p className="mt-3 text-base text-ink-2">
            A trusted circular economy engineered for college campuses. Three simple steps from request to return.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.num}
                className="group relative rounded-panel border border-line bg-white p-7 shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-cobalt/30 hover:shadow-lift"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-cobalt-50 text-cobalt transition-colors group-hover:bg-cobalt group-hover:text-white">
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="num font-display text-3xl font-extrabold text-ink-3/40 group-hover:text-cobalt/40 transition-colors">
                    {s.num}
                  </span>
                </div>
                <h3 className="mt-5 text-xl font-bold text-ink">{s.title}</h3>
                <p className="mt-2 text-sm text-ink-2 leading-relaxed">{s.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex justify-center">
          <LinkButton to="/how-it-works" variant="secondary">
            Read the full workflow guide &rarr;
          </LinkButton>
        </div>
      </section>

      {/* Categories Grid */}
      <section aria-labelledby="cat-h" className="border-y border-line/80 bg-paper-2/40 py-20 sm:py-24">
        <div className="container-x">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Explore Inventory</p>
              <h2 id="cat-h" className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">
                What Campus Peers Are Sharing
              </h2>
            </div>
            <Link to="/explore" className="link inline-flex items-center gap-1 text-sm font-semibold">
              Explore entire catalog <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          {cats.isError ? (
            <p className="mt-8 text-sm text-ink-2">
              Categories could not be loaded right now.{" "}
              <Link to="/explore" className="link">
                Browse all resources
              </Link>
              .
            </p>
          ) : (
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(cats.data ?? []).map((c) => (
                <Link
                  key={c.value}
                  to={`/explore?category=${c.value}`}
                  className="group flex items-center justify-between rounded-panel border border-line bg-white p-4.5 shadow-subtle transition-all duration-200 hover:-translate-y-0.5 hover:border-cobalt/30 hover:shadow-card"
                >
                  <div className="flex items-center gap-3.5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-ctl bg-paper-2 text-ink-2 transition-colors group-hover:bg-cobalt-50 group-hover:text-cobalt">
                      <CategoryIcon category={c.value} className="h-5 w-5" />
                    </span>
                    <div>
                      <span className="block font-bold text-ink transition-colors group-hover:text-cobalt">
                        {c.label}
                      </span>
                      <span className="num text-xs text-ink-3">{c.count} items listed</span>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-ink-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-cobalt" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Why Choose Section */}
      <section aria-labelledby="why-h" className="on-night border-b border-white/10 py-20 sm:py-28">
        <div className="container-x">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow text-lamp">The Campus Advantage</p>
            <h2 id="why-h" className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Built Specifically for Student Resource Sharing
            </h2>
            <p className="mt-3 text-base text-white/70">
              Most equipment on campus sits unused 85% of the time. We turn idle equipment into active shared capacity.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {WHY.map((w) => {
              const Icon = w.icon;
              return (
                <div
                  key={w.title}
                  className="rounded-panel border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all duration-200 hover:bg-white/[0.08]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-ctl bg-white/10 text-lamp mb-4">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-lg font-bold text-white">{w.title}</h3>
                  <p className="mt-2 text-sm text-white/70 leading-relaxed">{w.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section aria-labelledby="cta-h" className="container-x py-20 sm:py-28">
        <div className="relative overflow-hidden rounded-panel-lg border border-line bg-gradient-to-br from-white via-paper to-cobalt-50/40 p-8 sm:p-14 shadow-card">
          <div className="grid items-center gap-8 lg:grid-cols-[1.3fr_0.7fr]">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cobalt-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cobalt">
                <Sparkles className="h-3.5 w-3.5" /> Start Today
              </span>
              <h2 id="cta-h" className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink leading-tight">
                Someone on your campus has what you need. <br />
                <span className="text-cobalt">Someone needs what you have.</span>
              </h2>
              <p className="mt-3 max-w-xl text-base text-ink-2">
                Join hundreds of students borrowing equipment, reducing costs, and making their campus resources work smarter.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3.5 lg:justify-end">
              <LinkButton to="/register" size="lg" variant="primary">
                Get Started Free
              </LinkButton>
              <LinkButton to="/explore" variant="secondary" size="lg">
                Explore Resources
              </LinkButton>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
