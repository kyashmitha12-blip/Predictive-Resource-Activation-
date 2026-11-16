import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Button, FormError, Input } from "@/components/ui";
import { api, errMsg } from "@/lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<{ message: string; dev_reset_link?: string } | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email address.");
    setBusy(true);
    try { setRes(await api.post("/api/auth/forgot-password", { email: email.trim() })); }
    catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  }
  return (
    <div className="container-x grid min-h-[60vh] place-items-center py-12">
      <form onSubmit={submit} noValidate className="panel panel-pad w-full max-w-md space-y-4">
        <h1 className="text-2xl">Reset your password</h1>
        <FormError message={error} />
        {res ? (
          <div className="space-y-3 text-sm">
            <p>{res.message}</p>
            {res.dev_reset_link && <div className="rounded-ctl border border-lamp/40 bg-lamp-50 p-3"><p className="font-medium">Development mode: no email is sent.</p><a className="link break-all" href={res.dev_reset_link}>{res.dev_reset_link}</a></div>}
          </div>
        ) : <>
          <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" loading={busy} className="w-full">Send reset link</Button>
        </>}
        <Link to="/login" className="link text-sm">Back to sign in</Link>
      </form>
    </div>
  );
}
