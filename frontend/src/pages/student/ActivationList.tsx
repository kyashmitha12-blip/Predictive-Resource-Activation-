import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { DemoBadge, EmptyState, ErrorState, ListSkeleton, PageHeader, Pilot, StatusChip } from "@/components/ui";
import { api, errMsg } from "@/lib/api";
import { shortDate } from "@/lib/format";
import type { Activation } from "@/lib/types";

const TABS = [["pending", "Needs your decision"], ["accepted", "Accepted"], ["declined,withdrawn,expired", "Closed"]];

export default function ActivationList() {
  const [tab, setTab] = useState("pending");
  const q = useQuery({ queryKey: ["activation", tab], queryFn: () => api.get<Activation[]>("/api/activation/mine", { status: tab }) });
  return (
    <div>
      <PageHeader title="Activation requests" subtitle="When predicted demand is higher than the supply available, we may ask whether you would share something you are not using. It is always your choice." />
      <div role="tablist" className="mb-4 flex flex-wrap gap-2">{TABS.map(([v, l]) => <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={`rounded-ctl px-3 py-1.5 text-sm ${tab === v ? "bg-night text-white" : "border border-line bg-white text-ink-2 hover:bg-paper-2"}`}>{l}</button>)}</div>
      {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} /> :
        !q.data!.length ? <EmptyState title="No requests here">Requests appear when a shortage is predicted in a category you have idle gear in.</EmptyState> :
          <ul className="space-y-3">{q.data!.map((a) => (
            <li key={a.id} className="panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><Link to={`/app/activation/${a.id}`} className="inline-flex items-center gap-2 font-medium hover:text-cobalt">{a.status === "pending" && <Pilot state="pending" />}{a.resource.name}</Link>
                  <p className="text-sm text-ink-3">{a.category_label} · {shortDate(a.period_start)} to {shortDate(a.period_end)}</p></div>
                <div className="flex items-center gap-2">{a.is_demo && <DemoBadge />}<StatusChip status={a.status} /></div>
              </div>
              <p className="mt-2 text-sm text-ink-2">{a.reason}</p>
              <p className="num mt-2 text-sm text-ink-3">Predicted demand {a.predicted_demand.toFixed(0)} · supply {a.supply_at_request} · gap {a.gap_at_request}</p>
            </li>))}</ul>}
    </div>
  );
}
