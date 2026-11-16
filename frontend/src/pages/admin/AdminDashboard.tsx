import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  FileText,
  Gauge,
  Radio,
  Sparkles,
  TrendingUp,
  Truck,
  Users,
  XCircle,
} from "lucide-react";
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
  forecast: Forecast | null;
  open_reports: number;
  pending_verifications: number;
}

export default function AdminDashboard() {
  const q = useQuery({ queryKey: ["admin", "overview"], queryFn: () => api.get<Ov>("/api/admin/overview") });

  if (q.isLoading) return <ListSkeleton rows={5} />;
  if (q.isError || !q.data) return <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} />;

  const o = q.data;
  const f = o.forecast;
  const gaps = f?.categories.filter((c) => c.supply_gap > 0) ?? [];
  const act = o.activation.by_status;

  const flow = [
    ["1. Demand Forecast", f ? `${f.categories.length} categories` : "Not run yet"],
    ["2. Supply Gap Check", `${gaps.length} gaps identified`],
    ["3. Idle Gear Scan", `${o.activation.eligible_idle_resources} eligible items`],
    ["4. Activation Requests", `${act.pending ?? 0} pending consent`],
    ["5. Newly Shared", `${act.accepted ?? 0} active from demand`],
    ["6. Book & Return", `${o.bookings.by_status.completed ?? 0} completed`],
    ["7. Model Update", f ? f.data_basis.replace("_", " ") : "Baseline"],
    ["8. Cycle Re-run", f ? shortDate(f.created_at.slice(0, 10)) : "Ready"],
  ];

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-200">
      <PageHeader
        title="Campus Operations &amp; Intelligence"
        subtitle="Live administrative metrics, machine learning activation loops, and campus trust audits."
        actions={
          <div className="flex items-center gap-2">
            <Link to="/admin/forecast" className="rounded-ctl bg-cobalt px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-cobalt-700 transition-colors">
              Run Demand Forecast &rarr;
            </Link>
          </div>
        }
      />

      {/* High-level KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Campus Directory"
          value={o.users.total}
          icon={<Users className="h-4 w-4" />}
          note={`${o.users.verified} verified · ${o.users.pending} awaiting review`}
        />
        <Stat
          label="Active Gear Listings"
          value={o.resources.active}
          icon={<Boxes className="h-4 w-4" />}
          note={`${o.resources.demo} demo records`}
        />
        <Stat
          label="Total Bookings"
          value={o.bookings.total}
          icon={<Truck className="h-4 w-4" />}
          note={`${o.bookings.demo} demo records`}
        />
        <Stat
          label="Open Disputes &amp; Reports"
          value={o.open_reports}
          icon={<AlertTriangle className="h-4 w-4" />}
          note={
            o.pending_verifications ? (
              <Link className="link font-semibold text-cobalt" to="/admin/verifications">
                {o.pending_verifications} student ID(s) waiting
              </Link>
            ) : (
              "No verification backlog"
            )
          }
        />
      </div>

      {/* The Activation Flow Loop */}
      <section className="on-night rounded-panel-lg border border-white/10 p-6 sm:p-7 shadow-2xl" aria-labelledby="flow-h">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-lamp animate-pulse" />
            <h2 id="flow-h" className="text-lg font-bold text-white">
              Predictive Resource Activation Pipeline
            </h2>
          </div>
          <span className="text-xs text-white/60">Live feedback status</span>
        </div>
        <p className="mt-2 text-xs text-white/70">
          How campus demand projections activate underused gear through consent-based owner requests.
        </p>

        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {flow.map(([t, n], i) => (
            <li
              key={t}
              className="panel-night flex items-start gap-3 rounded-ctl p-3.5 border border-white/10 transition-all hover:bg-white/[0.08]"
            >
              <Pilot
                state={i === 3 && (act.pending ?? 0) > 0 ? "pending" : i === 4 && (act.accepted ?? 0) > 0 ? "lit" : "idle"}
                size={10}
                className="mt-1"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white">{t}</p>
                <p className="num mt-0.5 text-xs text-lamp font-semibold">{n}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Predicted Demand vs Supply & Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel panel-pad shadow-card">
          <div className="flex items-center justify-between border-b border-line/70 pb-3">
            <div className="flex items-center gap-2">
              <Gauge className="h-4.5 w-4.5 text-cobalt" />
              <h2 className="text-base font-bold text-ink">Projected Demand vs. Effective Supply</h2>
            </div>
            {f && <span className="text-[11px] font-semibold text-ink-3">Horizon: 7 Days</span>}
          </div>

          {!f ? (
            <EmptyState title="No forecast data generated yet">
              <Link className="link" to="/admin/forecast">
                Execute your first ML forecast &rarr;
              </Link>
            </EmptyState>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-line text-ink-3">
                  <tr>
                    <th className="py-2 font-semibold">Category</th>
                    <th className="py-2 font-semibold">Predicted Demand</th>
                    <th className="py-2 font-semibold">Active Supply</th>
                    <th className="py-2 font-semibold">Supply Gap</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {f.categories.map((c) => (
                    <tr key={c.category} className="hover:bg-paper/60 transition-colors">
                      <td className="py-2.5 font-medium text-ink">
                        {CATEGORIES.find((x) => x.value === c.category)?.label}
                      </td>
                      <td className="num py-2.5 text-ink-2">{c.predicted_demand.toFixed(1)}</td>
                      <td className="num py-2.5 text-ink-2">{c.effective_supply}</td>
                      <td className="num py-2.5">
                        {c.supply_gap > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-lamp-50 px-2 py-0.5 font-bold text-lamp-700">
                            +{c.supply_gap} shortage
                          </span>
                        ) : (
                          <span className="text-ink-3">0 (Balanced)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-[11px] text-ink-3">{f.data_note}</p>
            </div>
          )}
        </section>

        <section className="panel panel-pad shadow-card">
          <div className="flex items-center justify-between border-b border-line/70 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4.5 w-4.5 text-cobalt" />
              <h2 className="text-base font-bold text-ink">Campus Bookings Velocity (30 Days)</h2>
            </div>
            {o.bookings.demo > 0 && <DemoBadge />}
          </div>

          {!o.activity.length ? (
            <p className="py-8 text-center text-xs text-ink-3">No bookings recorded during this period.</p>
          ) : (
            <div className="mt-3">
              <div className="h-56 w-full" role="img" aria-label="Area chart of bookings created per day over 30 days">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={o.activity}>
                    <defs>
                      <linearGradient id="adminBookingGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="rgb(var(--cobalt))" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="rgb(var(--cobalt))" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgb(var(--line))" vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => shortDate(d)}
                      tick={{ fontSize: 11, fill: "rgb(var(--ink-3))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "rgb(var(--ink-3))" }}
                      axisLine={false}
                      tickLine={false}
                      width={28}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid rgb(var(--line))",
                        borderRadius: "10px",
                        boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="bookings"
                      name="Bookings"
                      stroke="rgb(var(--cobalt))"
                      strokeWidth={2.5}
                      fill="url(#adminBookingGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-[11px] text-ink-3">
                {o.bookings.demo
                  ? `${o.bookings.demo} of ${o.bookings.total} bookings are seeded sample records.`
                  : "All booking entries represent genuine campus user transactions."}
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Conversion & Reliability Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Fulfillment / Completion Rate"
          value={pct(o.bookings.completion_rate)}
          icon={<CheckCircle2 className="h-4 w-4 text-go" />}
          note="Of concluded bookings"
        />
        <Stat
          label="Cancellation Rate"
          value={pct(o.bookings.cancellation_rate)}
          icon={<XCircle className="h-4 w-4 text-alert" />}
          note="Of concluded bookings"
        />
        <Stat
          label="Activation Consent Rate"
          value={pct(o.activation.acceptance_rate)}
          icon={<Sparkles className="h-4 w-4 text-lamp-700" />}
          note={`${o.activation.total} requests dispatched`}
        />
      </div>

      {/* Status Breakdown Chips */}
      <section className="panel panel-pad shadow-card">
        <h2 className="text-base font-bold text-ink">Booking State Distribution</h2>
        <ul className="mt-3 flex flex-wrap gap-2.5">
          {Object.entries(o.bookings.by_status).map(([k, v]) => (
            <li
              key={k}
              className="flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-xs shadow-subtle"
            >
              <StatusChip status={k} />
              <span className="num font-bold text-ink">{v}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
