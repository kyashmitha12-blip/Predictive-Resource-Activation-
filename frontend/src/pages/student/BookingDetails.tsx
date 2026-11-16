import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, DemoBadge, Dialog, ErrorState, Select, Skeleton, StatusChip, Textarea, PageHeader, useToast } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { api, errMsg } from "@/lib/api";
import { dateTime, label, moneyPlain } from "@/lib/format";
import type { Booking } from "@/lib/types";

type Dlg = null | "reject" | "cancel" | "review" | "report";

export default function BookingDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [dlg, setDlg] = useState<Dlg>(null);
  const [text, setText] = useState("");
  const [rating, setRating] = useState("5");
  const q = useQuery({ queryKey: ["booking", id], queryFn: () => api.get<Booking>(`/api/bookings/${id}`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["booking", id] }); qc.invalidateQueries({ queryKey: ["bookings"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); };
  const m = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: object }) => api.post(`/api/bookings/${id}/${path}`, body ?? {}),
    onSuccess: () => { toast.success("Done."); setDlg(null); setText(""); refresh(); }, onError: (e) => toast.error(errMsg(e)),
  });
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError || !q.data) return <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} />;
  const b = q.data;
  const amOwner = user?.id === b.owner.id;
  const other = amOwner ? b.borrower : b.owner;
  const submitDlg = () => {
    if (dlg === "reject") m.mutate({ path: "reject", body: { reason: text } });
    if (dlg === "cancel") m.mutate({ path: "cancel", body: { reason: text } });
    if (dlg === "review") m.mutate({ path: "reviews", body: { rating: Number(rating), comment: text } });
    if (dlg === "report") m.mutate({ path: "report", body: { description: text } });
  };
  const title = { reject: "Decline this request", cancel: "Cancel this booking", review: `Review ${other.name}`, report: "Report an issue" };
  return (
    <div>
      <PageHeader title={b.resource.name} crumbs={[{ to: amOwner ? "/app/requests" : "/app/bookings", label: amOwner ? "Incoming requests" : "My bookings" }, { label: `Booking #${b.id}` }]}
        actions={<div className="flex items-center gap-2">{b.is_demo && <DemoBadge />}<StatusChip status={b.status} /></div>} />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <section className="panel panel-pad">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-ink-3">Period</dt><dd className="font-medium">{dateTime(b.start_at)} to {dateTime(b.end_at)}</dd></div>
              <div><dt className="text-ink-3">{amOwner ? "Borrower" : "Owner"}</dt><dd className="font-medium">{other.name}</dd></div>
              <div><dt className="text-ink-3">Pickup area</dt><dd className="font-medium">{b.resource.pickup_area || "Not set"}</dd></div>
              <div><dt className="text-ink-3">Resource</dt><dd><Link className="link" to={`/app/browse/${b.resource.id}`}>View listing</Link></dd></div>
              {b.note && <div className="sm:col-span-2"><dt className="text-ink-3">Note</dt><dd>{b.note}</dd></div>}
              {b.returned_at && <div><dt className="text-ink-3">Returned</dt><dd className="font-medium">{dateTime(b.returned_at)} {b.returned_on_time != null && <Badge tone={b.returned_on_time ? "go" : "lamp"}>{b.returned_on_time ? "On time" : "Late"}</Badge>}</dd></div>}
            </dl>
          </section>
          <section className="panel panel-pad">
            <h2 className="text-lg">Payment and deposit</h2>
            <p className="mt-1 rounded-ctl bg-lamp-50 px-3 py-2 text-sm text-lamp-700"><strong>DEMO payment.</strong> {b.payment_notice}</p>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-ink-3">Rental</dt><dd className="num font-medium">{moneyPlain(b.rental_amount)} · {label(b.payment_status)}</dd></div>
              <div><dt className="text-ink-3">Deposit</dt><dd className="num font-medium">{moneyPlain(b.deposit_amount)} · {label(b.deposit_status)}</dd></div>
            </dl>
            {b.status === "disputed" && <p className="mt-3 text-sm text-alert">This booking is in dispute. The deposit is not changed until an administrator decides.</p>}
          </section>
          {!!b.condition_reports?.length && <section className="panel panel-pad"><h2 className="text-lg">Condition reports</h2>
            <ul className="mt-2 space-y-2 text-sm">{b.condition_reports.map((c) => <li key={c.id} className="rounded-ctl border border-line p-3"><span className="font-medium capitalize">{c.kind}</span> · {label(c.condition)} · {dateTime(c.created_at)}{c.notes && <p className="text-ink-2">{c.notes}</p>}{c.photo_count > 0 && <p className="text-ink-3">{c.photo_count} photo(s) attached</p>}</li>)}</ul></section>}
        </div>
        <div className="space-y-5">
          <section className="panel panel-pad space-y-2" aria-labelledby="act-h">
            <h2 id="act-h" className="text-lg">Actions</h2>
            {b.can.approve && <Button className="w-full" loading={m.isPending} onClick={() => m.mutate({ path: "approve" })}>Approve request</Button>}
            {b.can.reject && <Button className="w-full" variant="secondary" onClick={() => setDlg("reject")}>Decline request</Button>}
            {b.can.handover && <Button className="w-full" loading={m.isPending} onClick={() => m.mutate({ path: "handover" })}>Confirm handover</Button>}
            {b.can.return && <Link className="inline-flex h-10 w-full items-center justify-center rounded-ctl bg-cobalt text-sm font-medium text-white hover:bg-cobalt-700" to={`/app/bookings/${b.id}/return`}>Report return</Link>}
            {b.can.confirm_return && <Link className="inline-flex h-10 w-full items-center justify-center rounded-ctl bg-cobalt text-sm font-medium text-white hover:bg-cobalt-700" to={`/app/bookings/${b.id}/return`}>Check and confirm return</Link>}
            {b.can.review && <Button className="w-full" variant="secondary" onClick={() => setDlg("review")}>Leave a review</Button>}
            {b.can.cancel && <Button className="w-full" variant="ghost" onClick={() => setDlg("cancel")}>Cancel booking</Button>}
            {b.can.report && <Button className="w-full" variant="ghost" onClick={() => setDlg("report")}>Report an issue</Button>}
            {!Object.values(b.can).some(Boolean) && <p className="text-sm text-ink-3">No actions are available right now.</p>}
          </section>
          <section className="panel panel-pad"><h2 className="text-lg">History</h2>
            <ol className="mt-3 space-y-3 border-l border-line pl-4">{b.history?.map((h, i) => <li key={i} className="relative text-sm"><span aria-hidden className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-cobalt" /><span className="font-medium">{label(h.to_status)}</span><span className="block text-ink-3">{dateTime(h.created_at)}{h.note && ` · ${h.note}`}</span></li>)}</ol></section>
        </div>
      </div>
      <Dialog open={!!dlg} onClose={() => setDlg(null)} title={dlg ? title[dlg] : ""}
        footer={<><Button variant="secondary" onClick={() => setDlg(null)}>Close</Button><Button loading={m.isPending} disabled={dlg === "report" && text.trim().length < 10} variant={dlg === "reject" || dlg === "cancel" ? "danger" : "primary"} onClick={submitDlg}>Confirm</Button></>}>
        <div className="space-y-3">
          {dlg === "review" && <Select label="Rating" value={rating} onChange={(e) => setRating(e.target.value)}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} out of 5</option>)}</Select>}
          <Textarea label={dlg === "report" ? "What happened?" : dlg === "review" ? "Comment" : "Reason"} optional={dlg !== "report"} value={text} onChange={(e) => setText(e.target.value)} hint={dlg === "report" ? "At least 10 characters." : undefined} />
        </div>
      </Dialog>
    </div>
  );
}
