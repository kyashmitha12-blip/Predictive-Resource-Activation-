import { Pilot } from "@/components/ui";

export const FLOW = ["Predict demand", "Detect supply gap", "Identify idle resources", "Request owner activation", "Match available resources", "Book and return", "Update data", "Predict again"];

/** The closed loop as a real sequence: a vertical list on phones, a two-row track on wide screens. */
export function Flow({ onNight = false, counts }: { onNight?: boolean; counts?: Record<number, string> }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {FLOW.map((s, i) => (
        <li key={s} className={`flex items-start gap-3 rounded-panel border p-3 ${onNight ? "border-white/15 bg-night-2" : "border-line bg-white"}`}>
          <span className={`num flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${i === 3 ? "bg-lamp text-night" : onNight ? "bg-white/10 text-white" : "bg-paper-2 text-ink-2"}`}>{i + 1}</span>
          <span className="min-w-0 text-sm">
            <span className="font-medium">{s}</span>
            {counts?.[i] && <span className={`num mt-0.5 block text-xs ${onNight ? "text-white/60" : "text-ink-3"}`}>{counts[i]}</span>}
          </span>
          {i === 7 && <Pilot state="lit" className="ml-auto mt-1" />}
        </li>
      ))}
    </ol>
  );
}
