import { useQuery } from "@tanstack/react-query";
import { EmptyState, ErrorState, ListSkeleton, PageHeader, StatusChip } from "@/components/ui";
import { api, errMsg } from "@/lib/api";
import { CATEGORIES, Forecast } from "@/lib/types";
import { shortDate } from "@/lib/format";

export default function Insights() {
  const q = useQuery({ queryKey: ["forecast"], queryFn: () => api.get<Forecast>("/api/forecast/latest") });
  const name = (c: string) => CATEGORIES.find((x) => x.value === c)?.label ?? c;
  return (
    <div>
      <PageHeader title="Demand insights" subtitle="Predicted requests next week compared with what is actually available to borrow." />
      {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} /> :
        !q.data?.available ? <EmptyState title="No forecast yet">An administrator has not run a forecast. Check back soon.</EmptyState> : <>
          <p className="mb-4 rounded-ctl border border-lamp/40 bg-lamp-50 px-3 py-2 text-sm">{q.data.data_note} Forecasts are estimates for {shortDate(q.data.period_start)} to {shortDate(q.data.period_end)}, not guarantees.</p>
          <ul className="space-y-3">{q.data.categories.map((c) => {
            const max = Math.max(c.upper, c.effective_supply, 1);
            return (
              <li key={c.category} className="panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base">{name(c.category)}</h2><StatusChip status={c.demand_level} /></div>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center gap-3"><span className="w-36 text-ink-2">Predicted demand</span><div className="relative h-3 flex-1 rounded bg-paper-2"><div className="h-3 rounded bg-lamp" style={{ width: `${(c.predicted_demand / max) * 100}%` }} /></div><span className="num w-24 text-right">{c.predicted_demand.toFixed(1)} <span className="text-ink-3">({c.lower.toFixed(0)}-{c.upper.toFixed(0)})</span></span></div>
                  <div className="flex items-center gap-3"><span className="w-36 text-ink-2">Available supply</span><div className="h-3 flex-1 rounded bg-paper-2"><div className="h-3 rounded bg-cobalt" style={{ width: `${(c.effective_supply / max) * 100}%` }} /></div><span className="num w-24 text-right">{c.effective_supply}</span></div>
                </div>
                <p className="mt-2 text-sm text-ink-3">{c.supply_gap > 0 ? `Likely shortage of ${c.supply_gap}. Owners of idle gear may be asked to share.` : "Supply looks sufficient."}</p>
              </li>);
          })}</ul>
          <p className="mt-4 text-xs text-ink-3">Model: {q.data.model_name} ({q.data.model_version}). Range shows an 80% interval from past errors.</p>
        </>}
    </div>
  );
}
