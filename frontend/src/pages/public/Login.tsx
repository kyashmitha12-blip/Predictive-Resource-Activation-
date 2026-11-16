import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { AuthShell } from "@/components/public/AuthShell";
import { Button, FormError, Input, PasswordInput } from "@/components/ui";
import { homeFor, useAuth } from "@/hooks/useAuth";
import { errMsg } from "@/lib/api";

export default function Login() {
  const { login, user } = useAuth();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<{ email?: string; password?: string }>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return; // prevent duplicate submissions
    setError(null);
    const v: typeof fields = {};
    if (!email.trim()) v.email = "Enter your email address.";
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) v.email = "Enter a valid email address.";
    if (!password) v.password = "Enter your password.";
    setFields(v);
    if (v.email || v.password) return;
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  }
  // Redirect as soon as a session exists (after sign-in, or if the visitor is already signed in).
  if (user) return <Navigate to={from && user.role === "student" && from.startsWith("/app") ? from : homeFor(user.role)} replace />;
  return (
    <AuthShell eyebrow="Welcome back" title="Login to LEND & LOOP" subtitle="Use the college email you registered with."
      footer={<div className="space-y-2">
        <p>New to LEND &amp; LOOP? <Link to="/register" className="link font-medium">Create an account</Link></p>
        <p>Administrator? <Link to="/admin/login" className="link font-medium">Sign in here</Link></p>
      </div>}>
      <form onSubmit={submit} noValidate className="space-y-5">
        <FormError message={error} />
        <Input label="College email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={fields.email} />
        <PasswordInput label="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fields.password} />
        <div className="flex justify-end text-sm"><Link to="/forgot-password" className="link">Forgot password?</Link></div>
        <Button type="submit" size="lg" loading={busy} className="w-full">{busy ? "Signing in…" : "Login"}</Button>
      </form>
    </AuthShell>
  );
}
