import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { Badge, Button, Checkbox, FormError, Input, PageHeader, StatusChip, useToast } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { api, errMsg } from "@/lib/api";
import { dateOnly } from "@/lib/format";

interface V { status: string; reason: string | null; submission: { college: string; student_id_number: string; submitted_at: string } | null }

export default function Profile() {
  const { user, refresh } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [p, setP] = useState({ name: user?.name ?? "", department: user?.department ?? "", college: user?.college ?? "", preferred_area: user?.preferred_area ?? "", open: user?.open_to_activation ?? true });
  const [pw, setPw] = useState({ current: "", next: "" });
  const [v, setV] = useState({ college: user?.college ?? "", sid: user?.student_id ?? "", note: "" });
  const [doc, setDoc] = useState<File | null>(null);
  const [err, setErr] = useState<Record<string, string | null>>({});
  const [devLink, setDevLink] = useState<string | null>(null);
  const ver = useQuery({ queryKey: ["verification"], queryFn: () => api.get<V>("/api/verification/me") });
  const save = useMutation({ mutationFn: () => api.patch("/api/users/me", { name: p.name, department: p.department, college: p.college, preferred_area: p.preferred_area, open_to_activation: p.open }),
    onSuccess: () => { toast.success("Profile saved."); refresh(); }, onError: (e) => setErr({ ...err, profile: errMsg(e) }) });
  const chpw = useMutation({ mutationFn: () => api.post("/api/auth/change-password", { current_password: pw.current, new_password: pw.next }),
    onSuccess: () => { toast.success("Password changed. Other devices were signed out."); setPw({ current: "", next: "" }); setErr({ ...err, pw: null }); }, onError: (e) => setErr({ ...err, pw: errMsg(e) }) });
  const submitV = useMutation({ mutationFn: () => { const f = new FormData(); f.set("college", v.college); f.set("student_id_number", v.sid); f.set("note", v.note); f.set("document", doc!); return api.postForm("/api/verification", f); },
    onSuccess: () => { toast.success("Submitted. An administrator will review it."); refresh(); qc.invalidateQueries({ queryKey: ["verification"] }); }, onError: (e) => setErr({ ...err, v: errMsg(e) }) });
  const resend = useMutation({ mutationFn: () => api.post<{ dev_verification_link?: string; email_status?: string }>("/api/auth/resend-verification"), onSuccess: (r) => { setDevLink(r.dev_verification_link ?? null); toast.info(r.dev_verification_link ? "Development mode: use the link shown below." : r.email_status === "not_configured" ? "Email delivery is not set up on this server, so nothing was sent. Contact an administrator." : "Verification email requested."); }, onError: (e) => toast.error(errMsg(e)) });
  if (!user) return null;
  const status = ver.data?.status ?? user.verification_status;
  const canSubmit = user.email_verified && (status === "not_submitted" || status === "rejected");
  function pickDoc(l: FileList | null) {
    const f = l?.[0]; setErr({ ...err, v: null });
    if (!f) return setDoc(null);
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(f.type) || f.size > 5 * 1024 * 1024) { setDoc(null); return setErr({ ...err, v: "Use a JPG, PNG, WebP or PDF under 5 MB." }); }
    setDoc(f);
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Profile and verification" />
      <section className="panel panel-pad space-y-3" aria-labelledby="ver-h">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="ver-h" className="text-lg">Student verification</h2><StatusChip status={status} /></div>
        <p className="flex items-center gap-2 text-sm">Email: {user.email} {user.email_verified ? <Badge tone="go">Confirmed</Badge> : <Badge tone="lamp">Not confirmed</Badge>}</p>
        {!user.email_verified && <div className="space-y-2"><Button size="sm" variant="secondary" loading={resend.isPending} onClick={() => resend.mutate()}>Send confirmation email</Button>{devLink && <div className="rounded-ctl border border-lamp/40 bg-lamp-50 p-3 text-sm"><p className="font-medium">Development mode: no email was sent.</p><a className="link break-all" href={devLink}>{devLink}</a></div>}</div>}
        {status === "pending" && <p className="text-sm text-ink-2">Submitted {ver.data?.submission ? dateOnly(ver.data.submission.submitted_at) : ""}. An administrator will review your document.</p>}
        {status === "approved" && <p className="text-sm text-go">You are verified and can list resources and book.</p>}
        {status === "rejected" && <p role="alert" className="text-sm text-alert">Rejected{ver.data?.reason ? `: ${ver.data.reason}` : "."} You can submit again below.</p>}
        {canSubmit && <form className="space-y-3" onSubmit={(e: FormEvent) => { e.preventDefault(); setErr({ ...err, v: null }); if (!doc) return setErr({ ...err, v: "Attach a photo or PDF of your student ID." }); submitV.mutate(); }}>
          <FormError message={err.v} />
          <div className="grid gap-3 sm:grid-cols-2"><Input label="College" value={v.college} onChange={(e) => setV({ ...v, college: e.target.value })} /><Input label="Student ID number" value={v.sid} onChange={(e) => setV({ ...v, sid: e.target.value })} /></div>
          <Input label="Note" optional value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />
          <div><label htmlFor="doc" className="mb-1.5 block text-sm font-medium">Student ID document</label><input id="doc" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => pickDoc(e.target.files)} className="block w-full text-sm" /><p className="mt-1 text-sm text-ink-3">Only administrators can view it. It is never public.</p></div>
          <Button type="submit" loading={submitV.isPending}>Submit for review</Button>
          <p className="text-xs text-ink-3">This is a project workflow reviewed by a platform administrator, not an integration with an official college system.</p></form>}
      </section>
      <section className="panel panel-pad space-y-3"><h2 className="text-lg">Details and preferences</h2><FormError message={err.profile} />
        <div className="grid gap-3 sm:grid-cols-2"><Input label="Name" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /><Input label="Department" value={p.department} onChange={(e) => setP({ ...p, department: e.target.value })} /><Input label="College" optional value={p.college} onChange={(e) => setP({ ...p, college: e.target.value })} /><Input label="Preferred pickup area" optional value={p.preferred_area} onChange={(e) => setP({ ...p, preferred_area: e.target.value })} /></div>
        <Checkbox label="Allow activation suggestions" hint="We may ask whether you would share idle gear when demand is predicted to exceed supply. You always decide." checked={p.open} onChange={(e) => setP({ ...p, open: e.target.checked })} />
        <Button loading={save.isPending} onClick={() => save.mutate()}>Save changes</Button></section>
      <section className="panel panel-pad space-y-3"><h2 className="text-lg">Change password</h2><FormError message={err.pw} />
        <div className="grid gap-3 sm:grid-cols-2"><Input label="Current password" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /><Input label="New password" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} hint="At least 8 characters with a letter and a number." /></div>
        <Button variant="secondary" loading={chpw.isPending} disabled={!pw.current || pw.next.length < 8} onClick={() => chpw.mutate()}>Change password</Button></section>
    </div>
  );
}
