import { Link } from "react-router-dom";
import { DemoBadge, StatusChip } from "@/components/ui";
import { ResourceImage } from "@/components/ResourceCard";
import { dateTime, moneyPlain } from "@/lib/format";
import type { Booking } from "@/lib/types";

export function BookingRow({ b, role, actions }: { b: Booking; role: "borrower" | "owner"; actions?: React.ReactNode }) {
  return (
    <li className="panel flex flex-wrap items-center gap-4 p-4 sm:p-5 transition-all duration-200 hover:shadow-lift">
      <div className="h-16 w-20 shrink-0 overflow-hidden rounded-ctl shadow-subtle">
        <ResourceImage src={b.resource.image_url} category={b.resource.category} name={b.resource.name} className="h-16" />
      </div>
      <div className="min-w-0 flex-1">
        <Link to={`/app/bookings/${b.id}`} className="font-bold text-ink transition-colors hover:text-cobalt">
          {b.resource.name}
        </Link>
        <p className="mt-0.5 text-xs text-ink-3">
          {dateTime(b.start_at)} → {dateTime(b.end_at)} · {role === "borrower" ? `Owner: ${b.owner.name}` : `Borrower: ${b.borrower.name}`}
        </p>
        <p className="num mt-1 text-xs font-semibold text-ink-2">
          {moneyPlain(b.rental_amount)} <span className="font-normal text-ink-3">+ deposit {moneyPlain(b.deposit_amount)} (demo)</span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        {b.is_demo && <DemoBadge />}
        <StatusChip status={b.status} />
      </div>
      {actions && <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div>}
    </li>
  );
}
