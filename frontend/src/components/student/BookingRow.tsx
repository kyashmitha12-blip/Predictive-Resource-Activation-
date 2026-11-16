import { Link } from "react-router-dom";
import { DemoBadge, StatusChip } from "@/components/ui";
import { ResourceImage } from "@/components/ResourceCard";
import { dateTime, moneyPlain } from "@/lib/format";
import type { Booking } from "@/lib/types";

export function BookingRow({ b, role, actions }: { b: Booking; role: "borrower" | "owner"; actions?: React.ReactNode }) {
  return (
    <li className="panel flex flex-wrap items-center gap-4 p-4">
      <div className="h-16 w-20 shrink-0 overflow-hidden rounded-ctl"><ResourceImage src={b.resource.image_url} category={b.resource.category} name={b.resource.name} className="h-16" /></div>
      <div className="min-w-0 flex-1">
        <Link to={`/app/bookings/${b.id}`} className="font-medium hover:text-cobalt">{b.resource.name}</Link>
        <p className="text-sm text-ink-3">{dateTime(b.start_at)} to {dateTime(b.end_at)} · {role === "borrower" ? `Owner ${b.owner.name}` : `Borrower ${b.borrower.name}`}</p>
        <p className="num text-sm text-ink-2">{moneyPlain(b.rental_amount)} + deposit {moneyPlain(b.deposit_amount)} <span className="text-ink-3">(demo)</span></p>
      </div>
      <div className="flex items-center gap-2">{b.is_demo && <DemoBadge />}<StatusChip status={b.status} /></div>
      {actions && <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div>}
    </li>
  );
}
