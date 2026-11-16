import { ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button, FormError, Input, LogoMark, PasswordInput } from "@/components/ui";
import { homeFor, useAuth } from "@/hooks/useAuth";
import { errMsg } from "@/lib/api";

/** Separate, deliberately institutional sign-in surface for administrators. Visually distinct from
 * the student /login page (dark panel, no marketing copy) so the two are never mistaken for each
 * other. The role check itself happens entirely server-side in POST /api/auth/admin-login. */
export default function AdminLogin() {
  const { adminLogin, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<{ email?: string; password?: string }>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const v: typeof fields = {};
    if (!email.trim()) v.email = "Enter the administrator email address.";
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) v.email = "Enter a valid email address.";
    if (!password) v.password = "Enter your password.";
    setFields(v);
    if (v.email || v.password) return;
    setBusy(true);
    try {
      await adminLogin(email.trim(), password);
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  }

  // Already signed in (any role): leave immediately rather than showing a login form.
  if (user) return <Navigate to={homeFor(user.role)} replace />;

  return (
    <div className="on-night flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-14 sm:px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <LogoMark size={40} onNight />
          <div className="mt-5 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-lamp" aria-hidden />
            <p className="eyebrow">Administrator access</p>
          </div>
          <h1 className="mt-2 text-3xl text-white">Administrator Login</h1>
          <p className="mt-2 text-sm text-white/70">Manage your institution's shared resources.</p>
        </div>

        <form onSubmit={submit} noValidate className="panel-night mt-8 space-y-5 p-6 sm:p-7">
          <FormError message={error} />
          <div className="[&_label]:!text-white/80">
            <Input label="Admin email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={fields.email} />
          </div>
          <div className="[&_label]:!text-white/80">
            <PasswordInput label="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fields.password} />
          </div>
          <Button type="submit" size="lg" loading={busy} className="w-full">{busy ? "Signing in…" : "Sign In"}</Button>
        </form>

        <p className="mt-6 text-center text-sm text-white/60">
          Not an administrator? <Link to="/login" className="font-medium text-white underline underline-offset-2">Back to Student Login</Link>
        </p>
      </div>
    </div>
  );
}
