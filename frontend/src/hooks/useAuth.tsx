import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Spinner } from "@/components/ui";
import { ApiError, api, setCsrf } from "@/lib/api";
import type { Role, Session, User } from "@/lib/types";

interface RegisterBody { name: string; email: string; student_id: string; department: string; college: string; password: string }
interface Ctx {
  user: User | null; loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  adminLogin: (email: string, password: string) => Promise<User>;
  register: (b: RegisterBody) => Promise<{ user: User; dev_verification_link?: string; email_status?: string }>;
  logout: () => Promise<void>; refresh: () => Promise<void>;
}
const AuthCtx = createContext<Ctx>(null as unknown as Ctx);
export const useAuth = () => useContext(AuthCtx);
export const homeFor = (role: Role) => (role === "admin" ? "/admin" : "/app");

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["me"], staleTime: Infinity, retry: false,
    queryFn: async () => {
      try { const s = await api.get<Session>("/api/auth/me"); setCsrf(s.csrf_token); return s; }
      catch (e) { if (e instanceof ApiError && (e.status === 401 || e.status === 403)) { setCsrf(null); return null; } throw e; }
    },
  });
  const clearOthers = useCallback(() => qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" }), [qc]);
  const setSession = useCallback((s: Session | null) => { setCsrf(s?.csrf_token ?? null); qc.setQueryData(["me"], s); }, [qc]);

  useEffect(() => {
    const onExpired = () => { setSession(null); clearOthers(); };
    window.addEventListener("pra:session-expired", onExpired);
    return () => window.removeEventListener("pra:session-expired", onExpired);
  }, [qc, setSession, clearOthers]);

  const value = useMemo<Ctx>(() => ({
    user: data?.user ?? null, loading: isLoading,
    login: async (email, password) => { const s = await api.post<Session>("/api/auth/login", { email, password }); clearOthers(); setSession(s); return s.user; },
    adminLogin: async (email, password) => { const s = await api.post<Session>("/api/auth/admin-login", { email, password }); clearOthers(); setSession(s); return s.user; },
    register: async (b) => { const s = await api.post<Session & { dev_verification_link?: string; email_status?: string }>("/api/auth/register", b); clearOthers(); setSession(s); return s; },
    logout: async () => { try { await api.post("/api/auth/logout"); } finally { setSession(null); clearOthers(); } },
    refresh: async () => { await qc.invalidateQueries({ queryKey: ["me"] }); },
  }), [data, isLoading, qc, setSession, clearOthers]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

/** Route guard. The backend still enforces every permission; this only keeps people on the right pages. */
export function RequireAuth({ role, children }: { role?: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="min-h-screen bg-paper"><Spinner label="Checking your session" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (role && user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}
