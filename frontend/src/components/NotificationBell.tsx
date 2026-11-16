import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";

export function NotificationBell({ to }: { to: string }) {
  const { data } = useQuery({ queryKey: ["unread"], queryFn: () => api.get<{ count: number }>("/api/notifications/unread-count"), refetchInterval: 30_000 });
  const n = data?.count ?? 0;
  return (
    <Link
      to={to}
      aria-label={n ? `Notifications, ${n} unread` : "Notifications"}
      className="relative flex h-9 w-9 items-center justify-center rounded-ctl text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink focus-visible:outline-cobalt"
    >
      <Bell className="h-4.5 w-4.5" />
      {n > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lamp opacity-60" />
          <span className="num relative flex h-4 min-w-4 items-center justify-center rounded-full bg-lamp px-1 text-[10px] font-bold text-slate-950 shadow-sm">
            {n > 9 ? "9+" : n}
          </span>
        </span>
      )}
    </Link>
  );
}
