import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { ResourceImage } from "@/components/ResourceCard";
import { Badge, Button, ErrorState, Input, ListSkeleton, Select } from "@/components/ui";
import { api } from "@/lib/api";
import { dateTime, localToISO, money, plusHours } from "@/lib/format";
import { CATEGORIES, type MatchResult } from "@/lib/types";

const COMPONENT_LABEL: Record<string, string> = { price: "Price", condition: "Condition", reliability: "Owner reliability", location: "Pickup area", keywords: "Keyword fit" };

export function SmartMatch({ base }: { base: string }) {
  const [form, setForm] = useState({ start: plusHours(24), end: plusHours(30), category: "", budget: "", area: "", keywords: "" });
  const [submitted, setSubmitted] = useState<typeof form | null>(null);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["matching", submitted], enabled: !!submitted, retry: false,
    queryFn: () => api.get<MatchResult>("/api/matching", {
      start: localToISO(submitted!.start), end: localToISO(submitted!.end), category: submitted!.category || undefined,
      max_price_per_day: submitted!.budget || undefined, area: submitted!.area || undefined, keywords: submitted!.keywords || undefined }),
  });
  function go(e: FormEvent) {
    e.preventDefault();
    if (!form.start || !form.end) return setLocalErr("Choose both a start and an end time.");
    if (new Date(form.end) <= new Date(form.start)) return setLocalErr("The end time must be after the start time.");
    setLocalErr(null); setSubmitted({ ...form });
  }
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <section className="panel mb-6 p-5" aria-labelledby="sm-title">
      <h2 id="sm-title" className="flex items-center gap-2 text-xl"><Sparkles className="h-5 w-5 text-cobalt" aria-hidden />Smart match</h2>
      <p className="mt-1 text-sm text-ink-2">Tell us when you need something. Only items bookable for your whole period are ranked, and each score comes with its reasons.</p>
      <form onSubmit={go} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Input label="From" type="datetime-local" value={form.start} onChange={set("start")} />
        <Input label="Until" type="datetime-local" value={form.end} onChange={set("end")} error={localErr} />
        <Select label="Category" value={form.category} onChange={set("category")}>
          <option value="">Any category</option>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </Select>
        <Input label="Budget per day (₹)" type="number" min={0} inputMode="numeric" optional value={form.budget} onChange={set("budget")} />
        <Input label="Preferred pickup area" optional value={form.area} onChange={set("area")} />
        <Input label="Keywords" optional placeholder="e.g. hdmi, 4k" value={form.keywords} onChange={set("keywords")} />
        <div className="sm:col-span-2 lg:col-span-3"><Button type="submit" loading={q.isFetching}>Find matches</Button></div>
      </form>

      {submitted && (
        <div className="mt-5" aria-live="polite">
          {q.isLoading ? <ListSkeleton rows={2} /> : q.isError ? <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} /> : q.data && (
            <>
              <p className="mb-3 text-sm text-ink-3">
                <span className="num">{q.data.matches.length}</span> bookable match{q.data.matches.length === 1 ? "" : "es"} from <span className="num">{q.data.considered}</span> listings;
                {" "}<span className="num">{q.data.excluded_unavailable}</span> not available for these dates{q.data.excluded_over_budget ? <>, <span className="num">{q.data.excluded_over_budget}</span> over budget</> : null}.
              </p>
              {q.data.matches.length === 0 ? <p className="rounded-panel border border-dashed border-line-2 p-5 text-ink-2">Nothing is bookable for those dates. Try different times, a wider budget or another category.</p> : (
                <ul className="space-y-3">
                  {q.data.matches.map((m) => (
                    <li key={m.resource.id} className="flex flex-col gap-4 rounded-panel border border-line p-3 sm:flex-row">
                      <div className="w-full shrink-0 overflow-hidden rounded-ctl sm:w-40"><ResourceImage src={m.resource.images[0]?.url} category={m.resource.category} name={m.resource.name} className="h-28" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link to={`${base}/${m.resource.id}`} className="font-display text-lg font-semibold hover:text-cobalt">{m.resource.name}</Link>
                          <span className="num rounded-ctl bg-night px-2 py-0.5 text-xs font-semibold text-white">{m.score}% match</span>
                          {m.newly_activated && <Badge tone="lamp">Newly shared</Badge>}
                        </div>
                        <p className="mt-0.5 text-sm text-ink-2">{m.resource.category_label} · {m.resource.pickup_area || "Area not set"} · {dateTime(submitted.start ? localToISO(submitted.start) : null)} to {dateTime(localToISO(submitted.end))}</p>
                        <p className="num mt-1 text-sm">Estimated <strong>{money(m.estimated_cost)}</strong>{m.deposit ? <> plus <strong>{money(m.deposit)}</strong> deposit</> : null} <span className="text-ink-3">(demo payment)</span></p>
                        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">{m.reasons.map((r) => <li key={r}>• {r}</li>)}</ul>
                        <details className="mt-2 text-sm">
                          <summary className="cursor-pointer text-cobalt">How this score was calculated</summary>
                          <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
                            {Object.entries(m.components).map(([k, v]) => (
                              <li key={k} className="flex justify-between gap-2"><span>{COMPONENT_LABEL[k] ?? k} <span className="text-ink-3">({Math.round((q.data!.weights[k] ?? 0) * 100)}%)</span></span><span className="num">{Math.round(v * 100)}</span></li>))}
                          </ul>
                        </details>
                      </div>
                    </li>))}
                </ul>)}
              <p className="mt-3 text-xs text-ink-3">{q.data.method}</p>
            </>)}
        </div>)}
    </section>
  );
}
