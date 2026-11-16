import { ReactNode, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend as RLegend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Chart colours, validated with the dataviz validator (light on white, dark on the night panel). */
export const VIZ = {
  light: { supply: "#2F6B52", demand: "#C4622D", real: "#2F6B52", demo: "#8C958B", grid: "#E5E0D5", axis: "#5E695F", text: "#292D29", surface: "#FFFFFF" },
  night: { supply: "#8FC7A8", demand: "#E8905C", real: "#8FC7A8", demo: "#A3B0A5", grid: "rgba(255,255,255,0.12)", axis: "#C9D3CB", text: "#FFFFFF", surface: "#2E4A3E" },
};
type Mode = keyof typeof VIZ;

export function LegendRow({ items, night }: { items: { label: string; color: string; shape?: "square" | "line" | "diamond" }[]; night?: boolean }) {
  return (
    <ul className={`mb-2 flex flex-wrap gap-x-5 gap-y-1 text-sm ${night ? "text-white/80" : "text-ink-2"}`} aria-label="Legend">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-2">
          <span aria-hidden className={i.shape === "line" ? "h-0.5 w-4" : i.shape === "diamond" ? "h-2.5 w-2.5 rotate-45" : "h-3 w-3 rounded-[2px]"} style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function Tip({ active, payload, label, night, fmt }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className={`rounded-ctl border px-3 py-2 text-sm shadow-lift ${night ? "border-white/20 bg-night text-white" : "border-line bg-white text-ink"}`}>
      <p className="mb-1 font-medium">{fmt ? fmt(label) : label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="num flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-[2px]" style={{ background: p.color ?? p.fill }} />
          {p.name}: <b>{typeof p.value === "number" ? Math.round(p.value * 10) / 10 : p.value}</b>
        </p>
      ))}
    </div>
  );
}

/** "Show as table" so every chart has a non-visual equivalent. */
export function TableView({ head, rows, night }: { head: string[]; rows: (string | number)[][]; night?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className={`text-sm underline underline-offset-2 ${night ? "text-white/70 hover:text-white" : "text-ink-3 hover:text-ink"}`}>
        {open ? "Hide table view" : "Show as table"}
      </button>
      {open && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead><tr>{head.map((h) => <th key={h} scope="col" className={`py-1 pr-4 font-medium ${night ? "text-white/70" : "text-ink-2"}`}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i} className={`border-t ${night ? "border-white/10" : "border-line"}`}>{r.map((c, j) => <td key={j} className="num py-1 pr-4">{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Horizontal grouped bars: predicted demand (amber) vs effective supply (cobalt) per category. */
export function DemandSupplyChart({ data, mode = "light" }: { data: { label: string; demand: number; supply: number }[]; mode?: Mode }) {
  const c = VIZ[mode];
  const night = mode === "night";
  const h = 48 + data.length * 54;
  return (
    <figure aria-label="Predicted demand compared with effective supply by category">
      <LegendRow night={night} items={[{ label: "Predicted demand", color: c.demand }, { label: "Effective supply", color: c.supply }]} />
      <div style={{ height: h }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 36, top: 4, bottom: 4 }} barCategoryGap={14} barGap={2}>
            <CartesianGrid horizontal={false} stroke={c.grid} />
            <XAxis type="number" stroke={c.axis} tick={{ fill: c.axis, fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="label" width={118} stroke={c.axis} tick={{ fill: c.text, fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: night ? "rgba(255,255,255,0.06)" : "rgba(20,28,46,0.05)" }} content={<Tip night={night} />} />
            <Bar dataKey="demand" name="Predicted demand" fill={c.demand} radius={[0, 4, 4, 0]} barSize={14} label={{ position: "right", fill: c.text, fontSize: 12 }} isAnimationActive={false} />
            <Bar dataKey="supply" name="Effective supply" fill={c.supply} radius={[0, 4, 4, 0]} barSize={14} label={{ position: "right", fill: c.text, fontSize: 12 }} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableView night={night} head={["Category", "Predicted demand", "Effective supply"]} rows={data.map((d) => [d.label, d.demand, d.supply])} />
    </figure>
  );
}

/** Weekly bookings line for one category; event weeks are marked with diamonds (shape, not colour alone). */
export function HistoryChart({ data, mode = "night", name }: { data: { week_start: string; bookings: number; event: boolean }[]; mode?: Mode; name: string }) {
  const c = VIZ[mode];
  const night = mode === "night";
  const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const dot = (p: any) => p.payload.event
    ? <rect key={p.index} x={p.cx - 5} y={p.cy - 5} width={10} height={10} transform={`rotate(45 ${p.cx} ${p.cy})`} fill={c.demand} stroke={c.surface} strokeWidth={2} />
    : <g key={p.index} />;
  return (
    <figure aria-label={`Weekly bookings for ${name}`}>
      <LegendRow night={night} items={[{ label: `${name}: weekly bookings`, color: c.supply, shape: "line" }, { label: "Event week", color: c.demand, shape: "diamond" }]} />
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: -12, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis dataKey="week_start" tickFormatter={fmt} stroke={c.axis} tick={{ fill: c.axis, fontSize: 12 }} tickLine={false} minTickGap={32} />
            <YAxis stroke={c.axis} tick={{ fill: c.axis, fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<Tip night={night} fmt={fmt} />} />
            <Line type="monotone" dataKey="bookings" name="Bookings" stroke={c.supply} strokeWidth={2} dot={dot as any} activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <TableView night={night} head={["Week starting", "Bookings", "Event week"]} rows={data.slice(-12).map((d) => [fmt(d.week_start), d.bookings, d.event ? "Yes" : "No"])} />
    </figure>
  );
}

/** 30-day booking requests, real vs seeded demo, stacked with a 2px gap between segments. */
export function ActivityChart({ data }: { data: { date: string; real: number; demo: number }[] }) {
  const c = VIZ.light;
  const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return (
    <figure aria-label="Booking requests created per day, real and demo">
      <LegendRow items={[{ label: "Real bookings", color: c.real }, { label: "Seeded demo bookings", color: c.demo }]} />
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: -16, right: 4, top: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis dataKey="date" tickFormatter={fmt} stroke={c.axis} tick={{ fill: c.axis, fontSize: 12 }} tickLine={false} minTickGap={24} />
            <YAxis stroke={c.axis} tick={{ fill: c.axis, fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip cursor={{ fill: "rgba(20,28,46,0.05)" }} content={<Tip fmt={fmt} />} />
            <Bar dataKey="real" name="Real bookings" stackId="a" fill={c.real} stroke="#fff" strokeWidth={1} isAnimationActive={false} />
            <Bar dataKey="demo" name="Seeded demo bookings" stackId="a" fill={c.demo} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableView head={["Date", "Real", "Demo"]} rows={data.slice(-10).map((d) => [fmt(d.date), d.real, d.demo])} />
    </figure>
  );
}

export function Card({ title, subtitle, children, night, actions, className = "" }: { title: string; subtitle?: ReactNode; children: ReactNode; night?: boolean; actions?: ReactNode; className?: string }) {
  return (
    <section className={`${night ? "panel-night" : "panel"} p-5 ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg">{title}</h2>
          {subtitle && <p className={`mt-0.5 text-sm ${night ? "text-white/65" : "text-ink-3"}`}>{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export const catLabel = (c: string) => c.replace(/_/g, " ").replace(/^\w/, (x) => x.toUpperCase());
