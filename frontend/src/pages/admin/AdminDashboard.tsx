import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DemoBadge, EmptyState, ErrorState, ListSkeleton, PageHeader, Pilot, Stat, StatusChip } from "@/components/ui";
import { api, errMsg } from "@/lib/api";
import { pct, shortDate } from "@/lib/format";
import { CATEGORIES, Forecast } from "@/lib/types";

interface Ov {
  users: { total: number; students: number; verified: number; pending: number; rejected: number; not_submitted: number };
  resources: { active: number; total: number; demo: number };
  bookings: { by_status: Record<string, number>; total: number; completion_rate: number | null; cancellation_rate: number | null; demo: number };
  activity: { date: string; bookings: number; demo: number }[];
  activation: { by_status: Record<string, number>; total: number; acceptance_rate: number | null; eligible_idle_resources: number };
  forecast: Forecast | null; open_reports: number; pending_verifications: number;
}

export default function AdminDashboard() {
  const q = useQuery({ queryKey: ["admin", "overview"], queryFn: () => api.get<Ov>("/api/admin/overview") });
  if (q.isLoading) return <ListSkeleton rows={5} />;
  if (q.isError || !q.data) return <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} />;
  const o = q.data, f = o.forecast;
  const gaps = f?.categories.filter((c) => c.supply_gap > 0) ?? [];
  const act = o.activation.by_status;
  const flow = [
    ["Predict demand", f ? `${f.categories.length} categories` : "not run"], ["Detect supply gap", `${gaps.length} with a gap`],
    ["Identify idle resources", `${o.activation.eligible_idle_resources} eligible`], ["Request owner activation", `${act.pending ?? 0} pending`],
    ["Match available resources", `${act.accepted ?? 0} newly shared`], ["Book and return", `${o.bookings.by_status.completed ?? 0} completed`],
    ["Update data", f ? f.data_basis.replace("_", " ") : "-"], ["Predict again", f ? shortDate(f.created_at.slice(0, 10)) : "-"],
  ];
  return (
    <div className="space-y-8">
      <PageHeader title="Admin dashboard" subtitle="Live figures from the platform database. Seeded sample records are labelled." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Registered users" value={o.users.total} note={`${o.users.verified} verified · ${o.users.pending} pending`} />
        <Stat label="Active listings" value={o.resources.active} note={`${o.resources.demo} are demo`} />
        <Stat label="Bookings" value={o.bookings.total} note={`${o.bookings.demo} are demo`} />
        <Stat label="Open reports" value={o.open_reports} note={o.pending_verifications ? <Link className="link" to="/admin/verifications">{o.pending_verifications} verification(s) waiting</Link> : "No verifications waiting"} />
      </div>
      <section className="on-night rounded-panel p-5 sm:p-6" aria-labelledby="flow-h">
        <h2 id="flow-h" className="text-xl">The activation loop, right now</h2>
        <p className="mt-1 text-sm text-white/70">Each stage shows its current count from the database.</p>
        <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{flow.map(([t, n], i) => (
          <li key={t} className="panel-night flex items-start gap-3 p-3"><Pilot state={i === 3 && (act.pending ?? 0) > 0 ? "pending" : i === 4 && (act.accepted ?? 0) > 0 ? "lit" : "idle"} size={10} className="mt-1.5" /><div><p className="font-medium">{t}</p><p className="num text-sm text-white/70">{n}</p></div></li>))}</ol>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel panel-pad"><h2 className="text-lg">Predicted demand vs supply</h2>
          {!f ? <EmptyState title="No forecast yet"><Link className="link" to="/admin/forecast">Run the first forecast</Link></EmptyState> :
            <table className="mt-2 w-full text-sm"><thead className="text-left text-ink-3"><tr><th className="py-1 font-medium">Category</th><th className="font-medium">Demand</th><th className="font-medium">Supply</th><th className="font-medium">Gap</th></tr></thead>
              <tbody>{f.categories.map((c) => <tr key={c.category} className="border-t border-line"><td className="py-1.5">{CATEGORIES.find((x) => x.value === c.category)?.label}</td><td className="num">{c.predicted_demand.toFixed(1)}</td><td className="num">{c.effective_supply}</td><td className="num">{c.supply_gap > 0 ? <span className="font-semibold text-lamp-700">{c.supply_gap}</span> : 0}</td></tr>)}</tbody></table>}
          {f && <p className="mt-2 text-xs text-ink-3">{f.data_note}</p>}</section>
        <section className="panel panel-pad"><h2 className="text-lg">Booking requests, last 30 days</h2>
          {!o.activity.length ? <p className="mt-2 text-sm text-ink-3">No bookings in this period.</p> : <>
            <div className="mt-2 h-52" role="img" aria-label="Area chart of bookings created per day over the last 30 days"><ResponsiveContainer><AreaChart data={o.activity}><CartesianGrid stroke="rgb(var(--line))" vertical={false} /><XAxis dataKey="date" tickFormatter={(d) => shortDate(d)} tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={28} /><Tooltip /><Area dataKey="bookings" name="Bookings" stroke="rgb(var(--cobalt))" fill="rgb(var(--cobalt) / 0.15)" /></AreaChart></ResponsiveContainer></div>
            <p className="mt-1 text-xs text-ink-3">{o.bookings.demo ? <><DemoBadge /> {o.bookings.demo} of {o.bookings.total} bookings are seeded sample records.</> : "All records are real."}</p></>}</section>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Completion rate" value={pct(o.bookings.completion_rate)} note="of closed bookings" />
        <Stat label="Cancellation rate" value={pct(o.bookings.cancellation_rate)} note="of closed bookings" />
        <Stat label="Activation acceptance" value={pct(o.activation.acceptance_rate)} note={`${o.activation.total} requests sent`} />
      </div>
      <section className="panel panel-pad"><h2 className="text-lg">Bookings by status</h2><ul className="mt-2 flex flex-wrap gap-3">{Object.entries(o.bookings.by_status).map(([k, v]) => <li key={k} className="flex items-center gap-2 text-sm"><StatusChip status={k} /><span className="num">{v}</span></li>)}</ul></section>
    </div>
  );
}
