import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ResourceCard } from "@/components/ResourceCard";
import { Button, EmptyState, ErrorState, Input, PageHeader, Pagination, Select, Skeleton } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { api, errMsg } from "@/lib/api";
import { localToISO, moneyPlain, plusHours } from "@/lib/format";
import { CATEGORIES, MatchResult, Page, Resource } from "@/lib/types";

export default function Explore({ base = "/explore" }: { base?: string }) {
  const [sp, setSp] = useSearchParams();
  const { user } = useAuth();
  const get = (k: string) => sp.get(k) ?? "";
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); if (k !== "page") n.delete("page"); setSp(n, { replace: true }); };
  const page = Number(get("page") || 1);
  const from = get("from"), to = get("to");
  const params = { q: get("q"), category: get("category"), free_only: get("free") === "1" || undefined, max_price: get("max"), condition: get("condition"),
    area: get("area"), sort: get("sort") || "newest", page, page_size: 12,
    available_from: from ? localToISO(from) : undefined, available_to: from && to ? localToISO(to) : undefined };
  const q = useQuery({ queryKey: ["resources", params], queryFn: () => api.get<Page<Resource>>("/api/resources", params) });

  const [m, setM] = useState({ category: "projector", start: plusHours(48), end: plusHours(54), budget: "", area: "", keywords: "" });
  const [mp, setMp] = useState<{ start: string; end: string; category: string; budget: string; area: string; keywords: string } | null>(null);
  const matches = useQuery({ enabled: !!mp, queryKey: ["match", mp], queryFn: () => api.get<MatchResult>("/api/matching", {
    start: localToISO(mp!.start), end: localToISO(mp!.end), category: mp!.category, max_price_per_day: mp!.budget, area: mp!.area, keywords: mp!.keywords }) });

  return (
    <div className={base === "/explore" ? "container-x py-8" : ""}>
      <PageHeader title="Browse resources" subtitle="Equipment students are sharing on campus. Only resources with an offered time window can be booked." />
      {base !== "/explore" && (
        <section className="panel panel-pad mb-6" aria-labelledby="match-h">
          <h2 id="match-h" className="flex items-center gap-2 text-lg"><Sparkles className="h-5 w-5 text-lamp-700" aria-hidden />Smart match</h2>
          <p className="mb-3 text-sm text-ink-3">Tell us what you need and when. Only resources that are free for your whole period are ranked.</p>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(e) => { e.preventDefault(); setMp(m); }}>
            <Select label="Category" value={m.category} onChange={(e) => setM({ ...m, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select>
            <Input label="From" type="datetime-local" value={m.start} onChange={(e) => setM({ ...m, start: e.target.value })} />
            <Input label="Until" type="datetime-local" value={m.end} onChange={(e) => setM({ ...m, end: e.target.value })} />
            <Input label="Budget per day (₹)" optional type="number" min={0} value={m.budget} onChange={(e) => setM({ ...m, budget: e.target.value })} />
            <Input label="Preferred pickup area" optional value={m.area} onChange={(e) => setM({ ...m, area: e.target.value })} />
            <Input label="Keywords" optional value={m.keywords} onChange={(e) => setM({ ...m, keywords: e.target.value })} />
            <div className="sm:col-span-2 lg:col-span-3"><Button type="submit">Find matches</Button></div>
          </form>
          {matches.isFetching && <div className="mt-4"><Skeleton className="h-24" /></div>}
          {matches.isError && <div className="mt-4"><ErrorState message={errMsg(matches.error)} /></div>}
          {matches.data && !matches.isFetching && (
            <div className="mt-5">
              <p className="text-sm text-ink-3">{matches.data.matches.length} bookable of {matches.data.considered} considered. {matches.data.excluded_unavailable} unavailable for these dates{matches.data.excluded_over_budget ? `, ${matches.data.excluded_over_budget} over budget` : ""}.</p>
              {!matches.data.matches.length ? <p className="mt-3 text-sm">No resource is free for that whole period. Try different dates.</p> : (
                <ul className="mt-3 space-y-3">
                  {matches.data.matches.map((x) => (
                    <li key={x.resource.id} className="rounded-panel border border-line p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div><Link className="link font-medium" to={`${base}/${x.resource.id}`}>{x.resource.name}</Link>
                          <p className="text-sm text-ink-3">Estimated {moneyPlain(x.estimated_cost)} + refundable demo deposit {moneyPlain(x.deposit)}{x.newly_activated ? " · newly shared after a predicted shortage" : ""}</p></div>
                        <span className="num rounded-ctl bg-night px-2 py-1 text-sm font-semibold text-white">{x.score}% match</span>
                      </div>
                      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">{x.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                    </li>
                  ))}
                </ul>)}
              <p className="mt-3 text-xs text-ink-3">{matches.data.method}</p>
            </div>
          )}
        </section>
      )}
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <form className="panel panel-pad h-fit space-y-3" onSubmit={(e) => e.preventDefault()} aria-label="Filters">
          <Input label="Search" value={get("q")} onChange={(e) => set("q", e.target.value)} placeholder="Name or description" />
          <Select label="Category" value={get("category")} onChange={(e) => set("category", e.target.value)}><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select>
          <Input label="Max price per day (₹)" type="number" min={0} value={get("max")} onChange={(e) => set("max", e.target.value)} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={get("free") === "1"} onChange={(e) => set("free", e.target.checked ? "1" : "")} />Free to borrow only</label>
          <Select label="Condition" value={get("condition")} onChange={(e) => set("condition", e.target.value)}><option value="">Any</option>{["new", "good", "fair"].map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}</Select>
          <Input label="Pickup area" value={get("area")} onChange={(e) => set("area", e.target.value)} />
          <Input label="Available from" type="datetime-local" value={from} onChange={(e) => set("from", e.target.value)} />
          <Input label="Available until" type="datetime-local" value={to} onChange={(e) => set("to", e.target.value)} hint="Needs both dates." />
          <Select label="Sort by" value={params.sort} onChange={(e) => set("sort", e.target.value)}><option value="newest">Newest</option><option value="price_asc">Price, low to high</option><option value="price_desc">Price, high to low</option><option value="name">Name</option></Select>
          <Button variant="ghost" size="sm" onClick={() => setSp({}, { replace: true })}>Clear filters</Button>
        </form>
        <div>
          {q.isLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64" />)}</div>
            : q.isError ? <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} />
            : !q.data!.items.length ? <EmptyState title="No resources match" action={<Button variant="secondary" onClick={() => setSp({}, { replace: true })}>Clear filters</Button>}>Try fewer filters or a different search.</EmptyState>
            : <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{q.data!.items.map((r) => <ResourceCard key={r.id} r={r} to={`${base}/${r.id}`} />)}</div>
              <Pagination page={q.data!.page} pages={q.data!.pages} total={q.data!.total} onChange={(p) => set("page", String(p))} />
            </>}
          {!user && <p className="mt-6 text-sm text-ink-3"><Link to="/login" className="link">Sign in</Link> to request bookings and use smart matching.</p>}
        </div>
      </div>
    </div>
  );
}
