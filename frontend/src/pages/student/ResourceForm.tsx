import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Dialog, ErrorState, FormError, Input, PageHeader, Select, Skeleton, Textarea, useToast } from "@/components/ui";
import { api, errMsg } from "@/lib/api";
import { dateTime, localToISO, plusHours } from "@/lib/format";
import { CATEGORIES, Resource } from "@/lib/types";

const blank = { name: "", category: "projector", description: "", condition: "good", price_per_day: "0", deposit: "0", pickup_area: "", min_hours: "2", max_days: "7", status: "active" };

export default function ResourceForm() {
  const { id } = useParams();
  const editing = !!id;
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState(blank);
  const [win, setWin] = useState({ start: plusHours(1), end: plusHours(24 * 14) });
  const [pending, setPending] = useState<{ start: string; end: string }[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [fe, setFe] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [archive, setArchive] = useState(false);
  const q = useQuery({ enabled: editing, queryKey: ["resource", id], queryFn: () => api.get<Resource>(`/api/resources/${id}`) });
  useEffect(() => { const r = q.data; if (r) setF({ name: r.name, category: r.category, description: r.description, condition: r.condition, price_per_day: String(r.price_per_day), deposit: String(r.deposit), pickup_area: r.pickup_area, min_hours: String(r.min_hours), max_days: String(r.max_days), status: r.status === "removed" || r.status === "archived" ? "inactive" : r.status }); }, [q.data]);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  function validate() {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 3) e.name = "At least 3 characters.";
    const n = (v: string) => Number(v);
    if (!(n(f.price_per_day) >= 0)) e.price_per_day = "Enter 0 or more (0 means free).";
    if (!(n(f.deposit) >= 0)) e.deposit = "Enter 0 or more.";
    if (!(n(f.min_hours) >= 1 && n(f.min_hours) <= 168)) e.min_hours = "1 to 168 hours.";
    if (!(n(f.max_days) >= 1 && n(f.max_days) <= 60)) e.max_days = "1 to 60 days.";
    return e;
  }
  const body = () => ({ name: f.name.trim(), category: f.category, description: f.description, condition: f.condition, price_per_day: Number(f.price_per_day), deposit: Number(f.deposit), pickup_area: f.pickup_area, min_hours: Number(f.min_hours), max_days: Number(f.max_days) });
  const uploadAll = async (rid: number) => { for (const file of files) { const fd = new FormData(); fd.set("file", file); await api.postForm(`/api/resources/${rid}/images`, fd); } };

  const save = useMutation({
    mutationFn: async () => {
      if (editing) { const r = await api.patch<Resource>(`/api/resources/${id}`, { ...body(), status: f.status }); await uploadAll(r.id); return r; }
      const r = await api.post<Resource>("/api/resources", { ...body(), availability: pending.map((w) => ({ start_at: localToISO(w.start), end_at: localToISO(w.end) })) });
      await uploadAll(r.id); return r;
    },
    onSuccess: () => { toast.success(editing ? "Listing updated." : "Listing created."); qc.invalidateQueries({ queryKey: ["resources"] }); qc.invalidateQueries({ queryKey: ["resource", id] }); nav("/app/resources"); },
    onError: (e) => setErr(errMsg(e)),
  });
  const addWin = useMutation({ mutationFn: () => api.post(`/api/resources/${id}/availability`, { start_at: localToISO(win.start), end_at: localToISO(win.end) }),
    onSuccess: () => { toast.success("Availability added."); qc.invalidateQueries({ queryKey: ["resource", id] }); }, onError: (e) => toast.error(errMsg(e)) });
  const delWin = useMutation({ mutationFn: (wid: number) => api.del(`/api/resources/${id}/availability/${wid}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["resource", id] }), onError: (e) => toast.error(errMsg(e)) });
  const delImg = useMutation({ mutationFn: (iid: number) => api.del(`/api/resources/${id}/images/${iid}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["resource", id] }), onError: (e) => toast.error(errMsg(e)) });
  const arch = useMutation({ mutationFn: () => api.del(`/api/resources/${id}`), onSuccess: () => { toast.success("Listing archived."); qc.invalidateQueries({ queryKey: ["resources"] }); nav("/app/resources"); }, onError: (e) => { toast.error(errMsg(e)); setArchive(false); } });

  function submit(e: FormEvent) { e.preventDefault(); setErr(null); const v = validate(); setFe(v); if (!Object.keys(v).length) save.mutate(); }
  function pickFiles(list: FileList | null) {
    const arr = Array.from(list ?? []);
    const bad = arr.find((x) => !["image/jpeg", "image/png", "image/webp"].includes(x.type) || x.size > 5 * 1024 * 1024);
    if (bad) return setErr(`${bad.name}: use JPG, PNG or WebP under 5 MB.`);
    setErr(null); setFiles(arr.slice(0, 6));
  }
  if (editing && q.isLoading) return <Skeleton className="h-96" />;
  if (editing && (q.isError || !q.data)) return <ErrorState message={errMsg(q.error)} />;
  const r = q.data;
  return (
    <div>
      <PageHeader title={editing ? "Edit resource" : "List a resource"} subtitle="Only verified students can list. You stay in control of when it is shared." crumbs={[{ to: "/app/resources", label: "My resources" }, { label: editing ? "Edit" : "New" }]} />
      <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="panel panel-pad space-y-4">
          <FormError message={err} />
          <Input label="Name" value={f.name} onChange={set("name")} error={fe.name} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Category" value={f.category} onChange={set("category")}>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select>
            <Select label="Condition" value={f.condition} onChange={set("condition")}>{["new", "good", "fair", "worn"].map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}</Select>
          </div>
          <Textarea label="Description" optional maxLength={2000} value={f.description} onChange={set("description")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Price per day (₹)" type="number" min={0} value={f.price_per_day} onChange={set("price_per_day")} error={fe.price_per_day} hint="0 means free sharing." />
            <Input label="Refundable deposit (₹, demo)" type="number" min={0} value={f.deposit} onChange={set("deposit")} error={fe.deposit} />
            <Input label="Minimum booking (hours)" type="number" min={1} value={f.min_hours} onChange={set("min_hours")} error={fe.min_hours} />
            <Input label="Maximum booking (days)" type="number" min={1} value={f.max_days} onChange={set("max_days")} error={fe.max_days} />
          </div>
          <Input label="Pickup area" value={f.pickup_area} onChange={set("pickup_area")} hint="A general campus area, never a home address." optional />
          {editing && <Select label="Status" value={f.status} onChange={set("status")}><option value="active">Shared (bookable in its windows)</option><option value="inactive">Not shared</option><option value="maintenance">Maintenance</option></Select>}
          <div className="flex flex-wrap gap-2"><Button type="submit" loading={save.isPending}>{editing ? "Save changes" : "Create listing"}</Button>{editing && <Button variant="ghost" onClick={() => setArchive(true)}>Archive listing</Button>}</div>
        </section>
        <div className="space-y-6">
          <section className="panel panel-pad space-y-3">
            <h2 className="text-lg">Photos</h2>
            {r && !!r.images.length && <div className="grid grid-cols-3 gap-2">{r.images.map((i) => <div key={i.id} className="relative"><img src={i.url} alt="" className="h-20 w-full rounded-ctl object-cover" /><button type="button" aria-label="Delete photo" onClick={() => delImg.mutate(i.id)} className="absolute right-1 top-1 rounded bg-white/90 p-1 text-alert"><Trash2 className="h-4 w-4" /></button></div>)}</div>}
            <input type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="Add photos" onChange={(e) => pickFiles(e.target.files)} className="block w-full text-sm" />
            <p className="text-sm text-ink-3">Up to 6 photos, JPG, PNG or WebP, 5 MB each. {files.length ? `${files.length} ready to upload on save.` : ""}</p>
          </section>
          <section className="panel panel-pad space-y-3">
            <h2 className="text-lg">When can people borrow it?</h2>
            {editing ? (r?.availability?.length ? <ul className="space-y-1 text-sm">{r.availability.map((w) => <li key={w.id} className="flex items-center justify-between gap-2"><span>{dateTime(w.start_at)} to {dateTime(w.end_at)}</span><button type="button" onClick={() => delWin.mutate(w.id)} className="text-alert" aria-label="Remove window"><Trash2 className="h-4 w-4" /></button></li>)}</ul> : <p className="text-sm text-ink-3">No windows yet. It cannot be booked until you add one.</p>)
              : <ul className="space-y-1 text-sm">{pending.map((w, i) => <li key={i} className="flex items-center justify-between"><span>{dateTime(localToISO(w.start))} to {dateTime(localToISO(w.end))}</span><button type="button" onClick={() => setPending(pending.filter((_, j) => j !== i))} className="text-alert" aria-label="Remove window"><Trash2 className="h-4 w-4" /></button></li>)}</ul>}
            <Input label="From" type="datetime-local" value={win.start} onChange={(e) => setWin({ ...win, start: e.target.value })} />
            <Input label="Until" type="datetime-local" value={win.end} onChange={(e) => setWin({ ...win, end: e.target.value })} />
            <Button type="button" variant="secondary" disabled={!win.start || !win.end || new Date(win.end) <= new Date(win.start)} loading={addWin.isPending}
              onClick={() => editing ? addWin.mutate() : setPending([...pending, win])}>Add window</Button>
          </section>
        </div>
      </form>
      <Dialog open={archive} onClose={() => setArchive(false)} title="Archive this listing?" footer={<><Button variant="secondary" onClick={() => setArchive(false)}>Keep it</Button><Button variant="danger" loading={arch.isPending} onClick={() => arch.mutate()}>Archive</Button></>}>
        <p className="text-sm">It will disappear from browsing and pending requests will be declined. Listings with confirmed or active bookings cannot be archived yet.</p>
      </Dialog>
    </div>
  );
}
