import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Bell,
  Boxes,
  CalendarCheck,
  ChevronRight,
  ClipboardCheck,
  Flag,
  Gauge,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { NotificationBell } from "@/components/NotificationBell";
import { VerificationBanner } from "@/components/VerificationBanner";
import { Logo } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type { Activation } from "@/lib/types";

type Item = { to: string; label: string; icon: ReactNode; end?: boolean; badge?: number };
const i = "h-4.5 w-4.5 shrink-0";

export function AppLayout({ mode }: { mode: "student" | "admin" }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [loc.pathname]);

  const { data: acts } = useQuery({
    queryKey: ["activation-pending"],
    enabled: mode === "student",
    refetchInterval: 60_000,
    queryFn: () => api.get<Activation[]>("/api/activation/mine", { status: "pending" }),
  });

  const groups: { title?: string; items: Item[] }[] =
    mode === "student"
      ? [
          {
            items: [
              { to: "/app", label: "Dashboard", icon: <LayoutDashboard className={i} />, end: true },
              { to: "/app/browse", label: "Browse resources", icon: <Search className={i} /> },
              { to: "/app/bookings", label: "My bookings", icon: <CalendarCheck className={i} /> },
              { to: "/app/requests", label: "Incoming requests", icon: <Inbox className={i} /> },
            ],
          },
          {
            title: "Resource Sharing",
            items: [
              { to: "/app/resources", label: "My resources", icon: <Boxes className={i} /> },
              { to: "/app/activation", label: "Activation requests", icon: <Radio className={i} />, badge: acts?.length },
              { to: "/app/insights", label: "Demand insights", icon: <BarChart3 className={i} /> },
              { to: "/app/reviews", label: "Reviews & reputation", icon: <Star className={i} /> },
            ],
          },
          {
            title: "Account",
            items: [
              { to: "/app/notifications", label: "Notifications", icon: <Bell className={i} /> },
              { to: "/app/profile", label: "Profile & verification", icon: <UserCircle className={i} /> },
            ],
          },
        ]
      : [
          {
            items: [{ to: "/admin", label: "Dashboard", icon: <LayoutDashboard className={i} />, end: true }],
          },
          {
            title: "Predictive Activation",
            items: [
              { to: "/admin/forecast", label: "Demand forecast", icon: <Gauge className={i} /> },
              { to: "/admin/supply-gap", label: "Supply gap analysis", icon: <Activity className={i} /> },
              { to: "/admin/activation", label: "Idle gear & activation", icon: <Radio className={i} /> },
            ],
          },
          {
            title: "Operations & Trust",
            items: [
              { to: "/admin/verifications", label: "Student verifications", icon: <ShieldCheck className={i} /> },
              { to: "/admin/users", label: "Campus directory", icon: <Users className={i} /> },
              { to: "/admin/resources", label: "Resource moderation", icon: <Boxes className={i} /> },
              { to: "/admin/bookings", label: "Booking ledger", icon: <Truck className={i} /> },
              { to: "/admin/reports", label: "Reports & disputes", icon: <Flag className={i} /> },
              { to: "/admin/platform", label: "Audit log & health", icon: <ClipboardCheck className={i} /> },
            ],
          },
          {
            title: "Admin",
            items: [{ to: "/admin/notifications", label: "Notifications", icon: <Bell className={i} /> }],
          },
        ];

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : "U";

  const sidebar = (
    <nav aria-label="Main" className="flex h-full flex-col justify-between overflow-y-auto px-3.5 py-4">
      <div className="space-y-6">
        {groups.map((g, gi) => (
          <div key={gi}>
            {g.title && (
              <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-white/40">
                {g.title}
              </p>
            )}
            <ul className="space-y-1">
              {g.items.map((it) => (
                <li key={it.to}>
                  <NavLink
                    to={it.to}
                    end={it.end}
                    className={({ isActive }) =>
                      clsx(
                        "group flex items-center gap-3 rounded-ctl px-3 py-2 text-sm font-medium transition-all duration-150",
                        isActive
                          ? "bg-cobalt/25 text-white font-semibold shadow-sm border border-cobalt/30"
                          : "text-white/70 hover:bg-white/10 hover:text-white"
                      )
                    }
                  >
                    {it.icon}
                    <span className="flex-1 truncate">{it.label}</span>
                    {!!it.badge && (
                      <span className="num relative flex h-5 min-w-5 items-center justify-center rounded-full bg-lamp px-1.5 text-[11px] font-extrabold text-slate-950 shadow-glow-lamp">
                        {it.badge}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-8 border-t border-white/10 pt-4">
        <div className="mb-2 flex items-center gap-3 px-3 py-2 rounded-ctl bg-white/5 border border-white/5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cobalt font-bold text-xs text-white">
            {userInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">{user?.name}</p>
            <p className="truncate text-[11px] text-white/50">{mode === "admin" ? "Campus Administrator" : user?.department || "Student"}</p>
          </div>
        </div>
        <button
          onClick={async () => {
            await logout();
            nav("/");
          }}
          className="flex w-full items-center gap-2.5 rounded-ctl px-3 py-2 text-xs font-semibold text-white/70 transition-colors hover:bg-alert/15 hover:text-alert"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[260px_1fr]">
      {/* Desktop Sidebar */}
      <aside className="on-night sticky top-0 hidden h-screen border-r border-white/10 lg:flex lg:flex-col">
        <div className="border-b border-white/10 px-5 py-4">
          <Logo onNight />
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-white/50">
            <Sparkles className="h-3 w-3 text-lamp" />
            <span>{mode === "admin" ? "Administrative Console" : "Student Hub"}</span>
          </div>
        </div>
        {sidebar}
      </aside>

      {/* Mobile Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <aside className="on-night absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-white/10 shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <Logo onNight />
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main Workspace Area */}
      <div className="min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line/80 bg-paper/90 backdrop-blur-md px-4 sm:px-6 shadow-subtle">
          <div className="flex items-center gap-3">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-ctl text-ink-2 hover:bg-paper-2 hover:text-ink lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden items-center gap-2 text-xs font-medium text-ink-3 sm:flex">
              <span className="font-bold text-ink">LEND &amp; LOOP</span>
              <ChevronRight className="h-3 w-3" />
              <span>{mode === "admin" ? "Administration" : "Student Workspace"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell to={mode === "admin" ? "/admin/notifications" : "/app/notifications"} />
          </div>
        </header>

        {mode === "student" && <VerificationBanner />}

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-7 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
