import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button, ErrorState, Input, ListSkeleton, PageHeader, Pagination, Select, Table, Td, Textarea, useToast } from "@/components/ui";
import { api, errMsg } from "@/lib/api";
import { dateTime } from "@/lib/format";
import type { Page } from "@/lib/types";

interface Log { id: number; action: string; entity_type: string; entity_id: number | null; details: Record<string, unknown>; created_at: string; actor: { name: string } | null }
interface S { values: Record<string, number>; help: Record<string, string>; event_weeks: string[] }
const ACTIONS = ["", "verification", "forecast", "activation", "dispute", "resource", "user", "settings", "booking"];

export default function Platform() {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const toast = useToast();
  const logs = useQuery({ queryKey: ["admin", "audit", action, page], queryFn: () => api.get<Page<Log>>("/api/admin/audit-logs", { action, page }) });
  const st = useQuery({ queryKey: ["admin", "settings"], queryFn: () => api.get<S>("/api/admin/settings") });
  const [vals, setVals] = useState<Record<string, string>>({});
  const [weeks, setWeeks] = useState("");
  useEffect(() => { if (st.data) { setVals(Object.fromEntries(Object.entries(st.data.values).map(([k, v]) => [k, String(v)]))); setWeeks(st.data.event_weeks.join("\n")); } }, [st.data]);
  const save = useMutation({ mutationFn: () => api.put("/api/admin/settings", { values: { ...Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, Number(v)])), event_weeks: weeks.split(/\s+/).filter(Boolean) } }),
    onSuccess: () => { toast.success("Settings saved. They apply to the next forecast and activation run."); qc.invalidateQueries({ queryKey: ["admin", "settings"] }); }, onError: (e) => toast.error(errMsg(e)) });
  return (
    <div className="space-y-8">
      <PageHeader title="Platform settings and audit log" />
      <section className="panel panel-pad space-y-4" aria-labelledby="set-h"><h2 id="set-h" className="text-lg">Idle detection and activation settings</h2>
        {st.isLoading ? <ListSkeleton rows={2} /> : st.isError ? <ErrorState message={errMsg(st.error)} /> : <>
          <div className="grid gap-4 sm:grid-cols-2">{Object.keys(st.data!.values).map((k) => <Input key={k} label={st.data!.help[k] ?? k} type="number" step="any" min={0} value={vals[k] ?? ""} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} />)}</div>
          <Textarea label="Event weeks (week-start Mondays, one per line, YYYY-MM-DD)" optional value={weeks} onChange={(e) => setWeeks(e.target.value)} hint="Exam, fest or hackathon weeks. The forecast uses these as a feature." />
          <Button loading={save.isPending} onClick={() => save.mutate()}>Save settings</Button></>}</section>
      <section aria-labelledby="log-h"><div className="mb-3 flex flex-wrap items-end justify-between gap-3"><h2 id="log-h" className="text-lg">Audit log</h2><div className="w-52"><Select label="Action" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>{ACTIONS.map((a) => <option key={a} value={a}>{a || "All actions"}</option>)}</Select></div></div>
        {logs.isLoading ? <ListSkeleton /> : logs.isError ? <ErrorState message={errMsg(logs.error)} onRetry={() => logs.refetch()} /> : <>
          <Table head={["When", "Who", "Action", "Entity", "Details"]}>{logs.data!.items.map((l) => <tr key={l.id}><Td className="whitespace-nowrap">{dateTime(l.created_at)}</Td><Td>{l.actor?.name ?? "System"}</Td><Td className="font-medium">{l.action}</Td><Td>{l.entity_type}{l.entity_id ? ` #${l.entity_id}` : ""}</Td><Td className="max-w-xs text-ink-3"><span className="block truncate" title={JSON.stringify(l.details)}>{Object.keys(l.details).length ? JSON.stringify(l.details) : "-"}</span></Td></tr>)}</Table>
          <Pagination page={logs.data!.page} pages={logs.data!.pages} total={logs.data!.total} onChange={setPage} /></>}</section>
    </div>
  );
}
