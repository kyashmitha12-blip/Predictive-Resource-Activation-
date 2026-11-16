import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Photo } from "@/components/Photo";
import { LinkButton } from "@/components/ui";
import { api } from "@/lib/api";
import { CategoryIcon } from "@/lib/categories";
import { money } from "@/lib/format";
import type { Page, Resource } from "@/lib/types";

const STEPS = [
  ["Discover", "Find equipment and spaces available in your campus. Filter by category, pickup area and price, and see who is lending."],
  ["Request", "Send a borrowing or booking request for the dates you need. The server refuses any overlap with a confirmed booking."],
  ["Share", "Get owner approval, use the resource and return it responsibly. Condition is recorded on both sides and reviews build trust."],
] as const;

const WHY = [
  ["Reduce unnecessary purchases", "Borrow the projector for one event instead of buying one."],
  ["Make underused resources useful", "Gear that sits in a cupboard for months earns its keep. When a shortage is forecast, owners of idle items are asked, never assumed, to share."],
  ["Encourage responsible sharing", "Every handover and return records the item's condition, so care is visible."],
  ["Improve access to equipment", "Students who cannot afford a camera or a lab kit still get to use one."],
  ["Build a trusted campus community", "Only verified students can list or book, and both sides review each rental."],
] as const;

function Shelf({ items }: { items: Resource[] }) {
  return (
    <aside aria-labelledby="shelf-h" className="rounded-panel bg-paper p-5 text-ink shadow-lift sm:p-6">
      <div className="flex items-baseline justify-between border-b border-line pb-3">
        <h2 id="shelf-h" className="!text-ink text-base">On the shelf right now</h2>
        <Link to="/explore" className="link inline-flex items-center gap-1 text-sm">Browse all <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
      </div>
      {items.length === 0 ? <p className="py-6 text-sm text-ink-3">Listings from verified students appear here.</p> : (
        <ul className="divide-y divide-line">
          {items.map((r) => (
            <li key={r.id}>
              <Link to={`/explore/${r.id}`} className="flex items-center gap-3 py-3 hover:text-cobalt">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ctl bg-paper-2 text-ink-2"><CategoryIcon category={r.category} className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{r.name}</span><span className="block truncate text-sm text-ink-3">{r.category_label} · {r.pickup_area || "Campus"}</span></span>
                <span className="num text-sm font-semibold">{money(r.price_per_day)}{!!r.price_per_day && <span className="font-normal text-ink-3">/day</span>}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-line pt-3 text-xs text-ink-3">Live from the platform. Prices are per day; payments are simulated.</p>
    </aside>
  );
}

export default function Landing() {
  const cats = useQuery({ queryKey: ["categories"], queryFn: () => api.get<{ value: string; label: string; count: number }[]>("/api/resources/categories") });
  const feat = useQuery({ queryKey: ["featured"], queryFn: () => api.get<Page<Resource>>("/api/resources", { page_size: 5 }) });
  const total = (cats.data ?? []).reduce((n, c) => n + c.count, 0);
  return (
    <>
      {/* Hero */}
      <section className="on-night">
        <div className="container-x grid gap-12 py-14 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-28">
          <div>
            <p className="eyebrow">Share More. Own Less.</p>
            <h1 className="mt-4 text-[2.6rem] leading-[1.05] sm:text-6xl lg:text-[4.25rem]">Your Campus Has More. <span className="whitespace-nowrap text-lamp">Share It.</span></h1>
            <p className="mt-6 max-w-xl text-lg text-white/80">Discover, borrow and share the equipment and spaces your campus already has. Make better use of existing resources, together.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton to="/explore" variant="lamp" size="lg">Explore Resources</LinkButton>
              <LinkButton to="/register" variant="secondary" size="lg" className="!border-white/40 !bg-transparent !text-white hover:!bg-white/10">Join LEND &amp; LOOP</LinkButton>
            </div>
            {total > 0 && <p className="num mt-8 border-t border-white/15 pt-4 text-sm text-white/70"><span className="font-display text-2xl font-extrabold text-white">{total}</span> resources currently listed across {cats.data?.length} categories</p>}
          </div>
          <Photo src="/images/hero.jpg" alt="Students sharing equipment on campus" className="aspect-[4/3] w-full rounded-panel object-cover" fallback={<Shelf items={feat.data?.items ?? []} />} />
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-h" className="container-x py-16 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div><p className="eyebrow">How it works</p><h2 id="how-h" className="mt-3 text-3xl sm:text-4xl">Three steps from “I need one” to “thanks, returned”.</h2>
            <LinkButton to="/how-it-works" variant="secondary" className="mt-6">Read the full process</LinkButton></div>
          <ol className="divide-y divide-line border-y border-line">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="grid grid-cols-[3.5rem_1fr] gap-4 py-6 sm:grid-cols-[5rem_1fr]">
                <span aria-hidden className="num font-display text-4xl font-extrabold text-lamp sm:text-5xl">{i + 1}</span>
                <div><h3 className="text-xl">{t}</h3><p className="mt-1.5 max-w-prose text-ink-2">{d}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Categories: an index, not a card grid */}
      <section aria-labelledby="cat-h" className="bg-stone">
        <div className="container-x py-16 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Resource categories</p><h2 id="cat-h" className="mt-3 text-3xl sm:text-4xl">What students share</h2></div>
            <Link to="/explore" className="link inline-flex items-center gap-1 text-sm">Explore everything <ArrowRight className="h-4 w-4" aria-hidden /></Link></div>
          {cats.isError ? <p className="mt-8 text-ink-2">Categories could not be loaded right now. <Link to="/explore" className="link">Browse all resources</Link>.</p> : (
            <ul className="mt-8 grid gap-x-10 border-t border-line-2/40 md:grid-cols-2">
              {(cats.data ?? []).map((c) => (
                <li key={c.value} className="border-b border-line-2/40">
                  <Link to={`/explore?category=${c.value}`} className="group flex items-center gap-4 py-4">
                    <CategoryIcon category={c.value} className="h-6 w-6 shrink-0 text-ink-2" />
                    <span className="flex-1 font-display text-lg font-bold group-hover:text-cobalt">{c.label}</span>
                    <span className="num text-sm text-ink-3">{c.count} listed</span>
                    <ArrowUpRight className="h-4 w-4 text-ink-3 group-hover:text-lamp" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Why */}
      <section aria-labelledby="why-h" className="on-night">
        <div className="container-x grid gap-12 py-16 sm:py-24 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="eyebrow">Why LEND &amp; LOOP</p>
            <h2 id="why-h" className="mt-3 text-3xl sm:text-4xl">Most of what a campus owns sits unused most of the week.</h2>
            <p className="mt-4 max-w-md text-white/75">LEND &amp; LOOP puts that capacity back to work, and it watches demand so it can ask owners to help before a shortage hits.</p>
            <Photo src="/images/why.jpg" alt="A shared campus workshop" className="mt-8 aspect-[3/2] w-full rounded-panel object-cover" fallback={null} />
          </div>
          <ul className="divide-y divide-white/15 border-y border-white/15">
            {WHY.map(([t, d]) => <li key={t} className="py-5"><h3 className="text-lg text-white">{t}</h3><p className="mt-1 text-white/75">{d}</p></li>)}
          </ul>
        </div>
      </section>

      {/* Final CTA */}
      <section aria-labelledby="cta-h" className="container-x py-16 sm:py-24">
        <div className="grid items-end gap-8 border-y-2 border-ink py-12 lg:grid-cols-[1.4fr_1fr]">
          <h2 id="cta-h" className="text-3xl sm:text-5xl">Someone on your campus has what you need. Someone needs what you have.</h2>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <LinkButton to="/register" size="lg">Get Started</LinkButton>
            <LinkButton to="/explore" variant="secondary" size="lg">Explore Resources</LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}
