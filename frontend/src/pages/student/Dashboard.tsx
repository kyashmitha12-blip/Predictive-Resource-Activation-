import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Boxes,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Compass,
  Inbox,
  Radio,
  Send,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ResourceCard } from "@/components/ResourceCard";
import { BookingRow } from "@/components/student/BookingRow";
import { EmptyState, ErrorState, LinkButton, ListSkeleton, PageHeader, Pilot, Stat, StatusChip } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { api, errMsg } from "@/lib/api";
import { ago, label, pct, shortDate } from "@/lib/format";
import type { Activation, Booking, OwnerStats, Resource } from "@/lib/types";

interface Dash {
  counts: Record<string, number>;
  upcoming_bookings: Booking[];
  activation_requests: Activation[];
  recent_activity: { booking_id: number; to_status: string; note: string; created_at: string; resource_name: string }[];
  recommended: { score: number; reasons: string[]; resource: Resource }[];
  my_stats: OwnerStats;
}

export default function Dashboard() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => api.get<Dash>("/api/dashboard/student") });

  if (q.isLoading) return <ListSkeleton rows={5} />;
  if (q.isError || !q.data) return <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} />;

  const d = q.data;
  const c = d.counts;

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-200">
      <PageHeader
        title={`Welcome back, ${user?.name.split(" ")[0]}`}
        subtitle="Manage your campus bookings, track sharing requests, and review opportunities."
        actions={
          <div className="flex items-center gap-2.5">
            <LinkButton to="/app/browse" variant="secondary" size="md">
              <Compass className="h-4 w-4" /> Browse Catalog
            </LinkButton>
            <LinkButton to="/app/list" variant="primary" size="md">
              List a Resource
            </LinkButton>
          </div>
        }
      />

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Requests to Answer"
          value={c.pending_incoming}
          icon={<Inbox className="h-4 w-4" />}
          note={c.pending_incoming > 0 ? "Awaiting your approval" : "All caught up"}
        />
        <Stat
          label="Waiting for Owners"
          value={c.pending_outgoing}
          icon={<Send className="h-4 w-4" />}
          note={c.pending_outgoing > 0 ? "Pending owner review" : "No open requests"}
        />
        <Stat
          label="My Listed Gear"
          value={c.my_resources}
          icon={<Boxes className="h-4 w-4" />}
          note="Active resources"
        />
        <Stat
          label="Notifications"
          value={c.unread_notifications}
          icon={<Bell className="h-4 w-4" />}
          note={c.unread_notifications > 0 ? `${c.unread_notifications} unread updates` : "All notifications read"}
        />
      </div>

      {/* Predictive Activation Alert */}
      {!!d.activation_requests.length && (
        <section aria-labelledby="act-h" className="rounded-panel border border-lamp/40 bg-gradient-to-r from-lamp-50/90 via-amber-50 to-lamp-50/70 p-5 sm:p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-ctl bg-lamp/20 text-slate-950">
                <Radio className="h-5 w-5 text-lamp-700 animate-pulse" />
              </div>
              <div>
                <h2 id="act-h" className="text-base sm:text-lg font-bold text-slate-950">
                  Campus Demand Forecast: Gear You Own is Needed
                </h2>
                <p className="text-xs sm:text-sm text-slate-800">
                  Our model anticipates high demand. You decide whether to share — nothing is listed without your explicit consent.
                </p>
              </div>
            </div>
          </div>

          <ul className="mt-4 space-y-2.5">
            {d.activation_requests.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-ctl border border-lamp/30 bg-white p-3.5 shadow-subtle text-sm">
                <div className="flex items-center gap-2.5">
                  <Pilot state="lit" size={8} />
                  <span>
                    <strong className="text-ink">{a.resource.name}</strong> ·{" "}
                    <span className="text-ink-2">{a.category_label}</span>,{" "}
                    <span className="text-xs font-semibold text-cobalt">
                      {shortDate(a.period_start)} → {shortDate(a.period_end)}
                    </span>
                  </span>
                </div>
                <Link className="link text-xs font-bold uppercase tracking-wider text-cobalt hover:text-cobalt-700" to={`/app/activation/${a.id}`}>
                  Review Opportunity &rarr;
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Upcoming Bookings */}
      <section aria-labelledby="up-h">
        <div className="mb-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-cobalt" />
            <h2 id="up-h" className="text-xl font-bold text-ink">Upcoming &amp; Active Rentals</h2>
          </div>
          {d.upcoming_bookings.length > 0 && (
            <Link to="/app/bookings" className="link text-xs font-semibold">
              View all bookings &rarr;
            </Link>
          )}
        </div>

        {!d.upcoming_bookings.length ? (
          <EmptyState
            title="No upcoming bookings scheduled"
            action={<LinkButton to="/app/browse">Explore Resources to Borrow</LinkButton>}
          >
            Confirmed bookings, active handovers, and return deadlines will appear here.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {d.upcoming_bookings.map((b) => (
              <BookingRow key={b.id} b={b} role={b.owner.id === user?.id ? "owner" : "borrower"} />
            ))}
          </ul>
        )}
      </section>

      {/* Recommendations */}
      <section aria-labelledby="rec-h">
        <div className="mb-3.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-lamp" />
            <h2 id="rec-h" className="text-xl font-bold text-ink">Available for Quick Pickup Tomorrow</h2>
          </div>
          <p className="mt-1 text-xs text-ink-3">
            Ranked by proximity, verified owner reliability, and full-window availability.
          </p>
        </div>

        {!d.recommended.length ? (
          <EmptyState title="No items available for this specific window">
            Browse the full catalog to filter by your preferred custom dates.
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {d.recommended.map((r) => (
              <ResourceCard key={r.resource.id} r={r.resource} to={`/app/browse/${r.resource.id}`} score={r.score} />
            ))}
          </div>
        )}
      </section>

      {/* Two Column Summary: Recent Activity & Reputation */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel panel-pad">
          <div className="flex items-center justify-between border-b border-line/70 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4.5 w-4.5 text-cobalt" />
              <h2 className="text-base font-bold text-ink">Recent Activity</h2>
            </div>
          </div>
          {!d.recent_activity.length ? (
            <p className="py-6 text-center text-xs text-ink-3">No activity logged yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line/70">
              {d.recent_activity.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-3 text-xs sm:text-sm">
                  <Link className="font-semibold text-ink transition-colors hover:text-cobalt" to={`/app/bookings/${a.booking_id}`}>
                    {a.resource_name}
                  </Link>
                  <div className="flex items-center gap-2">
                    <StatusChip status={a.to_status} />
                    <span className="text-xs text-ink-3">{ago(a.created_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel panel-pad">
          <div className="flex items-center justify-between border-b border-line/70 pb-3">
            <div className="flex items-center gap-2">
              <Star className="h-4.5 w-4.5 text-lamp" />
              <h2 className="text-base font-bold text-ink">My Sharing Reliability &amp; Trust</h2>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-4 text-xs sm:text-sm">
            <div className="rounded-ctl bg-paper p-3 border border-line/60">
              <dt className="text-ink-3 text-xs">Completed Rentals</dt>
              <dd className="num mt-1 font-display text-xl font-bold text-ink">{d.my_stats.completed_rentals}</dd>
            </div>
            <div className="rounded-ctl bg-paper p-3 border border-line/60">
              <dt className="text-ink-3 text-xs">Community Rating</dt>
              <dd className="num mt-1 font-display text-xl font-bold text-ink">
                {d.my_stats.average_rating != null ? `${d.my_stats.average_rating.toFixed(1)} / 5.0` : "No reviews yet"}
              </dd>
            </div>
            <div className="rounded-ctl bg-paper p-3 border border-line/60">
              <dt className="text-ink-3 text-xs">On-Time Return Rate</dt>
              <dd className="num mt-1 font-display text-xl font-bold text-ink">{pct(d.my_stats.on_time_return_rate)}</dd>
            </div>
            <div className="rounded-ctl bg-paper p-3 border border-line/60">
              <dt className="text-ink-3 text-xs">Late Cancellations</dt>
              <dd className="num mt-1 font-display text-xl font-bold text-ink">{d.my_stats.late_cancellations}</dd>
            </div>
          </dl>

          <p className="mt-4 text-[11px] text-ink-3">
            {label("Calculated objectively from recorded campus bookings and confirmed returns")}.
          </p>
        </section>
      </div>
    </div>
  );
}
