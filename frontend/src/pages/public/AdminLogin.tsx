import { ShieldCheck, Sparkles } from "lucide-react";
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
    <div className="on-night flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16 sm:px-6 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-[600px] -translate-x-1/2 rounded-full bg-cobalt/20 blur-[120px]" />
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <LogoMark size={44} onNight />
          <div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-lamp">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            <span className="font-bold uppercase tracking-wider">Institution Portal</span>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold text-white tracking-tight sm:text-4xl">Administrator Access</h1>
          <p className="mt-2 text-sm text-white/70">Secure operations &amp; resource intelligence dashboard</p>
        </div>

        <div className="panel-night mt-8 rounded-panel-lg border border-white/10 bg-slate-900/80 backdrop-blur-xl p-7 sm:p-8 shadow-2xl">
          <form onSubmit={submit} noValidate className="space-y-5">
            <FormError message={error} />
            <div className="[&_label]:!text-white/80">
              <Input
                label="Admin email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={fields.email}
              />
            </div>
            <div className="[&_label]:!text-white/80">
              <PasswordInput
                label="Password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={fields.password}
              />
            </div>
            <Button type="submit" size="lg" loading={busy} variant="lamp" className="w-full">
              {busy ? "Authenticating…" : "Sign In to Admin Console"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-white/60">
          Not an administrator?{" "}
          <Link to="/login" className="font-semibold text-white underline underline-offset-4 hover:text-lamp transition-colors">
            Back to Student Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
