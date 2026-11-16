import clsx from "clsx";
import { ArrowDown, ArrowRight, CalendarCheck, CheckCircle2, Gauge, RefreshCcw, Search, Sparkles, TrendingUp, UserCheck } from "lucide-react";
import { ReactNode } from "react";
import { Pilot } from "@/components/ui";

const STEPS: { title: string; text: string; icon: ReactNode; consent?: boolean }[] = [
  { title: "Predict demand", text: "A forecast per category for the coming week, with an 80% range.", icon: <TrendingUp className="h-5 w-5" /> },
  { title: "Detect supply gap", text: "Predicted demand minus effective supply, counted once per resource.", icon: <Gauge className="h-5 w-5" /> },
  { title: "Identify idle resources", text: "Transparent rules: days since last use and recent utilization.", icon: <Search className="h-5 w-5" /> },
  { title: "Request owner activation", text: "The owner sees why, picks the dates, and says yes or no.", icon: <UserCheck className="h-5 w-5" />, consent: true },
  { title: "Match available resources", text: "Ranked by price, condition, reliability, area and fit, with reasons.", icon: <Sparkles className="h-5 w-5" /> },
  { title: "Book and return", text: "Overlap-safe bookings, handover, return and condition report.", icon: <CalendarCheck className="h-5 w-5" /> },
  { title: "Update data", text: "Completed bookings join the demand history.", icon: <CheckCircle2 className="h-5 w-5" /> },
  { title: "Predict again", text: "The next forecast trains on what really happened.", icon: <RefreshCcw className="h-5 w-5" /> },
];

/** The closed loop. Sequential, so the steps are numbered. Works on a dark or light surface. */
export function FlowDiagram({ onNight = false }: { onNight?: boolean }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="The predictive activation loop">
      {STEPS.map((s, i) => (
        <li key={s.title} className="relative">
          <div className={clsx("flex h-full flex-col gap-2 rounded-panel border p-4",
            onNight ? "border-white/10 bg-night-2" : "border-line bg-white",
            s.consent && (onNight ? "border-lamp/60" : "border-lamp"))}>
            <div className="flex items-center justify-between">
              <span className={clsx("flex h-9 w-9 items-center justify-center rounded-ctl", s.consent ? "bg-lamp text-night" : onNight ? "bg-white/10 text-white" : "bg-cobalt-50 text-cobalt")}>{s.icon}</span>
              <span className={clsx("num text-sm font-medium", onNight ? "text-white/50" : "text-ink-3")}>{i + 1} of 8</span>
            </div>
            <h3 className={clsx("text-base", onNight && "text-white")}>{s.title}</h3>
            <p className={clsx("text-sm", onNight ? "text-white/70" : "text-ink-2")}>{s.text}</p>
            {s.consent && <p className="mt-auto inline-flex items-center gap-1.5 pt-1 text-sm font-medium text-lamp-700"><Pilot state="pending" size={8} /><span className={onNight ? "text-lamp" : ""}>Nothing is activated without consent</span></p>}
          </div>
          {i < STEPS.length - 1 && (
            <>
              <ArrowRight aria-hidden className={clsx("absolute -right-2.5 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 rounded-full p-0.5 lg:block", (i + 1) % 4 === 0 && "lg:hidden", onNight ? "bg-night text-white/60" : "bg-paper text-ink-3")} />
              <ArrowDown aria-hidden className={clsx("mx-auto mt-1 h-4 w-4 sm:hidden", onNight ? "text-white/40" : "text-ink-3")} />
            </>
          )}
        </li>
      ))}
    </ol>
  );
}
