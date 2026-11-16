import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Dialog, EmptyState, ErrorState, ListSkeleton, PageHeader, Pagination, Select, StatusChip, Textarea, useToast } from "@/components/ui";
import { api, errMsg } from "@/lib/api";
import { ago, label } from "@/lib/format";
import type { Page } from "@/lib/types";

interface Rep { id: number; kind: string; target: string; booking_id: number | null; booking_status: string | null; description: string; status: string; resolution: string | null; created_at: string; reporter: { name: string } }
const TABS = [["open", "Open"], ["resolved", "Resolved"], ["dismissed", "Dismissed"], ["all", "All"]];

export default function Reports() {
  const [tab, setTab] = useState("open");
  const [page, setPage] = useState(1);
  const [t, setT] = useState<Rep | null>(null);
  const [res, setRes] = useState("");
  const [outcome, setOutcome] = useState("release_deposit");
  const [dismiss, setDismiss] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["admin", "reports", tab, page], queryFn: () => api.get<Page<Rep>>("/api/admin/reports", { status: tab, page }) });
  const disputed = t?.booking_status === "disputed";
  const m = useMutation({ mutationFn: () => api.post(`/api/admin/reports/${t!.id}/resolve`, { resolution: res, dismiss, deposit_outcome: disputed && !dismiss ? outcome : disputed ? outcome : undefined }),
    onSuccess: () => { toast.success("Report closed."); setT(null); setRes(""); setDismiss(false); qc.invalidateQueries({ queryKey: ["admin"] }); }, onError: (e) => toast.error(errMsg(e)) });
  return (
    <div>
      <PageHeader title="Reports and disputes" subtitle="Listing complaints, booking issues and damage reports. Deposits are never changed without an administrator decision." />
      <div role="tablist" className="mb-4 flex flex-wrap gap-2">{TABS.map(([v, l]) => <button key={v} role="tab" aria-selected={tab === v} onClick={() => { setTab(v); setPage(1); }} className={`rounded-ctl px-3 py-1.5 text-sm ${tab === v ? "bg-night text-white" : "border border-line bg-white text-ink-2 hover:bg-paper-2"}`}>{l}</button>)}</div>
      {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} /> : !q.data!.items.length ? <EmptyState title="No reports here" /> : <>
        <ul className="space-y-3">{q.data!.items.map((r) => <li key={r.id} className="panel p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{label(r.kind)}: {r.target}</p><p className="text-sm text-ink-3">Reported by {r.reporter.name} · {ago(r.created_at)}{r.booking_id && <> · <Link className="link" to={`/admin/bookings`}>booking #{r.booking_id}</Link></>}</p></div><div className="flex items-center gap-2">{r.booking_status === "disputed" && <StatusChip status="disputed" />}<StatusChip status={r.status} /></div></div>
          <p className="mt-2 text-sm text-ink-2">{r.description}</p>{r.resolution && <p className="mt-2 text-sm"><strong>Outcome:</strong> {r.resolution}</p>}
          {r.status === "open" && <Button size="sm" className="mt-3" onClick={() => { setT(r); setDismiss(false); }}>Review</Button>}</li>)}</ul>
        <Pagination page={q.data!.page} pages={q.data!.pages} total={q.data!.total} onChange={setPage} /></>}
      <Dialog open={!!t} onClose={() => setT(null)} title="Resolve report" footer={<><Button variant="secondary" onClick={() => setT(null)}>Cancel</Button><Button loading={m.isPending} disabled={res.trim().length < 3} onClick={() => m.mutate()}>{dismiss ? "Dismiss report" : "Resolve"}</Button></>}>
        <div className="space-y-3"><p className="text-sm text-ink-2">{t?.description}</p>
          {disputed && <Select label="What happens to the demo deposit?" value={outcome} onChange={(e) => setOutcome(e.target.value)}><option value="release_deposit">Release it to the borrower</option><option value="retain_deposit">Retain it for the owner</option></Select>}
          <Textarea label="Resolution note" value={res} onChange={(e) => setRes(e.target.value)} hint="Both parties are notified." />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={dismiss} onChange={(e) => setDismiss(e.target.checked)} />Dismiss as not actionable</label></div>
      </Dialog>
    </div>
  );
}
