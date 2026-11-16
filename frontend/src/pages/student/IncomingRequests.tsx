import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { BookingRow } from "@/components/student/BookingRow";
import { Button, Dialog, EmptyState, ErrorState, ListSkeleton, PageHeader, Pagination, Textarea, useToast } from "@/components/ui";
import { api, errMsg } from "@/lib/api";
import type { Booking, Page } from "@/lib/types";

const TABS = [["requested", "Waiting for you"], ["confirmed,active,returned,disputed", "In progress"], ["completed,cancelled,rejected", "History"]];

export default function IncomingRequests() {
  const [tab, setTab] = useState("requested");
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState<Booking | null>(null);
  const [reason, setReason] = useState("");
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["bookings", "incoming", tab, page], queryFn: () => api.get<Page<Booking>>("/api/bookings/incoming", { status: tab, page }) });
  const done = () => { qc.invalidateQueries({ queryKey: ["bookings"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); };
  const act = useMutation({ mutationFn: ({ id, path, body }: { id: number; path: string; body?: object }) => api.post(`/api/bookings/${id}/${path}`, body),
    onSuccess: (_d, v) => { toast.success(v.path === "approve" ? "Booking confirmed." : v.path === "reject" ? "Request declined." : "Handover recorded."); setRejecting(null); setReason(""); done(); }, onError: (e) => toast.error(errMsg(e)) });
  return (
    <div>
      <PageHeader title="Incoming requests" subtitle="People asking to borrow your resources." />
      <div role="tablist" className="mb-4 flex flex-wrap gap-2">{TABS.map(([v, l]) => <button key={v} role="tab" aria-selected={tab === v} onClick={() => { setTab(v); setPage(1); }} className={`rounded-ctl px-3 py-1.5 text-sm ${tab === v ? "bg-night text-white" : "border border-line bg-white text-ink-2 hover:bg-paper-2"}`}>{l}</button>)}</div>
      {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} /> :
        !q.data!.items.length ? <EmptyState title="Nothing here">Requests for your resources will appear here.</EmptyState> : <>
          <ul className="space-y-3">{q.data!.items.map((b) => (
            <BookingRow key={b.id} b={b} role="owner" actions={<>
              {b.can.approve && <Button size="sm" loading={act.isPending && act.variables?.id === b.id} onClick={() => act.mutate({ id: b.id, path: "approve" })}>Approve</Button>}
              {b.can.reject && <Button size="sm" variant="secondary" onClick={() => setRejecting(b)}>Decline</Button>}
              {b.can.handover && <Button size="sm" onClick={() => act.mutate({ id: b.id, path: "handover", body: {} })}>Confirm handover</Button>}
              {b.can.confirm_return && <Link className="link text-sm" to={`/app/bookings/${b.id}/return`}>Check the return</Link>}
            </>} />))}</ul>
          <Pagination page={q.data!.page} pages={q.data!.pages} total={q.data!.total} onChange={setPage} />
        </>}
      <Dialog open={!!rejecting} onClose={() => setRejecting(null)} title="Decline this request"
        footer={<><Button variant="secondary" onClick={() => setRejecting(null)}>Keep it</Button><Button variant="danger" loading={act.isPending} onClick={() => rejecting && act.mutate({ id: rejecting.id, path: "reject", body: { reason } })}>Decline request</Button></>}>
        <Textarea label="Reason" optional value={reason} onChange={(e) => setReason(e.target.value)} hint="The borrower will see this." />
      </Dialog>
    </div>
  );
}
