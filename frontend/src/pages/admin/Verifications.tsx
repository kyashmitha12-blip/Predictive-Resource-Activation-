import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Dialog, EmptyState, ErrorState, ListSkeleton, PageHeader, Pagination, StatusChip, Textarea, useToast } from "@/components/ui";
import { api, errMsg } from "@/lib/api";
import { dateTime } from "@/lib/format";
import type { Page } from "@/lib/types";

interface Sub { id: number; status: string; college: string; student_id_number: string; note: string; submitted_at: string; decision_reason: string | null; has_document: boolean; document_url: string;
  user: { id: number; name: string; email: string; student_id: string; department: string; email_verified: boolean } }
const TABS = [["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["all", "All"]];

export default function Verifications() {
  const [tab, setTab] = useState("pending");
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<Sub | null>(null);
  const [mode, setMode] = useState<"view" | "reject">("view");
  const [reason, setReason] = useState("");
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["admin", "verifications", tab, page], queryFn: () => api.get<Page<Sub>>("/api/admin/verifications", { status: tab, page }) });
  const decide = useMutation({ mutationFn: (approve: boolean) => api.post(`/api/admin/verifications/${sel!.id}/decision`, { approve, reason }),
    onSuccess: (_d, a) => { toast.success(a ? "Student approved." : "Submission rejected."); setSel(null); setReason(""); setMode("view"); qc.invalidateQueries({ queryKey: ["admin"] }); }, onError: (e) => toast.error(errMsg(e)) });
  const open = (s: Sub) => { setSel(s); setMode("view"); setReason(""); };
  return (
    <div>
      <PageHeader title="Student verification" subtitle="Review the document, then approve or reject with a reason. Documents are visible to administrators only." />
      <div role="tablist" className="mb-4 flex flex-wrap gap-2">{TABS.map(([v, l]) => <button key={v} role="tab" aria-selected={tab === v} onClick={() => { setTab(v); setPage(1); }} className={`rounded-ctl px-3 py-1.5 text-sm ${tab === v ? "bg-night text-white" : "border border-line bg-white text-ink-2 hover:bg-paper-2"}`}>{l}</button>)}</div>
      {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} /> :
        !q.data!.items.length ? <EmptyState title="Nothing to review" /> : <>
          <ul className="space-y-3">{q.data!.items.map((s) => <li key={s.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div><p className="font-medium">{s.user.name} <span className="font-normal text-ink-3">· {s.user.department}</span></p><p className="text-sm text-ink-3">{s.user.email} · ID {s.student_id_number} · {s.college} · {dateTime(s.submitted_at)}</p>{!s.user.email_verified && <p className="text-sm text-lamp-700">Email not confirmed yet</p>}{s.decision_reason && <p className="text-sm text-ink-2">Reason: {s.decision_reason}</p>}</div>
            <div className="flex items-center gap-2"><StatusChip status={s.status} /><Button size="sm" variant="secondary" onClick={() => open(s)}>{s.status === "pending" ? "Review" : "View"}</Button></div></li>)}</ul>
          <Pagination page={q.data!.page} pages={q.data!.pages} total={q.data!.total} onChange={setPage} /></>}
      <Dialog open={!!sel} onClose={() => setSel(null)} title={sel ? `Verification: ${sel.user.name}` : ""}
        footer={sel?.status === "pending" ? (mode === "view" ? <><Button variant="danger" onClick={() => setMode("reject")}>Reject</Button><Button loading={decide.isPending} onClick={() => decide.mutate(true)}>Approve</Button></> : <><Button variant="secondary" onClick={() => setMode("view")}>Back</Button><Button variant="danger" loading={decide.isPending} disabled={!reason.trim()} onClick={() => decide.mutate(false)}>Confirm rejection</Button></>) : <Button variant="secondary" onClick={() => setSel(null)}>Close</Button>}>
        {sel && <div className="space-y-3 text-sm">
          <p>Student ID {sel.student_id_number}, {sel.college}. {sel.note && `Note: ${sel.note}`}</p>
          {sel.has_document ? (/\.pdf/i.test("") ? null : <img src={sel.document_url} alt="Submitted student ID document" className="max-h-72 w-full rounded-ctl border border-line object-contain" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />) : <p className="text-ink-3">No document attached.</p>}
          {sel.has_document && <a className="link" href={sel.document_url} target="_blank" rel="noreferrer">Open document in a new tab</a>}
          {mode === "reject" && <Textarea label="Reason for rejection" value={reason} onChange={(e) => setReason(e.target.value)} hint="Required. The student will see it." />}
        </div>}
      </Dialog>
    </div>
  );
}
