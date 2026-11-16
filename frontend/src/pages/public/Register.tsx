import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { AuthShell } from "@/components/public/AuthShell";
import { Button, FormError, Input, LinkButton, PasswordInput } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { ApiError, errMsg } from "@/lib/api";

const empty = { name: "", email: "", student_id: "", department: "", college: "", password: "", confirm: "" };

export default function Register() {
  const { register } = useAuth();
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ link?: string; status?: string } | null>(null);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  function validate() {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 2) e.name = "Enter your full name.";
    if (!f.email.trim()) e.email = "Enter your college email.";
    else if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Enter a valid email address, like name@college.edu.";
    if (!f.student_id.trim()) e.student_id = "Enter your student or register ID.";
    else if (!/^[A-Za-z0-9\-_/]{3,40}$/.test(f.student_id.trim())) e.student_id = "Use 3 to 40 letters, numbers, dashes or slashes.";
    if (f.department.trim().length < 2) e.department = "Enter your department.";
    if (f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) e.password = "Use at least 8 characters with a letter and a number.";
    if (!f.confirm) e.confirm = "Re-enter your password.";
    else if (f.confirm !== f.password) e.confirm = "The passwords do not match.";
    return e;
  }
  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (busy) return; // prevent duplicate submissions
    setError(null);
    const e = validate();
    setFields(e);
    if (Object.keys(e).length) { setError("Please fix the highlighted fields."); return; }
    setBusy(true);
    try {
      const { confirm: _c, ...payload } = f; // confirmation is checked here only; the API has no such field
      const r = await register({ ...payload, student_id: payload.student_id.trim(), name: payload.name.trim(), email: payload.email.trim(), department: payload.department.trim(), college: payload.college.trim() });
      setDone({ link: r.dev_verification_link, status: r.email_status });
    } catch (err) {
      if (err instanceof ApiError && err.fields?.length) setFields(Object.fromEntries(err.fields.map((x) => [x.field, x.message])));
      setError(errMsg(err));
    } finally { setBusy(false); }
  }

  if (done) {
    return (
      <AuthShell eyebrow="You're in" title="Account created" subtitle="One more step before you can list or book.">
        <div className="space-y-5">
          <ol className="space-y-3 text-ink-2">
            <li className="flex gap-3"><span className="num font-display font-extrabold text-lamp">1</span>Confirm your email address.</li>
            <li className="flex gap-3"><span className="num font-display font-extrabold text-lamp">2</span>Submit your student details under Profile so an administrator can verify you.</li>
          </ol>
          <p className="text-sm text-ink-3">Until you are verified you can browse but not list or book.</p>
          {done.link ? (
            <div role="note" className="rounded-ctl border border-lamp/40 bg-lamp-50 p-3 text-sm">
              <p className="font-semibold text-lamp-700">Development mode: no email was sent.</p>
              <p className="mt-1 text-ink-2">Use this link to confirm your email: <a className="link break-all" href={done.link}>{done.link}</a></p>
            </div>
          ) : done.status === "not_configured" ? (
            <p role="note" className="rounded-ctl border border-alert/30 bg-alert-50 p-3 text-sm text-alert">Email delivery is not set up on this server, so no verification email was sent. Please contact an administrator.</p>
          ) : <p className="text-sm text-ink-2">A verification email was requested. If it does not arrive, you can resend it from your dashboard.</p>}
          <LinkButton to="/app" size="lg" className="w-full">Go to my workspace</LinkButton>
        </div>
      </AuthShell>
    );
  }
  return (
    <AuthShell eyebrow="Get started" title="Create your account" subtitle="For students with a college email. It takes about a minute."
      footer={<>Already registered? <Link to="/login" className="link font-medium">Login</Link></>}>
      <form onSubmit={submit} noValidate className="space-y-5">
        <FormError message={error} />
        <fieldset className="space-y-4"><legend className="mb-1 font-display text-sm font-bold">About you</legend>
          <Input label="Full name" autoComplete="name" value={f.name} onChange={set("name")} error={fields.name} />
          <Input label="College email" type="email" autoComplete="email" inputMode="email" value={f.email} onChange={set("email")} error={fields.email} />
        </fieldset>
        <fieldset className="space-y-4"><legend className="mb-1 font-display text-sm font-bold">Your campus</legend>
          <Input label="Department" placeholder="e.g. Computer Science and Engineering" autoComplete="organization-title" value={f.department} onChange={set("department")} error={fields.department} />
          <Input label="Institution" optional placeholder="e.g. Rajalakshmi Institute of Technology" autoComplete="organization" value={f.college} onChange={set("college")} error={fields.college} />
          <Input label="Student / register ID" value={f.student_id} onChange={set("student_id")} error={fields.student_id} />
        </fieldset>
        <fieldset className="space-y-4"><legend className="mb-1 font-display text-sm font-bold">Security</legend>
          <PasswordInput label="Password" autoComplete="new-password" value={f.password} onChange={set("password")} error={fields.password} hint="At least 8 characters, including a letter and a number." />
          <PasswordInput label="Confirm password" autoComplete="new-password" value={f.confirm} onChange={set("confirm")} error={fields.confirm} />
        </fieldset>
        <Button type="submit" size="lg" loading={busy} className="w-full">{busy ? "Creating account…" : "Create account"}</Button>
        <p className="text-xs text-ink-3">By creating an account you agree to the <Link to="/terms" className="link">Terms</Link> and <Link to="/privacy" className="link">Privacy</Link> notice.</p>
      </form>
    </AuthShell>
  );
}
