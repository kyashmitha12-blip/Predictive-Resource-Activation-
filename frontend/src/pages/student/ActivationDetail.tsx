import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { Button, Dialog, ErrorState, FormError, Input, PageHeader, Skeleton, StatusChip, Textarea, useToast } from "@/components/ui";
import { api, errMsg } from "@/lib/api";
import { dateTime, isoToLocal, label, localToISO, shortDate } from "@/lib/format";
import type { Activation } from "@/lib/types";

export default function ActivationDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["activation", "one", id], queryFn: () => api.get<Activation>(`/api/activation/${id}`) });
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const done = (msg: string) => { toast.success(msg); setDeclining(false); qc.invalidateQueries({ queryKey: ["activation"] }); qc.invalidateQueries({ queryKey: ["activation-pending"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); qc.invalidateQueries({ queryKey: ["resources"] }); };
  const accept = useMutation({ mutationFn: () => api.post(`/api/activation/${id}/accept`, { available_from: localToISO(from), available_until: localToISO(until) }), onSuccess: () => done("Your resource is now available for booking in that period."), onError: (e) => setErr(errMsg(e)) });
  const decline = useMutation({ mutationFn: () => api.post(`/api/activation/${id}/decline`, { reason }), onSuccess: () => done("Suggestion declined."), onError: (e) => toast.error(errMsg(e)) });
  const withdraw = useMutation({ mutationFn: () => api.post(`/api/activation/${id}/withdraw`), onSuccess: () => done("Availability withdrawn."), onError: (e) => toast.error(errMsg(e)) });
  if (q.isLoading) return <Skeleton className="h-80" />;
  if (q.isError || !q.data) return <ErrorState message={errMsg(q.error)} />;
  const a = q.data;
  const lo = a.period_start + "T00:00", hi = a.period_end + "T23:59";
  if (!from && a.status === "pending") { setFrom(a.period_start + "T09:00"); setUntil(a.period_end + "T18:00"); }
  const bad = !from || !until || new Date(until) <= new Date(from) || from < lo || until > hi;
  return (
    <div>
      <PageHeader title={a.resource.name} crumbs={[{ to: "/app/activation", label: "Activation requests" }, { label: "Opportunity" }]} actions={<StatusChip status={a.status} />} />
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          <section className="panel panel-pad space-y-3">
            <h2 className="text-lg">Why you were asked</h2>
            <p className="text-ink-2">{a.reason}</p>
            <dl className="num grid grid-cols-3 gap-3 text-sm"><div><dt className="text-ink-3">Predicted demand</dt><dd className="text-xl font-semibold">{a.predicted_demand.toFixed(0)}</dd></div><div><dt className="text-ink-3">Supply then</dt><dd className="text-xl font-semibold">{a.supply_at_request}</dd></div><div><dt className="text-ink-3">Gap</dt><dd className="text-xl font-semibold">{a.gap_at_request}</dd></div></dl>
            <p className="text-sm text-ink-3">Requested period: {shortDate(a.period_start)} to {shortDate(a.period_end)}. This is a forecast and may be wrong. It is decision support, not a guarantee.</p>
          </section>
          <section className="panel panel-pad"><h2 className="text-lg">How your resource was chosen</h2>
            <p className="text-sm text-ink-3">Idle score {a.idle_score.toFixed(2)} out of 1, from recent use, low utilization, condition and your reliability.</p>
            <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">{Object.entries(a.score_breakdown).map(([k, v]) => <li key={k} className="flex justify-between"><span className="text-ink-2">{label(k)}</span><span className="num">{typeof v === "number" ? (Number.isInteger(v) ? v : v.toFixed(2)) : String(v)}</span></li>)}</ul></section>
        </div>
        <section className="panel panel-pad space-y-3 lg:self-start">
          <p className="rounded-ctl bg-cobalt-50 px-3 py-2 text-sm text-cobalt-700">You stay in control. Nothing is shared unless you accept, and you can withdraw until a booking is confirmed.</p>
          {a.status === "pending" && <>
            <FormError message={err} />
            <Input label="Available from" type="datetime-local" min={lo} max={hi} value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input label="Available until" type="datetime-local" min={lo} max={hi} value={until} onChange={(e) => setUntil(e.target.value)} error={until && bad ? `Choose a range inside ${shortDate(a.period_start)} to ${shortDate(a.period_end)}.` : null} hint={`Minimum ${a.resource.min_hours} hours.`} />
            <Button className="w-full" loading={accept.isPending} disabled={bad} onClick={() => { setErr(null); accept.mutate(); }}>Activate resource</Button>
            <Button className="w-full" variant="secondary" onClick={() => setDeclining(true)}>Decline suggestion</Button></>}
          {a.status === "accepted" && <><p className="text-sm">Shared {dateTime(a.available_from)} to {dateTime(a.available_until)}.</p><Button variant="secondary" className="w-full" loading={withdraw.isPending} onClick={() => withdraw.mutate()}>Withdraw availability</Button></>}
          {a.status === "declined" && <p className="text-sm text-ink-2">You declined{a.decline_reason ? `: ${a.decline_reason}` : "."}</p>}
          {["withdrawn", "expired"].includes(a.status) && <p className="text-sm text-ink-2">This request is closed.</p>}
        </section>
      </div>
      <Dialog open={declining} onClose={() => setDeclining(false)} title="Decline this suggestion" footer={<><Button variant="secondary" onClick={() => setDeclining(false)}>Cancel</Button><Button loading={decline.isPending} onClick={() => decline.mutate()}>Decline</Button></>}>
        <Textarea label="Reason" optional value={reason} onChange={(e) => setReason(e.target.value)} hint="Optional. Administrators see this to improve suggestions." />
      </Dialog>
    </div>
  );
}
