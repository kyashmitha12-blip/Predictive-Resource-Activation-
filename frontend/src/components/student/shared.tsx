import { ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { Button, DemoBadge, Dialog, FormError, StatusChip, Textarea } from "@/components/ui";
import { ResourceImage } from "@/components/ResourceCard";
import { dateTime, moneyPlain } from "@/lib/format";
import type { Booking } from "@/lib/types";

export const BOOKING_TABS: { key: string; label: string; status?: string }[] = [
  { key: "all", label: "All" },
  { key: "requested", label: "Requested", status: "requested" },
  { key: "confirmed", label: "Confirmed", status: "confirmed" },
  { key: "active", label: "Active", status: "active" },
  { key: "returned", label: "Awaiting check", status: "returned" },
  { key: "completed", label: "Completed", status: "completed" },
  { key: "closed", label: "Cancelled or declined", status: "cancelled,rejected" },
  { key: "disputed", label: "In dispute", status: "disputed" },
];

export function Tabs({ tabs, value, onChange, label }: { tabs: { key: string; label: string }[]; value: string; onChange: (k: string) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={value === t.key} onClick={() => onChange(t.key)}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm ${value === t.key ? "border-cobalt font-semibold text-ink" : "border-transparent text-ink-3 hover:text-ink"}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, hint, children, action }: { title: string; hint?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="panel panel-pad">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div><h2 className="text-lg">{title}</h2>{hint && <p className="mt-0.5 text-sm text-ink-3">{hint}</p>}</div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function BookingRow({ b, perspective, actions }: { b: Booking; perspective: "borrower" | "owner"; actions?: ReactNode }) {
  const other = perspective === "borrower" ? b.owner : b.borrower;
  return (
    <article className="panel flex flex-col gap-3 p-4 sm:flex-row">
      <div className="w-full shrink-0 overflow-hidden rounded-ctl sm:w-28">
        <ResourceImage src={b.resource.image_url} category={b.resource.category} name={b.resource.name} className="h-24" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/app/bookings/${b.id}`} className="font-display text-base font-semibold hover:text-cobalt">{b.resource.name}</Link>
          <StatusChip status={b.status} />
          {b.is_demo && <DemoBadge />}
        </div>
        <p className="mt-1 text-sm text-ink-2">{dateTime(b.start_at)} to {dateTime(b.end_at)}</p>
        <p className="text-sm text-ink-3">{perspective === "borrower" ? "Owner" : "Borrower"}: {other.name} · Pickup: {b.resource.pickup_area || "not set"}</p>
        <p className="num mt-1 text-sm text-ink-2">Rental {b.rental_amount ? moneyPlain(b.rental_amount) : "free"}{b.deposit_amount ? ` · deposit ${moneyPlain(b.deposit_amount)}` : ""} <span className="text-ink-3">(demo)</span></p>
        {b.note && <p className="mt-1 line-clamp-2 text-sm text-ink-3">“{b.note}”</p>}
      </div>
      <div className="flex flex-wrap items-start gap-2 sm:flex-col sm:items-stretch">{actions ?? <Link to={`/app/bookings/${b.id}`} className="link text-sm">View details</Link>}</div>
    </article>
  );
}

export function ReasonDialog({ open, onClose, title, label, hint, confirmLabel, danger, minLength = 0, required = false, loading, error, onSubmit }: {
  open: boolean; onClose: () => void; title: string; label: string; hint?: string; confirmLabel: string; danger?: boolean;
  minLength?: number; required?: boolean; loading?: boolean; error?: string | null; onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);
  const bad = (required || minLength > 0) && text.trim().length < Math.max(minLength, required ? 1 : 0);
  const msg = touched && bad ? (minLength ? `Please write at least ${minLength} characters.` : "This field is required.") : null;
  return (
    <Dialog open={open} onClose={() => { setTouched(false); onClose(); }} title={title}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? "danger" : "primary"} loading={loading} onClick={() => { setTouched(true); if (!bad) onSubmit(text.trim()); }}>{confirmLabel}</Button>
      </>}>
      <div className="space-y-3">
        <Textarea label={label} hint={hint} value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} error={msg} optional={!required && !minLength} />
        <FormError message={error} />
      </div>
    </Dialog>
  );
}

export function ReviewDialog({ open, onClose, loading, error, onSubmit }: { open: boolean; onClose: () => void; loading?: boolean; error?: string | null; onSubmit: (rating: number, comment: string) => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  return (
    <Dialog open={open} onClose={onClose} title="Leave a review"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={loading} onClick={() => onSubmit(rating, comment.trim())}>Submit review</Button></>}>
      <div className="space-y-3">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Rating</legend>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-ctl border text-sm font-medium ${rating === n ? "border-cobalt bg-cobalt text-white" : "border-line-2 bg-white hover:bg-paper-2"}`}>
                <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="sr-only" />{n}
              </label>
            ))}
          </div>
          <p className="mt-1 text-sm text-ink-3">1 is poor, 5 is excellent.</p>
        </fieldset>
        <Textarea label="Comment" optional value={comment} maxLength={1000} onChange={(e) => setComment(e.target.value)} hint="Be specific and fair. Reviews are public to other students." />
        <FormError message={error} />
      </div>
    </Dialog>
  );
}

export const initials = (n: string) => n.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
