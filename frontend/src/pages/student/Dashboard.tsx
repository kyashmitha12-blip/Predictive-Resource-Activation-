import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ResourceCard } from "@/components/ResourceCard";
import { BookingRow } from "@/components/student/BookingRow";
import { EmptyState, ErrorState, LinkButton, ListSkeleton, PageHeader, Pilot, Stat, StatusChip } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { api, errMsg } from "@/lib/api";
import { ago, label, pct, shortDate } from "@/lib/format";
import type { Activation, Booking, OwnerStats, Resource } from "@/lib/types";

interface Dash {
  counts: Record<string, number>; upcoming_bookings: Booking[]; activation_requests: Activation[];
  recent_activity: { booking_id: number; to_status: string; note: string; created_at: string; resource_name: string }[];
  recommended: { score: number; reasons: string[]; resource: Resource }[]; my_stats: OwnerStats;
}

export default function Dashboard() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => api.get<Dash>("/api/dashboard/student") });
  if (q.isLoading) return <ListSkeleton rows={5} />;
  if (q.isError || !q.data) return <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} />;
  const d = q.data, c = d.counts;
  return (
    <div className="space-y-8">
      <PageHeader title={`Welcome, ${user?.name.split(" ")[0]}`} subtitle="What needs your attention today." actions={<LinkButton to="/app/list">List a resource</LinkButton>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Requests to answer" value={c.pending_incoming} />
        <Stat label="Waiting for owners" value={c.pending_outgoing} />
        <Stat label="My listed resources" value={c.my_resources} />
        <Stat label="Unread notifications" value={c.unread_notifications} />
      </div>
      {!!d.activation_requests.length && (
        <section aria-labelledby="act-h" className="rounded-panel border border-lamp/40 bg-lamp-50 p-5">
          <h2 id="act-h" className="flex items-center gap-2 text-lg"><Pilot state="pending" />Demand is rising for gear you own</h2>
          <p className="text-sm text-ink-2">You decide whether to share. Nothing is made available without your consent.</p>
          <ul className="mt-3 space-y-2">{d.activation_requests.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-ctl bg-white p-3 text-sm">
              <span><strong>{a.resource.name}</strong> · {a.category_label}, {shortDate(a.period_start)} to {shortDate(a.period_end)}</span>
              <Link className="link" to={`/app/activation/${a.id}`}>View opportunity</Link>
            </li>))}</ul>
        </section>)}
      <section aria-labelledby="up-h"><h2 id="up-h" className="mb-3 text-xl">Upcoming and active</h2>
        {!d.upcoming_bookings.length ? <EmptyState title="No upcoming bookings" action={<LinkButton to="/app/browse">Browse resources</LinkButton>}>Confirmed and active rentals appear here.</EmptyState> :
          <ul className="space-y-3">{d.upcoming_bookings.map((b) => <BookingRow key={b.id} b={b} role={b.owner.id === user?.id ? "owner" : "borrower"} />)}</ul>}</section>
      <section aria-labelledby="rec-h"><h2 id="rec-h" className="mb-1 text-xl">Available tomorrow</h2><p className="mb-3 text-sm text-ink-3">Ranked by price, condition, owner reliability and pickup area. Only resources free for the whole window are shown.</p>
        {!d.recommended.length ? <EmptyState title="Nothing is free in that window">Try Browse to search other dates.</EmptyState> :
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{d.recommended.map((r) => <ResourceCard key={r.resource.id} r={r.resource} to={`/app/browse/${r.resource.id}`} score={r.score} />)}</div>}</section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel panel-pad"><h2 className="text-lg">Recent activity</h2>
          {!d.recent_activity.length ? <p className="mt-2 text-sm text-ink-3">No activity yet.</p> : <ul className="mt-2 divide-y divide-line">{d.recent_activity.map((a, i) => <li key={i} className="flex items-center justify-between gap-2 py-2 text-sm"><Link className="hover:text-cobalt" to={`/app/bookings/${a.booking_id}`}>{a.resource_name}</Link><span className="flex items-center gap-2"><StatusChip status={a.to_status} /><span className="text-ink-3">{ago(a.created_at)}</span></span></li>)}</ul>}</section>
        <section className="panel panel-pad"><h2 className="text-lg">My reliability</h2>
          <dl className="mt-2 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-ink-3">Completed rentals</dt><dd className="num font-medium">{d.my_stats.completed_rentals}</dd></div><div><dt className="text-ink-3">Average rating</dt><dd className="num font-medium">{d.my_stats.average_rating ?? "No reviews yet"}</dd></div><div><dt className="text-ink-3">On-time returns</dt><dd className="num font-medium">{pct(d.my_stats.on_time_return_rate)}</dd></div><div><dt className="text-ink-3">Late cancellations</dt><dd className="num font-medium">{d.my_stats.late_cancellations}</dd></div></dl>
          <p className="mt-3 text-xs text-ink-3">{label("calculated from recorded bookings and reviews, not a prediction")}.</p></section>
      </div>
    </div>
  );
}
