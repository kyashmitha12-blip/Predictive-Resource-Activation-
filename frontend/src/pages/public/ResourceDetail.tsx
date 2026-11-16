import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag, MapPin, Star } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ResourceImage } from "@/components/ResourceCard";
import { Badge, Button, DemoBadge, Dialog, ErrorState, FormError, Input, LinkButton, PageHeader, Pilot, Skeleton, Textarea, useToast } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { api, errMsg } from "@/lib/api";
import { dateTime, localToISO, money, moneyPlain, pct, plusHours } from "@/lib/format";
import type { Booking, Resource } from "@/lib/types";

interface Check { bookable: boolean; reasons: string[]; estimated_cost: number; deposit: number; payment_notice: string }

export default function ResourceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const qc = useQueryClient();
  const toast = useToast();
  const base = loc.pathname.startsWith("/app") ? "/app/browse" : "/explore";
  const [img, setImg] = useState(0);
  const [start, setStart] = useState(plusHours(48));
  const [end, setEnd] = useState(plusHours(52));
  const [note, setNote] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["resource", id], queryFn: () => api.get<Resource>(`/api/resources/${id}`) });
  const valid = !!start && !!end && new Date(end) > new Date(start);
  const check = useQuery({ enabled: !!user && valid && q.data?.status === "active", queryKey: ["check", id, start, end],
    queryFn: () => api.get<Check>(`/api/resources/${id}/check`, { start: localToISO(start), end: localToISO(end) }) });
  const book = useMutation({
    mutationFn: () => api.post<Booking>("/api/bookings", { resource_id: Number(id), start_at: localToISO(start), end_at: localToISO(end), note }),
    onSuccess: (b) => { toast.success("Booking requested. The owner has been notified."); qc.invalidateQueries({ queryKey: ["bookings"] }); nav(`/app/bookings/${b.id}`); },
    onError: (e) => setErr(errMsg(e)),
  });
  const report = useMutation({
    mutationFn: () => api.post(`/api/resources/${id}/report`, { description: reportText }),
    onSuccess: () => { toast.success("Report sent to the administrators."); setReportOpen(false); setReportText(""); },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (q.isLoading) return <div className="container-x py-8"><Skeleton className="h-96" /></div>;
  if (q.isError || !q.data) return <div className="container-x py-8"><ErrorState message={errMsg(q.error ?? "Resource not found.")} /></div>;
  const r = q.data;
  const mine = user?.id === r.owner.id;
  const stats = r.owner.stats;
  const canBook = user?.role === "student" && user.verification_status === "approved" && !mine && r.status === "active";
  const submit = (e: FormEvent) => { e.preventDefault(); setErr(null); if (valid) book.mutate(); };

  return (
    <div className={base === "/explore" ? "container-x py-8" : ""}>
      <PageHeader title={r.name} crumbs={[{ to: base, label: "Browse" }, { label: r.category_label }]}
        actions={mine ? <LinkButton to={`/app/resources/${r.id}/edit`} variant="secondary">Edit listing</LinkButton> : undefined} />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <div className="overflow-hidden rounded-panel border border-line">
            <ResourceImage src={r.images[img]?.url} category={r.category} name={r.name} className="h-72 sm:h-96" />
          </div>
          {r.images.length > 1 && <div className="flex gap-2">{r.images.map((i, n) => <button key={i.id} onClick={() => setImg(n)} aria-label={`Photo ${n + 1}`} className={`h-14 w-20 overflow-hidden rounded-ctl border ${n === img ? "border-cobalt" : "border-line"}`}><img src={i.url} alt="" className="h-full w-full object-cover" /></button>)}</div>}
          <section className="panel panel-pad space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{r.category_label}</Badge><Badge className="capitalize">{r.condition}</Badge>
              {r.newly_activated && <Badge tone="lamp"><Pilot state="lit" size={8} />Newly shared</Badge>}
              {r.is_demo && <DemoBadge />}
            </div>
            <p className="whitespace-pre-line text-ink-2">{r.description || "The owner has not added a description."}</p>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-ink-3">Price</dt><dd className="num font-medium">{money(r.price_per_day)}{r.price_per_day ? " per day" : ""}</dd></div>
              <div><dt className="text-ink-3">Refundable deposit (demo)</dt><dd className="num font-medium">{r.deposit ? moneyPlain(r.deposit) : "None"}</dd></div>
              <div><dt className="text-ink-3">Pickup area</dt><dd className="inline-flex items-center gap-1 font-medium"><MapPin className="h-3.5 w-3.5" aria-hidden />{r.pickup_area || "Not set"}</dd></div>
              <div><dt className="text-ink-3">Booking length</dt><dd className="font-medium">{r.min_hours} hours to {r.max_days} days</dd></div>
            </dl>
          </section>
          <section className="panel panel-pad">
            <h2 className="text-lg">Availability</h2>
            {r.availability?.length ? <ul className="mt-2 space-y-1 text-sm">{r.availability.map((w) => <li key={w.id}>{dateTime(w.start_at)} to {dateTime(w.end_at)} {w.source === "activation" && <Badge tone="lamp" className="ml-1">Shared after a demand suggestion</Badge>}</li>)}</ul> : <p className="mt-2 text-sm text-ink-3">The owner has not offered any time window yet.</p>}
            {!!r.blocked?.length && <><h3 className="mt-4 text-sm font-semibold">Already booked</h3><ul className="mt-1 space-y-1 text-sm text-ink-2">{r.blocked.map((b, i) => <li key={i}>{dateTime(b.start_at)} to {dateTime(b.end_at)}</li>)}</ul></>}
          </section>
          <section className="panel panel-pad">
            <h2 className="text-lg">Owner</h2>
            <p className="mt-1 font-medium">{r.owner.name} <span className="font-normal text-ink-3">· {r.owner.department}</span> {r.owner.verified && <Badge tone="go">Verified student</Badge>}</p>
            {stats && <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><dt className="text-ink-3">Rating</dt><dd className="inline-flex items-center gap-1 font-medium">{stats.average_rating != null ? <><Star className="h-3.5 w-3.5 fill-lamp text-lamp" aria-hidden />{stats.average_rating.toFixed(1)} ({stats.review_count})</> : "No reviews yet"}</dd></div>
              <div><dt className="text-ink-3">Completed rentals</dt><dd className="num font-medium">{stats.completed_rentals}</dd></div>
              <div><dt className="text-ink-3">On-time returns</dt><dd className="num font-medium">{pct(stats.on_time_return_rate)}</dd></div>
              <div><dt className="text-ink-3">Late cancellations</dt><dd className="num font-medium">{stats.late_cancellations}</dd></div>
            </dl>}
          </section>
        </div>
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <section className="panel panel-pad space-y-4" aria-labelledby="book-h">
            <h2 id="book-h" className="text-lg">Request a booking</h2>
            {!user ? <><p className="text-sm text-ink-2">Sign in with a verified student account to request this resource.</p><LinkButton to="/login" state={{ from: loc.pathname }} className="w-full">Sign in</LinkButton><p className="text-center text-sm"><Link to="/register" className="link">Create an account</Link></p></>
              : mine ? <p className="text-sm text-ink-2">This is your own listing.</p>
              : !canBook ? <p className="text-sm text-ink-2">{user.role === "admin" ? "Administrator accounts cannot book." : r.status !== "active" ? "This resource is not currently shared." : "Your student verification must be approved before you can book."} {user.role === "student" && <Link to="/app/profile" className="link">Check verification</Link>}</p>
              : <form onSubmit={submit} className="space-y-3" noValidate>
                <FormError message={err} />
                <Input label="From" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
                <Input label="Until" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} error={!valid ? "End must be after the start." : null} />
                <Textarea label="Note to owner" optional maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
                <div role="status" aria-live="polite" className="rounded-ctl bg-paper p-3 text-sm">
                  {check.isFetching ? "Checking availability..." : check.data ? (check.data.bookable
                    ? <><p className="font-medium text-go">Available for this period</p><p className="num mt-1">Estimated {moneyPlain(check.data.estimated_cost)} + deposit {moneyPlain(check.data.deposit)}</p><p className="mt-1 text-xs text-ink-3">{check.data.payment_notice}</p></>
                    : <><p className="font-medium text-alert">Not bookable</p><ul className="mt-1 list-disc pl-4">{check.data.reasons.map((x) => <li key={x}>{x}</li>)}</ul></>) : "Pick dates to check availability."}
                </div>
                <Button type="submit" loading={book.isPending} disabled={!check.data?.bookable} className="w-full">Request booking</Button>
                <p className="text-xs text-ink-3">The owner decides whether to accept. Nothing is charged: payments here are DEMO only.</p>
              </form>}
          </section>
          {user && !mine && <button onClick={() => setReportOpen(true)} className="mt-3 inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink"><Flag className="h-4 w-4" aria-hidden />Report this listing</button>}
        </aside>
      </div>
      <Dialog open={reportOpen} onClose={() => setReportOpen(false)} title="Report this listing"
        footer={<><Button variant="secondary" onClick={() => setReportOpen(false)}>Cancel</Button><Button loading={report.isPending} disabled={reportText.trim().length < 10} onClick={() => report.mutate()}>Send report</Button></>}>
        <Textarea label="What is wrong?" value={reportText} onChange={(e) => setReportText(e.target.value)} hint="At least 10 characters. Administrators review every report." />
      </Dialog>
    </div>
  );
}
