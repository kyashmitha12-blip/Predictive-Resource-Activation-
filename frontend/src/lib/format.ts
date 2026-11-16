const tz = "Asia/Kolkata";
export const money = (n: number | null | undefined) => (n == null ? "-" : n === 0 ? "Free" : `₹${Math.round(n).toLocaleString("en-IN")}`);
export const moneyPlain = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: tz }) : "-";
export const dateOnly = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? iso + "T00:00:00" : iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "-";
export const shortDate = (iso: string) => new Date(iso.length === 10 ? iso + "T00:00:00" : iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
export function ago(iso: string | null | undefined) {
  if (!iso) return "never";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 45) return `${Math.round(s / 86400)} days ago`;
  return dateOnly(iso);
}
/** <input type="datetime-local"> value (local time) -> ISO string with offset. */
export const localToISO = (v: string) => new Date(v).toISOString();
/** ISO -> value for datetime-local inputs in the browser's local time. */
export function isoToLocal(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export const plusHours = (h: number) => isoToLocal(new Date(Date.now() + h * 3600_000).toISOString());
export const label = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
export const pct = (x: number | null | undefined) => (x == null ? "-" : `${Math.round(x * 100)}%`);
