import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, EmptyState, ErrorState, ListSkeleton, PageHeader, Pagination, useToast } from "@/components/ui";
import { api, errMsg } from "@/lib/api";
import { ago } from "@/lib/format";
import type { Notification, Page } from "@/lib/types";

export default function Notifications() {
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = useToast();
  const q = useQuery({ queryKey: ["notifications", page], queryFn: () => api.get<Page<Notification>>("/api/notifications", { page }) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["notifications"] }); qc.invalidateQueries({ queryKey: ["unread"] }); };
  const readAll = useMutation({ mutationFn: () => api.post("/api/notifications/read-all"), onSuccess: refresh, onError: (e) => toast.error(errMsg(e)) });
  const readOne = useMutation({ mutationFn: (id: number) => api.post(`/api/notifications/${id}/read`), onSuccess: refresh });
  const open = (n: Notification) => { if (!n.read) readOne.mutate(n.id); if (n.link) nav(n.link); };
  return (
    <div>
      <PageHeader title="Notifications" actions={<Button variant="secondary" size="sm" loading={readAll.isPending} onClick={() => readAll.mutate()}>Mark all as read</Button>} />
      {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} /> :
        !q.data!.items.length ? <EmptyState title="Nothing here yet">Booking updates, verification results and activation requests will appear here.</EmptyState> : <>
          <ul className="panel divide-y divide-line">
            {q.data!.items.map((n) => (
              <li key={n.id}>
                <button onClick={() => open(n)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-paper">
                  <span aria-hidden className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-lamp"}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block ${n.read ? "text-ink-2" : "font-semibold"}`}>{n.title}{!n.read && <span className="sr-only"> (unread)</span>}</span>
                    {n.body && <span className="block text-sm text-ink-3">{n.body}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-ink-3">{ago(n.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
          <Pagination page={q.data!.page} pages={q.data!.pages} total={q.data!.total} onChange={setPage} />
        </>}
    </div>
  );
}
