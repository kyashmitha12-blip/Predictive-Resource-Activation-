import { useQuery } from "@tanstack/react-query";
import { Filter, RotateCcw, Search, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ResourceCard } from "@/components/ResourceCard";
import { Button, Checkbox, EmptyState, ErrorState, Input, PageHeader, Pagination, Select, Skeleton } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { api, errMsg } from "@/lib/api";
import { localToISO, moneyPlain, plusHours } from "@/lib/format";
import { CATEGORIES, MatchResult, Page, Resource } from "@/lib/types";

export default function Explore({ base = "/explore" }: { base?: string }) {
  const [sp, setSp] = useSearchParams();
  const { user } = useAuth();
  const get = (k: string) => sp.get(k) ?? "";
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    v ? n.set(k, v) : n.delete(k);
    if (k !== "page") n.delete("page");
    setSp(n, { replace: true });
  };
  const page = Number(get("page") || 1);
  const from = get("from"), to = get("to");
  const params = {
    q: get("q"),
    category: get("category"),
    free_only: get("free") === "1" || undefined,
    max_price: get("max"),
    condition: get("condition"),
    area: get("area"),
    sort: get("sort") || "newest",
    page,
    page_size: 12,
    available_from: from ? localToISO(from) : undefined,
    available_to: from && to ? localToISO(to) : undefined,
  };
  const q = useQuery({ queryKey: ["resources", params], queryFn: () => api.get<Page<Resource>>("/api/resources", params) });

  const [m, setM] = useState({ category: "projector", start: plusHours(48), end: plusHours(54), budget: "", area: "", keywords: "" });
  const [mp, setMp] = useState<{ start: string; end: string; category: string; budget: string; area: string; keywords: string } | null>(null);
  const matches = useQuery({
    enabled: !!mp,
    queryKey: ["match", mp],
    queryFn: () =>
      api.get<MatchResult>("/api/matching", {
        start: localToISO(mp!.start),
        end: localToISO(mp!.end),
        category: mp!.category,
        max_price_per_day: mp!.budget,
        area: mp!.area,
        keywords: mp!.keywords,
      }),
  });

  const activeFiltersCount = [get("q"), get("category"), get("free"), get("max"), get("condition"), get("area"), from, to].filter(Boolean).length;

  return (
    <div className={base === "/explore" ? "container-x py-10" : ""}>
      <PageHeader
        title="Explore Campus Resources"
        subtitle="Discover verified equipment, lab gear, and creative spaces shared by campus peers."
      />

      {base !== "/explore" && (
        <section className="panel p-6 mb-8 border-cobalt/25 shadow-card" aria-labelledby="match-h">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-ctl bg-lamp/20 text-lamp-700">
              <Sparkles className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 id="match-h" className="text-lg font-bold text-ink">Smart Demand Matcher</h2>
              <p className="text-xs text-ink-3">Specify what you need. Our algorithm scores idle gear with full-window availability.</p>
            </div>
          </div>

          <form className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(e) => { e.preventDefault(); setMp(m); }}>
            <Select label="Category" value={m.category} onChange={(e) => setM({ ...m, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
            <Input label="Required From" type="datetime-local" value={m.start} onChange={(e) => setM({ ...m, start: e.target.value })} />
            <Input label="Required Until" type="datetime-local" value={m.end} onChange={(e) => setM({ ...m, end: e.target.value })} />
            <Input label="Max Budget per day (₹)" optional type="number" min={0} value={m.budget} onChange={(e) => setM({ ...m, budget: e.target.value })} />
            <Input label="Preferred Campus Area" optional value={m.area} onChange={(e) => setM({ ...m, area: e.target.value })} />
            <Input label="Keywords or Tags" optional value={m.keywords} onChange={(e) => setM({ ...m, keywords: e.target.value })} />
            <div className="sm:col-span-2 lg:col-span-3">
              <Button type="submit" variant="primary">Run Smart Match</Button>
            </div>
          </form>

          {matches.isFetching && <div className="mt-5"><Skeleton className="h-28" /></div>}
          {matches.isError && <div className="mt-5"><ErrorState message={errMsg(matches.error)} /></div>}
          {matches.data && !matches.isFetching && (
            <div className="mt-6 border-t border-line/70 pt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-2">
                {matches.data.matches.length} bookable of {matches.data.considered} considered · {matches.data.excluded_unavailable} unavailable
              </p>
              {!matches.data.matches.length ? (
                <p className="mt-3 text-sm text-ink-3">No resource is free for that whole period. Try expanding your dates.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {matches.data.matches.map((x) => (
                    <li key={x.resource.id} className="rounded-panel border border-line bg-paper/60 p-4 transition-all hover:bg-white hover:shadow-card">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <Link className="font-bold text-ink hover:text-cobalt text-base" to={`${base}/${x.resource.id}`}>
                            {x.resource.name}
                          </Link>
                          <p className="mt-0.5 text-xs text-ink-3">
                            Est. {moneyPlain(x.estimated_cost)} + refundable demo deposit {moneyPlain(x.deposit)}
                            {x.newly_activated ? " · newly activated for this shortage" : ""}
                          </p>
                        </div>
                        <span className="num inline-flex items-center gap-1 rounded-full bg-cobalt px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                          <Sparkles className="h-3 w-3 text-lamp" />
                          {x.score}% match
                        </span>
                      </div>
                      <ul className="mt-2.5 flex flex-wrap gap-2 text-xs text-ink-2">
                        {x.reasons.map((r) => (
                          <li key={r} className="rounded-ctl bg-white border border-line/70 px-2 py-0.5 font-medium">
                            {r}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[11px] text-ink-3">{matches.data.method}</p>
            </div>
          )}
        </section>
      )}

      {/* Main Catalog with Sidebar */}
      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="panel p-5 h-fit space-y-4 shadow-card" aria-label="Filters">
          <div className="flex items-center justify-between border-b border-line/70 pb-3">
            <span className="flex items-center gap-2 text-sm font-bold text-ink">
              <Filter className="h-4 w-4 text-cobalt" /> Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
            </span>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={() => setSp({}, { replace: true })}
                className="text-xs text-cobalt font-semibold hover:underline"
              >
                Reset
              </button>
            )}
          </div>

          <form className="space-y-3.5" onSubmit={(e) => e.preventDefault()}>
            <Input label="Search" value={get("q")} onChange={(e) => set("q", e.target.value)} placeholder="Title, model, kit..." />
            <Select label="Category" value={get("category")} onChange={(e) => set("category", e.target.value)}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
            <Input label="Max price/day (₹)" type="number" min={0} value={get("max")} onChange={(e) => set("max", e.target.value)} />
            <Checkbox
              label="Free to borrow only"
              checked={get("free") === "1"}
              onChange={(e) => set("free", e.target.checked ? "1" : "")}
            />
            <Select label="Condition" value={get("condition")} onChange={(e) => set("condition", e.target.value)}>
              <option value="">Any condition</option>
              {["new", "good", "fair"].map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
            </Select>
            <Input label="Pickup Area" value={get("area")} onChange={(e) => set("area", e.target.value)} placeholder="e.g. Lab 3, Library" />
            <Input label="Available from" type="datetime-local" value={from} onChange={(e) => set("from", e.target.value)} />
            <Input label="Available until" type="datetime-local" value={to} onChange={(e) => set("to", e.target.value)} hint="Set both start & end" />
            <Select label="Sort Order" value={params.sort} onChange={(e) => set("sort", e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="name">Alphabetical</option>
            </Select>

            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => setSp({}, { replace: true })}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Clear all filters
              </Button>
            )}
          </form>
        </aside>

        <div>
          {q.isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="panel h-72 animate-pulse bg-paper-2/60" />
              ))}
            </div>
          ) : q.isError ? (
            <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} />
          ) : !q.data!.items.length ? (
            <EmptyState
              title="No campus resources found"
              action={<Button variant="secondary" onClick={() => setSp({}, { replace: true })}>Clear filters</Button>}
            >
              Try expanding your dates or clearing your keyword filter.
            </EmptyState>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {q.data!.items.map((r) => (
                  <ResourceCard key={r.id} r={r} to={`${base}/${r.id}`} />
                ))}
              </div>
              <Pagination
                page={q.data!.page}
                pages={q.data!.pages}
                total={q.data!.total}
                onChange={(p) => set("page", String(p))}
              />
            </>
          )}

          {!user && (
            <div className="mt-8 rounded-panel border border-line bg-white p-5 text-center shadow-subtle">
              <p className="text-sm text-ink-2">
                Need to borrow or list equipment?{" "}
                <Link to="/login" className="link font-bold">
                  Sign in with your student account
                </Link>{" "}
                to request items or activate idle gear.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
