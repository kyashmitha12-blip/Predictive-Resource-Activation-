import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Button, ErrorState, ListSkeleton, PageHeader, Select, StatusChip, Table, Td, useToast } from "@/components/ui";
import { api, errMsg } from "@/lib/api";
import { dateTime, shortDate } from "@/lib/format";
import { CATEGORIES, Forecast as F } from "@/lib/types";

type Latest = F & { data: { real_weeks: number; synthetic_weeks: number; real_bookings: number; basis: string } };
const name = (c: string) => CATEGORIES.find((x) => x.value === c)?.label ?? c;

export default function Forecast() {
  const [cat, setCat] = useState("projector");
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["admin", "forecast"], queryFn: () => api.get<Latest>("/api/admin/forecast/latest") });
  const series = useQuery({ queryKey: ["admin", "series", cat], queryFn: () => api.get<{ week_start: string; bookings: number; event: boolean }[]>("/api/admin/forecast/history-series", { category: cat, weeks: 40 }) });
  const run = useMutation({ mutationFn: () => api.post("/api/admin/forecast/run"), onSuccess: () => { toast.success("Forecast updated."); qc.invalidateQueries({ queryKey: ["admin"] }); qc.invalidateQueries({ queryKey: ["forecast"] }); }, onError: (e) => toast.error(errMsg(e)) });
  if (q.isLoading) return <ListSkeleton />;
  if (q.isError || !q.data) return <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} />;
  const f = q.data;
  return (
    <div className="space-y-6">
      <PageHeader title="Demand forecast" subtitle="Weekly booking requests per category, predicted from history." actions={<Button loading={run.isPending} onClick={() => run.mutate()}>Run forecast now</Button>} />
      {!f.available ? <div className="panel panel-pad"><p>No forecast has been run. Seed demo history or wait for real bookings, then run it.</p></div> : <>
        <div role="status" className={`rounded-ctl border px-4 py-3 text-sm ${f.data_basis === "real_only" ? "border-go/40 bg-go-50" : "border-lamp/50 bg-lamp-50"}`}><strong>{f.data_basis === "synthetic_only" ? "Synthetic data. " : f.data_basis === "mixed" ? "Mixed data. " : "Real data. "}</strong>{f.data_note} Training weeks: {f.data.synthetic_weeks} synthetic, {f.data.real_weeks} real ({f.data.real_bookings} real bookings).</div>
        <section className="on-night rounded-panel p-5 sm:p-6" aria-labelledby="pd-h">
          <h2 id="pd-h" className="text-xl">Predicted demand, week of {shortDate(f.period_start)}</h2>
          <p className="text-sm text-white/70">Model {f.model_name} · version {f.model_version} · run {dateTime(f.created_at)}</p>
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="text-left text-white/60"><tr><th className="py-1.5 font-medium">Category</th><th className="font-medium">Predicted (80% range)</th><th className="font-medium">Effective supply</th><th className="font-medium">Gap</th><th className="font-medium">Level</th></tr></thead>
            <tbody>{f.categories.map((c) => <tr key={c.category} className="border-t border-white/10"><td className="py-2">{name(c.category)}</td><td className="num"><span className="font-semibold text-lamp">{c.predicted_demand.toFixed(1)}</span> <span className="text-white/60">({c.lower.toFixed(0)}-{c.upper.toFixed(0)})</span></td><td className="num">{c.effective_supply} <span className="text-white/60">of {c.total_listed} listed</span></td><td className="num">{c.supply_gap}</td><td><Badge tone={c.demand_level === "critical" ? "alert" : c.demand_level === "high" ? "lamp" : c.demand_level === "moderate" ? "info" : "go"}>{c.demand_level}</Badge></td></tr>)}</tbody></table></div>
        </section>
        <section className="panel panel-pad"><div className="flex flex-wrap items-end justify-between gap-3"><h2 className="text-lg">Weekly history</h2><div className="w-56"><Select label="Category" value={cat} onChange={(e) => setCat(e.target.value)}>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></div></div>
          <div className="mt-3 h-60" role="img" aria-label={`Line chart of weekly ${name(cat)} bookings. Event weeks are marked in the table below the chart note.`}>{series.data && <ResponsiveContainer><LineChart data={series.data}><CartesianGrid stroke="rgb(var(--line))" vertical={false} /><XAxis dataKey="week_start" tickFormatter={shortDate} tick={{ fontSize: 12 }} minTickGap={28} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={28} /><Tooltip labelFormatter={(l) => `Week of ${shortDate(String(l))}`} /><Line dataKey="bookings" name="Bookings" stroke="rgb(var(--lamp-700))" strokeWidth={2} dot={(p: { cx?: number; cy?: number; payload?: { event: boolean }; index?: number }) => p.payload?.event ? <circle key={p.index} cx={p.cx} cy={p.cy} r={5} fill="rgb(var(--cobalt))" /> : <g key={p.index} />} /></LineChart></ResponsiveContainer>}</div>
          <p className="text-xs text-ink-3">Blue dots mark event weeks (exams, fests, hackathons) used as a model feature.</p></section>
        <section><h2 className="mb-2 text-lg">Model comparison</h2><p className="mb-2 text-sm text-ink-3">Evaluated on the most recent held-out weeks (never shuffled). Lower error is better. A simple baseline can win; the best is selected honestly.</p>
          <Table head={["Model", "MAE", "RMSE", "Train rows", "Test rows", ""]}>{f.evaluations.map((e) => <tr key={e.model_name}><Td className="font-medium">{e.model_name}</Td><Td className="num">{e.mae.toFixed(2)}</Td><Td className="num">{e.rmse.toFixed(2)}</Td><Td className="num">{e.n_train}</Td><Td className="num">{e.n_test}</Td><Td>{e.is_selected && <Badge tone="go">Selected</Badge>}</Td></tr>)}</Table></section>
        <section className="panel panel-pad text-sm text-ink-2"><h2 className="text-lg text-ink">Limitations</h2><ul className="mt-2 list-disc space-y-1 pl-5"><li>These are estimates for decision support, not guarantees.</li><li>{f.data_basis === "synthetic_only" ? "The history is synthetic demo data, so these results are not a validated real-world forecast." : "Accuracy depends on how much real booking history exists."}</li><li>Effective supply counts each eligible resource once and assumes one booking per resource per week (configurable).</li><li>The range is an 80% interval from hold-out errors, not a promise.</li></ul></section></>}
    </div>
  );
}
