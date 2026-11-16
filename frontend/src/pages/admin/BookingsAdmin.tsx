import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DemoBadge, EmptyState, ErrorState, Input, ListSkeleton, PageHeader, Pagination, Select, StatusChip, Table, Td } from "@/components/ui";
import { api, errMsg } from "@/lib/api";
import { dateTime, label, moneyPlain } from "@/lib/format";
import type { Booking, Page } from "@/lib/types";

export default function BookingsAdmin() {
  const [f, setF] = useState({ q: "", status: "" });
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["admin", "bookings", f, page], queryFn: () => api.get<Page<Booking>>("/api/admin/bookings", { ...f, page }) });
  return (
    <div>
      <PageHeader title="Bookings" subtitle="Every booking on the platform. Payments and deposits are DEMO values." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2"><Input label="Search by resource" value={f.q} onChange={(e) => { setF({ ...f, q: e.target.value }); setPage(1); }} />
        <Select label="Status" value={f.status} onChange={(e) => { setF({ ...f, status: e.target.value }); setPage(1); }}><option value="">Any</option>{["requested", "confirmed", "active", "returned", "completed", "rejected", "cancelled", "disputed"].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select></div>
      {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} /> : !q.data!.items.length ? <EmptyState title="No bookings match" /> : <>
        <Table head={["#", "Resource", "Borrower", "Owner", "Period", "Amount (demo)", "Status"]}>{q.data!.items.map((b) => (
          <tr key={b.id}><Td className="num">{b.id}</Td><Td className="font-medium">{b.resource.name} {b.is_demo && <DemoBadge />}</Td><Td>{b.borrower.name}</Td><Td>{b.owner.name}</Td><Td className="whitespace-nowrap">{dateTime(b.start_at)} to {dateTime(b.end_at)}</Td><Td className="num">{moneyPlain(b.rental_amount)} + {moneyPlain(b.deposit_amount)}</Td><Td><StatusChip status={b.status} /></Td></tr>))}</Table>
        <Pagination page={q.data!.page} pages={q.data!.pages} total={q.data!.total} onChange={setPage} /></>}
    </div>
  );
}
