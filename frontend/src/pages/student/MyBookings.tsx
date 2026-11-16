import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BookingRow } from "@/components/student/BookingRow";
import { EmptyState, ErrorState, LinkButton, ListSkeleton, PageHeader, Pagination } from "@/components/ui";
import { api, errMsg } from "@/lib/api";
import type { Booking, Page } from "@/lib/types";

const TABS = [["", "All"], ["requested", "Requested"], ["confirmed,active", "Upcoming and active"], ["returned,disputed", "Needs attention"], ["completed", "Completed"], ["cancelled,rejected", "Closed"]];

export default function MyBookings() {
  const [tab, setTab] = useState("");
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["bookings", "mine", tab, page], queryFn: () => api.get<Page<Booking>>("/api/bookings/mine", { status: tab, page }) });
  return (
    <div>
      <PageHeader title="My bookings" subtitle="Everything you have borrowed or asked to borrow." />
      <div role="tablist" aria-label="Filter by status" className="mb-4 flex flex-wrap gap-2">
        {TABS.map(([v, l]) => <button key={v} role="tab" aria-selected={tab === v} onClick={() => { setTab(v); setPage(1); }} className={`rounded-ctl px-3 py-1.5 text-sm ${tab === v ? "bg-night text-white" : "bg-white text-ink-2 border border-line hover:bg-paper-2"}`}>{l}</button>)}
      </div>
      {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} /> :
        !q.data!.items.length ? <EmptyState title="No bookings here" action={<LinkButton to="/app/browse">Browse resources</LinkButton>}>Find equipment and request it for the dates you need.</EmptyState> : <>
          <ul className="space-y-3">{q.data!.items.map((b) => <BookingRow key={b.id} b={b} role="borrower" />)}</ul>
          <Pagination page={q.data!.page} pages={q.data!.pages} total={q.data!.total} onChange={setPage} />
        </>}
    </div>
  );
}
