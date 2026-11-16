import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ReactNode } from "react";
import { Button } from "./Button";

export function Table({ head, children, className }: { head: string[]; children: ReactNode; className?: string }) {
  return (
    <div className={clsx("overflow-x-auto rounded-panel border border-line bg-white", className)}>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-line bg-paper text-ink-2">
          <tr>{head.map((h) => <th key={h} scope="col" className="whitespace-nowrap px-4 py-2.5 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => <td className={clsx("px-4 py-3 align-top", className)}>{children}</td>;

export function Pagination({ page, pages, total, onChange }: { page: number; pages: number; total: number; onChange: (p: number) => void }) {
  if (pages <= 1) return <p className="mt-3 text-sm text-ink-3">{total} result{total === 1 ? "" : "s"}</p>;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between">
      <p className="text-sm text-ink-3">{total} results, page {page} of {pages}</p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" />Previous</Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page">Next<ChevronRight className="h-4 w-4" /></Button>
      </div>
    </nav>
  );
}
