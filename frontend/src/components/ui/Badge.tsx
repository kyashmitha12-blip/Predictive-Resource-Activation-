import clsx from "clsx";
import { ReactNode } from "react";
import { Pilot } from "./Pilot";

type Tone = "neutral" | "info" | "lamp" | "go" | "alert";
const tones: Record<Tone, string> = {
  neutral: "bg-paper-2 text-ink-2", info: "bg-cobalt-50 text-cobalt-700", lamp: "bg-lamp-50 text-lamp-700", go: "bg-go-50 text-go", alert: "bg-alert-50 text-alert",
};
export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={clsx("inline-flex items-center gap-1.5 rounded-ctl px-2 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}

const STATUS: Record<string, { tone: Tone; text: string; pilot?: "idle" | "lit" | "pending" }> = {
  requested: { tone: "lamp", text: "Requested", pilot: "pending" }, confirmed: { tone: "info", text: "Confirmed" }, active: { tone: "go", text: "Active", pilot: "lit" },
  returned: { tone: "lamp", text: "Returned, awaiting check" }, completed: { tone: "neutral", text: "Completed" }, rejected: { tone: "neutral", text: "Declined" },
  cancelled: { tone: "neutral", text: "Cancelled" }, disputed: { tone: "alert", text: "In dispute" },
  inactive: { tone: "neutral", text: "Not shared", pilot: "idle" }, maintenance: { tone: "lamp", text: "Maintenance" }, archived: { tone: "neutral", text: "Archived" }, removed: { tone: "alert", text: "Removed" },
  pending: { tone: "lamp", text: "Pending", pilot: "pending" }, accepted: { tone: "go", text: "Accepted", pilot: "lit" }, declined: { tone: "neutral", text: "Declined" },
  withdrawn: { tone: "neutral", text: "Withdrawn" }, expired: { tone: "neutral", text: "Expired" },
  approved: { tone: "go", text: "Verified" }, not_submitted: { tone: "neutral", text: "Not submitted" },
  open: { tone: "alert", text: "Open" }, resolved: { tone: "go", text: "Resolved" }, dismissed: { tone: "neutral", text: "Dismissed" },
  low: { tone: "go", text: "Low demand" }, moderate: { tone: "info", text: "Moderate demand" }, high: { tone: "lamp", text: "High demand" }, critical: { tone: "alert", text: "Critical" },
  suspended: { tone: "alert", text: "Suspended" },
};
/** For resources, pass resourceActive so "active" reads "Shared" with a lit pilot. */
export function StatusChip({ status, resourceActive }: { status: string; resourceActive?: boolean }) {
  const s = STATUS[status] ?? { tone: "neutral" as Tone, text: status };
  const pilot = status === "active" && resourceActive ? "lit" : s.pilot;
  const text = status === "active" && resourceActive ? "Shared" : s.text;
  return <Badge tone={s.tone}>{pilot && <Pilot state={pilot} size={8} />}{text}</Badge>;
}
export const DemoBadge = ({ label = "Demo data" }: { label?: string }) => <Badge tone="lamp" className="border border-lamp/40">{label}</Badge>;
