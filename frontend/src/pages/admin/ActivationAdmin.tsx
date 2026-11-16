import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Checkbox, DemoBadge, Dialog, EmptyState, ErrorState, ListSkeleton, PageHeader, Stat, StatusChip, Table, Td, useToast } from "@/components/ui";
import { api, errMsg } from "@/lib/api";
import { label, pct, shortDate } from "@/lib/format";
import type { Activation } from "@/lib/types";

interface Idle { resource_id: number; name: string; category: string; category_label: string; condition: string; owner: { name: string }; days_since_last_use: number; never_booked: boolean; utilization: number; score: number; score_breakdown: Record<string, number>; opportunity: string; category_gap: number; pickup_area: string }
interface IdleRes { period_start: string; period_end: string; items: Idle[]; thresholds: Record<string, number> }
interface ActRes { items: Activation[]; stats: Record<string, number | null> }

export default function ActivationAdmin() {
  const [sel, setSel] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();
  const idle = useQuery({ queryKey: ["admin", "idle"], queryFn: () => api.get<IdleRes>("/api/admin/idle-resources") });
  const acts = useQuery({ queryKey: ["admin", "activation"], queryFn: () => api.get<ActRes>("/api/admin/activation") });
  const gen = useMutation({ mutationFn: () => api.post<{ created: number }>("/api/admin/activation/generate", { categories: sel.length ? sel : null }),
    onSuccess: (r) => { toast.success(`${r.created} activation request(s) sent to owners.`); setConfirm(false); qc.invalidateQueries({ queryKey: ["admin"] }); }, onError: (e) => { toast.error(errMsg(e)); setConfirm(false); } });
  const cats = Array.from(new Map((idle.data?.items ?? []).filter((i) => i.category_gap > 0).map((i) => [i.category, i.category_label])).entries());
  const tone = (o: string) => (o === "High" ? "lamp" : o === "Medium" ? "info" : "neutral") as "lamp" | "info" | "neutral";
  const s = acts.data?.stats;
  return (
    <div className="space-y-8">
      <PageHeader title="Idle resources and activation" subtitle="Rank idle resources in categories with a predicted gap, then ask their owners. Owners must accept before anything becomes bookable." />
      {s && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat label="Requests sent" value={s.total ?? 0} /><Stat label="Pending" value={s.pending ?? 0} /><Stat label="Acceptance rate" value={pct(s.acceptance_rate as number | null)} note="of answered" /><Stat label="Response rate" value={pct(s.response_rate as number | null)} /></div>}
      <section aria-labelledby="idle-h"><div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h2 id="idle-h" className="text-xl">Eligible idle resources</h2><p className="text-sm text-ink-3">For {idle.data ? `${shortDate(idle.data.period_start)} to ${shortDate(idle.data.period_end)}` : "the next forecast week"}. Idle means no use for {idle.data?.thresholds.idle_days_threshold ?? 14}+ days or utilization under {pct(idle.data?.thresholds.utilization_threshold)}.</p></div></div>
        {cats.length > 0 && <fieldset className="panel panel-pad mb-3"><legend className="px-1 text-sm font-medium">Categories with a predicted gap</legend><div className="flex flex-wrap gap-4">{cats.map(([v, l]) => <Checkbox key={v} label={l} checked={sel.includes(v)} onChange={(e) => setSel(e.target.checked ? [...sel, v] : sel.filter((x) => x !== v))} />)}</div>
          <Button className="mt-3" disabled={!sel.length} onClick={() => setConfirm(true)}>Generate activation requests</Button></fieldset>}
        {idle.isLoading ? <ListSkeleton rows={3} /> : idle.isError ? <ErrorState message={errMsg(idle.error)} /> : !idle.data!.items.length ? <EmptyState title="No eligible idle resources">Resources must be verified-owned, in good condition, opted in and not already offered.</EmptyState> :
          <Table head={["Resource", "Owner", "Last used", "Utilization", "Score", "Opportunity", "Category gap"]}>{idle.data!.items.map((i) => (
            <tr key={i.resource_id}><Td><span className="font-medium">{i.name}</span><span className="block text-ink-3">{i.category_label} · {i.condition}</span></Td><Td>{i.owner.name}</Td><Td className="num">{i.never_booked ? "Never" : `${i.days_since_last_use} days ago`}</Td><Td className="num">{pct(i.utilization)}</Td><Td className="num"><span title={Object.entries(i.score_breakdown).map(([k, v]) => `${label(k)} ${v}`).join(", ")}>{i.score.toFixed(2)}</span></Td><Td><Badge tone={tone(i.opportunity)}>{i.opportunity}</Badge></Td><Td className="num">{i.category_gap}</Td></tr>))}</Table>}</section>
      <section aria-labelledby="req-h"><h2 id="req-h" className="mb-3 text-xl">Activation requests</h2>
        {acts.isLoading ? <ListSkeleton rows={3} /> : acts.isError ? <ErrorState message={errMsg(acts.error)} /> : !acts.data!.items.length ? <EmptyState title="No requests yet" /> :
          <Table head={["Resource", "Owner", "Category", "Period", "Idle score", "Status", "Outcome"]}>{acts.data!.items.map((a) => (
            <tr key={a.id}><Td className="font-medium">{a.resource.name} {a.is_demo && <DemoBadge />}</Td><Td>{a.owner?.name}</Td><Td>{a.category_label}</Td><Td className="whitespace-nowrap">{shortDate(a.period_start)} to {shortDate(a.period_end)}</Td><Td className="num">{a.idle_score.toFixed(2)}</Td><Td><StatusChip status={a.status} /></Td><Td className="text-ink-2">{a.status === "declined" ? a.decline_reason || "No reason" : a.status === "accepted" ? `Shared ${shortDate(a.available_from!.slice(0, 10))} to ${shortDate(a.available_until!.slice(0, 10))}` : "-"}</Td></tr>))}</Table>}</section>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Send activation requests?" footer={<><Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button><Button loading={gen.isPending} onClick={() => gen.mutate()}>Send requests</Button></>}>
        <p className="text-sm">Owners of the top-ranked idle resources in {sel.length} categor{sel.length === 1 ? "y" : "ies"} will be notified. Each owner decides freely; at most {idle.data?.thresholds.max_requests_per_owner_per_week ?? 2} requests per owner per week are sent, and nobody is asked twice for the same forecast.</p>
      </Dialog>
    </div>
  );
}
