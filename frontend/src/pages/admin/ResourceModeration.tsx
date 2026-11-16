import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, DemoBadge, Dialog, EmptyState, ErrorState, Input, ListSkeleton, PageHeader, Pagination, Select, StatusChip, Table, Td, Textarea, useToast } from "@/components/ui";
import { api, errMsg } from "@/lib/api";
import type { Page, Resource } from "@/lib/types";

type R = Resource & { open_reports: number; owner_email: string };
export default function ResourceModeration() {
  const [f, setF] = useState({ q: "", status: "" });
  const [page, setPage] = useState(1);
  const [t, setT] = useState<R | null>(null);
  const [note, setNote] = useState("");
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["admin", "resources", f, page], queryFn: () => api.get<Page<R>>("/api/admin/resources", { ...f, page }) });
  const removing = t ? t.status !== "removed" : true;
  const m = useMutation({ mutationFn: () => api.post(`/api/admin/resources/${t!.id}/moderate`, { action: removing ? "remove" : "restore", note }),
    onSuccess: () => { toast.success(removing ? "Listing removed." : "Listing restored."); setT(null); setNote(""); qc.invalidateQueries({ queryKey: ["admin", "resources"] }); }, onError: (e) => toast.error(errMsg(e)) });
  return (
    <div>
      <PageHeader title="Resource moderation" subtitle="Listings with open reports are flagged. Removing a listing cancels its unstarted bookings." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2"><Input label="Search by name" value={f.q} onChange={(e) => { setF({ ...f, q: e.target.value }); setPage(1); }} />
        <Select label="Status" value={f.status} onChange={(e) => { setF({ ...f, status: e.target.value }); setPage(1); }}><option value="">Any</option>{["active", "inactive", "maintenance", "archived", "removed"].map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
      {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} /> : !q.data!.items.length ? <EmptyState title="No listings match" /> : <>
        <Table head={["Listing", "Owner", "Status", "Reports", ""]}>{q.data!.items.map((r) => (
          <tr key={r.id}><Td><Link className="font-medium hover:text-cobalt" to={`/app/browse/${r.id}`}>{r.name}</Link> {r.is_demo && <DemoBadge />}<span className="block text-ink-3">{r.category_label}</span></Td><Td>{r.owner.name}<span className="block text-ink-3">{r.owner_email}</span></Td><Td><StatusChip status={r.status} /></Td><Td className="num">{r.open_reports ? <span className="font-semibold text-alert">{r.open_reports} open</span> : 0}</Td>
            <Td>{r.status !== "archived" && <Button size="sm" variant="secondary" onClick={() => setT(r)}>{r.status === "removed" ? "Restore" : "Remove"}</Button>}</Td></tr>))}</Table>
        <Pagination page={q.data!.page} pages={q.data!.pages} total={q.data!.total} onChange={setPage} /></>}
      <Dialog open={!!t} onClose={() => setT(null)} title={removing ? `Remove ${t?.name}?` : `Restore ${t?.name}?`} footer={<><Button variant="secondary" onClick={() => setT(null)}>Cancel</Button><Button variant={removing ? "danger" : "primary"} loading={m.isPending} onClick={() => m.mutate()}>{removing ? "Remove listing" : "Restore"}</Button></>}>
        <Textarea label="Note to the owner" optional value={note} onChange={(e) => setNote(e.target.value)} />
      </Dialog>
    </div>
  );
}
