import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, ErrorState, FormError, PageHeader, Select, Skeleton, Textarea, useToast } from "@/components/ui";
import { api, errMsg } from "@/lib/api";
import type { Booking } from "@/lib/types";

export default function ReturnForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [condition, setCondition] = useState("as_expected");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["booking", id], queryFn: () => api.get<Booking>(`/api/bookings/${id}`) });
  const m = useMutation({
    mutationFn: ({ path, form }: { path: string; form: FormData }) => api.postForm(`/api/bookings/${id}/${path}`, form),
    onSuccess: () => { toast.success("Saved."); qc.invalidateQueries(); nav(`/app/bookings/${id}`); }, onError: (e) => setErr(errMsg(e)),
  });
  if (q.isLoading) return <Skeleton className="h-80" />;
  if (q.isError || !q.data) return <ErrorState message={errMsg(q.error)} />;
  const b = q.data;
  const path = b.can.return ? "return" : b.can.confirm_return ? "confirm-return" : null;
  const owner = path === "confirm-return";
  function pick(list: FileList | null) {
    setErr(null);
    const arr = Array.from(list ?? []);
    if (arr.length > 4) return setErr("Attach at most 4 photos.");
    const bad = arr.find((f) => !["image/jpeg", "image/png", "image/webp"].includes(f.type) || f.size > 5 * 1024 * 1024);
    if (bad) return setErr(`${bad.name}: use JPG, PNG or WebP under 5 MB.`);
    setFiles(arr);
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!path) return;
    const f = new FormData();
    f.set("condition", condition); f.set("notes", notes);
    files.forEach((p) => f.append("photos", p));
    m.mutate({ path, form: f });
  }
  return (
    <div>
      <PageHeader title={owner ? "Check and confirm the return" : "Report the return"} crumbs={[{ to: `/app/bookings/${b.id}`, label: b.resource.name }, { label: "Return" }]} />
      {!path ? <ErrorState message="There is no return step available for this booking right now." /> :
        <form onSubmit={submit} className="panel panel-pad max-w-xl space-y-4" noValidate>
          <FormError message={err} />
          <Select label={owner ? "Condition on return" : "Condition you are returning it in"} value={condition} onChange={(e) => setCondition(e.target.value)}>
            <option value="as_expected">As expected</option><option value="minor_wear">Minor wear</option><option value="damaged">Damaged</option>
          </Select>
          {condition === "damaged" && <p className="rounded-ctl bg-alert-50 px-3 py-2 text-sm text-alert">{owner ? "Reporting damage opens a dispute for an administrator. The deposit is never deducted automatically." : "Be honest about any damage: the owner will also check it."}</p>}
          <Textarea label="Notes" optional maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div>
            <label htmlFor="photos" className="mb-1.5 block text-sm font-medium">Photos <span className="font-normal text-ink-3">(optional, up to 4)</span></label>
            <input id="photos" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => pick(e.target.files)} className="block w-full text-sm" />
            <p className="mt-1 text-sm text-ink-3">JPG, PNG or WebP, 5 MB each. {files.length ? `${files.length} selected.` : ""}</p>
          </div>
          <Button type="submit" loading={m.isPending}>{owner ? "Confirm return" : "Submit return"}</Button>
        </form>}
    </div>
  );
}
