import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";

export function NotificationBell({ to }: { to: string }) {
  const { data } = useQuery({ queryKey: ["unread"], queryFn: () => api.get<{ count: number }>("/api/notifications/unread-count"), refetchInterval: 30_000 });
  const n = data?.count ?? 0;
  return (
    <Link to={to} aria-label={n ? `Notifications, ${n} unread` : "Notifications"} className="relative rounded-ctl p-2 text-ink-2 hover:bg-paper-2 hover:text-ink">
      <Bell className="h-5 w-5" />
      {n > 0 && <span className="num absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-lamp px-1 text-[10px] font-bold text-night">{n > 9 ? "9+" : n}</span>}
    </Link>
  );
}
