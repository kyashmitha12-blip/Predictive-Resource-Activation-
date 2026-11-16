import { FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button, FormError, Input } from "@/components/ui";
import { api, errMsg } from "@/lib/api";

export default function ResetPassword() {
  const token = useSearchParams()[0].get("token") ?? "";
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return setError("Use at least 8 characters with a letter and a number.");
    setBusy(true);
    try { await api.post("/api/auth/reset-password", { token, new_password: pw }); setDone(true); }
    catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  }
  return (
    <div className="container-x grid min-h-[60vh] place-items-center py-12">
      <form onSubmit={submit} noValidate className="panel panel-pad w-full max-w-md space-y-4">
        <h1 className="text-2xl">Choose a new password</h1>
        {!token && <FormError message="This link is missing its token. Request a new reset link." />}
        <FormError message={error} />
        {done ? <p className="text-sm">Password updated. All other sessions were signed out. <Link to="/login" className="link">Sign in</Link></p> : <>
          <Input label="New password" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} hint="At least 8 characters, including a letter and a number." />
          <Button type="submit" loading={busy} disabled={!token} className="w-full">Update password</Button>
        </>}
      </form>
    </div>
  );
}
