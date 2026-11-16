import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ResourceImage } from "@/components/ResourceCard";
import { DemoBadge, EmptyState, ErrorState, LinkButton, ListSkeleton, PageHeader, StatusChip } from "@/components/ui";
import { api, errMsg } from "@/lib/api";
import { ago, money } from "@/lib/format";
import type { Resource } from "@/lib/types";

export default function MyResources() {
  const q = useQuery({ queryKey: ["resources", "mine"], queryFn: () => api.get<Resource[]>("/api/resources/mine") });
  return (
    <div>
      <PageHeader title="My resources" subtitle="Things you share. Idle ones may receive activation suggestions when demand is predicted to exceed supply." actions={<LinkButton to="/app/list">List a resource</LinkButton>} />
      {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} /> :
        !q.data!.length ? <EmptyState title="You have not listed anything" action={<LinkButton to="/app/list">List your first resource</LinkButton>}>Verified students can list equipment they rarely use.</EmptyState> :
          <ul className="space-y-3">{q.data!.map((r) => (
            <li key={r.id} className="panel flex flex-wrap items-center gap-4 p-4">
              <div className="h-16 w-20 shrink-0 overflow-hidden rounded-ctl"><ResourceImage src={r.images[0]?.url} category={r.category} name={r.name} className="h-16" /></div>
              <div className="min-w-0 flex-1">
                <Link className="font-medium hover:text-cobalt" to={`/app/browse/${r.id}`}>{r.name}</Link>
                <p className="text-sm text-ink-3">{r.category_label} · {money(r.price_per_day)}{r.price_per_day ? "/day" : ""} · last used {ago(r.last_booked_at)}</p>
                <p className="text-sm text-ink-2">{r.booking_count} completed · {r.pending_requests ? <Link className="link" to="/app/requests">{r.pending_requests} request(s) waiting</Link> : "no pending requests"}</p>
              </div>
              <div className="flex items-center gap-2">{r.is_demo && <DemoBadge />}<StatusChip status={r.status} resourceActive={r.status === "active"} /></div>
              <LinkButton to={`/app/resources/${r.id}/edit`} variant="secondary" size="sm">Edit</LinkButton>
            </li>))}</ul>}
    </div>
  );
}
