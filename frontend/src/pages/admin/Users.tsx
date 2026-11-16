import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, DemoBadge, Dialog, EmptyState, ErrorState, Input, ListSkeleton, PageHeader, Pagination, Select, StatusChip, Table, Td, Textarea, useToast } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { api, errMsg } from "@/lib/api";
import type { Page, User } from "@/lib/types";

export default function Users() {
  const { user: me } = useAuth();
  const [f, setF] = useState({ q: "", status: "", verification: "" });
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<User | null>(null);
  const [reason, setReason] = useState("");
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["admin", "users", f, page], queryFn: () => api.get<Page<User>>("/api/admin/users", { ...f, page }) });
  const m = useMutation({ mutationFn: () => api.patch(`/api/admin/users/${target!.id}`, { account_status: target!.account_status === "active" ? "suspended" : "active", reason }),
    onSuccess: () => { toast.success("Account updated."); setTarget(null); setReason(""); qc.invalidateQueries({ queryKey: ["admin", "users"] }); }, onError: (e) => toast.error(errMsg(e)) });
  const suspending = target?.account_status === "active";
  return (
    <div>
      <PageHeader title="Users" />
      <div className="mb-4 grid gap-3 sm:grid-cols-3"><Input label="Search" value={f.q} onChange={(e) => { setF({ ...f, q: e.target.value }); setPage(1); }} placeholder="Name, email or student ID" />
        <Select label="Account" value={f.status} onChange={(e) => { setF({ ...f, status: e.target.value }); setPage(1); }}><option value="">Any</option><option value="active">Active</option><option value="suspended">Suspended</option></Select>
        <Select label="Verification" value={f.verification} onChange={(e) => { setF({ ...f, verification: e.target.value }); setPage(1); }}><option value="">Any</option><option value="approved">Verified</option><option value="pending">Pending</option><option value="rejected">Rejected</option><option value="not_submitted">Not submitted</option></Select></div>
      {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} /> : !q.data!.items.length ? <EmptyState title="No users match" /> : <>
        <Table head={["Name", "Email", "Role", "Verification", "Account", ""]}>{q.data!.items.map((u) => (
          <tr key={u.id}><Td><span className="font-medium">{u.name}</span> {u.is_demo && <DemoBadge />}<span className="block text-ink-3">{u.student_id} · {u.department}</span></Td><Td>{u.email}</Td><Td className="capitalize">{u.role}</Td><Td><StatusChip status={u.verification_status} /></Td><Td><StatusChip status={u.account_status === "active" ? "approved" : "suspended"} /></Td>
            <Td>{u.id !== me?.id && <Button size="sm" variant="secondary" onClick={() => setTarget(u)}>{u.account_status === "active" ? "Suspend" : "Reactivate"}</Button>}</Td></tr>))}</Table>
        <Pagination page={q.data!.page} pages={q.data!.pages} total={q.data!.total} onChange={setPage} /></>}
      <Dialog open={!!target} onClose={() => setTarget(null)} title={suspending ? `Suspend ${target?.name}?` : `Reactivate ${target?.name}?`} footer={<><Button variant="secondary" onClick={() => setTarget(null)}>Cancel</Button><Button variant={suspending ? "danger" : "primary"} loading={m.isPending} onClick={() => m.mutate()}>{suspending ? "Suspend" : "Reactivate"}</Button></>}>
        <p className="mb-3 text-sm">{suspending ? "They will be unable to sign in. Existing bookings are not changed automatically." : "They will be able to sign in again."}</p><Textarea label="Reason" optional value={reason} onChange={(e) => setReason(e.target.value)} />
      </Dialog>
    </div>
  );
}
