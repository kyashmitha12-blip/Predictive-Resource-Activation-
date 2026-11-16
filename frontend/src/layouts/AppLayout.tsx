import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, Bell, Boxes, CalendarCheck, ClipboardCheck, Flag, Gauge, Inbox, LayoutDashboard, LogOut, Menu, Radio, Search, ShieldCheck, Star, Truck, UserCircle, Users, X } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { NotificationBell } from "@/components/NotificationBell";
import { VerificationBanner } from "@/components/VerificationBanner";
import { Logo } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type { Activation } from "@/lib/types";

type Item = { to: string; label: string; icon: ReactNode; end?: boolean; badge?: number };
const i = "h-[18px] w-[18px]";

export function AppLayout({ mode }: { mode: "student" | "admin" }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [loc.pathname]);
  const { data: acts } = useQuery({ queryKey: ["activation-pending"], enabled: mode === "student", refetchInterval: 60_000,
    queryFn: () => api.get<Activation[]>("/api/activation/mine", { status: "pending" }) });

  const groups: { title?: string; items: Item[] }[] = mode === "student" ? [
    { items: [
      { to: "/app", label: "Dashboard", icon: <LayoutDashboard className={i} />, end: true },
      { to: "/app/browse", label: "Browse resources", icon: <Search className={i} /> },
      { to: "/app/bookings", label: "My bookings", icon: <CalendarCheck className={i} /> },
      { to: "/app/requests", label: "Incoming requests", icon: <Inbox className={i} /> },
    ] },
    { title: "Sharing", items: [
      { to: "/app/resources", label: "My resources", icon: <Boxes className={i} /> },
      { to: "/app/activation", label: "Activation requests", icon: <Radio className={i} />, badge: acts?.length },
      { to: "/app/insights", label: "Demand insights", icon: <BarChart3 className={i} /> },
      { to: "/app/reviews", label: "Reviews", icon: <Star className={i} /> },
    ] },
    { title: "Account", items: [
      { to: "/app/notifications", label: "Notifications", icon: <Bell className={i} /> },
      { to: "/app/profile", label: "Profile & verification", icon: <UserCircle className={i} /> },
    ] },
  ] : [
    { items: [{ to: "/admin", label: "Dashboard", icon: <LayoutDashboard className={i} />, end: true }] },
    { title: "Predictive activation", items: [
      { to: "/admin/forecast", label: "Demand forecast", icon: <Gauge className={i} /> },
      { to: "/admin/supply-gap", label: "Supply gap", icon: <Activity className={i} /> },
      { to: "/admin/activation", label: "Idle resources & activation", icon: <Radio className={i} /> },
    ] },
    { title: "Operations", items: [
      { to: "/admin/verifications", label: "Verification", icon: <ShieldCheck className={i} /> },
      { to: "/admin/users", label: "Users", icon: <Users className={i} /> },
      { to: "/admin/resources", label: "Resource moderation", icon: <Boxes className={i} /> },
      { to: "/admin/bookings", label: "Bookings", icon: <Truck className={i} /> },
      { to: "/admin/reports", label: "Reports & disputes", icon: <Flag className={i} /> },
      { to: "/admin/platform", label: "Analytics & audit log", icon: <ClipboardCheck className={i} /> },
    ] },
    { title: "Account", items: [{ to: "/admin/notifications", label: "Notifications", icon: <Bell className={i} /> }] },
  ];

  const sidebar = (
    <nav aria-label="Main" className="flex h-full flex-col gap-5 overflow-y-auto px-3 py-4">
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.title && <p className="mb-1.5 px-3 text-xs font-medium text-white/50">{g.title}</p>}
          <ul className="space-y-0.5">
            {g.items.map((it) => (
              <li key={it.to}>
                <NavLink to={it.to} end={it.end}
                  className={({ isActive }) => clsx("flex items-center gap-3 rounded-ctl px-3 py-2 text-sm transition-colors", isActive ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white")}>
                  {it.icon}<span className="flex-1">{it.label}</span>
                  {!!it.badge && <span className="num rounded-full bg-lamp px-1.5 text-xs font-bold text-night">{it.badge}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="mt-auto border-t border-white/10 pt-3">
        <p className="truncate px-3 text-sm text-white">{user?.name}</p>
        <p className="truncate px-3 pb-2 text-xs text-white/50">{mode === "admin" ? "Administrator" : user?.department}</p>
        <button onClick={async () => { await logout(); nav("/"); }} className="flex w-full items-center gap-3 rounded-ctl px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"><LogOut className={i} />Sign out</button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="on-night sticky top-0 hidden h-screen lg:flex lg:flex-col">
        <div className="px-5 pt-5"><Logo onNight /></div>{sidebar}
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-night/60" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="on-night absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col">
            <div className="flex items-center justify-between px-5 pt-5"><Logo onNight /><button onClick={() => setOpen(false)} aria-label="Close menu" className="text-white/70"><X className="h-5 w-5" /></button></div>{sidebar}
          </aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper px-4 sm:px-6">
          <button className="rounded-ctl p-2 text-ink-2 hover:bg-paper-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <span className="hidden text-sm text-ink-3 lg:block">{mode === "admin" ? "LEND & LOOP · Administration" : "LEND & LOOP · Student workspace"}</span>
          <div className="flex items-center gap-1"><NotificationBell to={mode === "admin" ? "/admin/notifications" : "/app/notifications"} /></div>
        </header>
        {mode === "student" && <VerificationBanner />}
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6"><Outlet /></main>
      </div>
    </div>
  );
}
