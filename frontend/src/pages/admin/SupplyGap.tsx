import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, ErrorState, ListSkeleton, PageHeader, StatusChip, Table, Td } from "@/components/ui";
import { api, errMsg } from "@/lib/api";
import { shortDate } from "@/lib/format";
import type { ForecastCategory } from "@/lib/types";

interface SG { available: boolean; period_start: string; period_end: string; data_note: string; definition: string; categories: (ForecastCategory & { label: string; eligible_idle: number })[] }

export default function SupplyGap() {
  const q = useQuery({ queryKey: ["admin", "supply-gap"], queryFn: () => api.get<SG>("/api/admin/supply-gap"), refetchInterval: 30_000 });
  if (q.isLoading) return <ListSkeleton />;
  if (q.isError || !q.data) return <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} />;
  const d = q.data;
  if (!d.available) return <div><PageHeader title="Supply gap" /><div className="panel panel-pad">Run a forecast first.</div></div>;
  const chart = d.categories.map((c) => ({ name: c.label, Demand: Number(c.predicted_demand.toFixed(1)), Supply: c.effective_supply }));
  return (
    <div className="space-y-6">
      <PageHeader title="Supply gap" subtitle={`Week of ${shortDate(d.period_start)} to ${shortDate(d.period_end)}. Effective supply is recalculated live, so accepting an activation request shrinks the gap.`} />
      <p className="rounded-ctl bg-paper-2 px-3 py-2 text-sm text-ink-2">{d.definition} {d.data_note}</p>
      <section className="panel panel-pad"><h2 className="text-lg">Predicted demand and effective supply</h2>
        <div className="mt-3 h-72" role="img" aria-label="Bar chart comparing predicted demand with effective supply for each category"><ResponsiveContainer><BarChart data={chart} margin={{ left: -10 }}><CartesianGrid stroke="rgb(var(--line))" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} /><Tooltip /><Legend verticalAlign="top" /><Bar dataKey="Demand" fill="rgb(var(--lamp))" /><Bar dataKey="Supply" fill="rgb(var(--cobalt))" /></BarChart></ResponsiveContainer></div></section>
      <Table head={["Category", "Predicted demand", "Listed", "Effective supply", "Gap", "Level", "Eligible idle", "Requests"]}>{d.categories.map((c) => (
        <tr key={c.category}><Td className="font-medium">{c.label}</Td><Td className="num">{c.predicted_demand.toFixed(1)}</Td><Td className="num">{c.total_listed}</Td><Td className="num">{c.effective_supply}</Td><Td className="num">{c.supply_gap > 0 ? <Badge tone="lamp">{c.supply_gap}</Badge> : 0}</Td><Td><StatusChip status={c.demand_level} /></Td><Td className="num">{c.eligible_idle}</Td><Td className="num">{c.pending_requests} pending · {c.accepted_requests} accepted</Td></tr>))}</Table>
    </div>
  );
}
