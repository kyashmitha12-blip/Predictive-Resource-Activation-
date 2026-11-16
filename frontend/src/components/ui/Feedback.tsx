import clsx from "clsx";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { ReactNode } from "react";
import { Button } from "./Button";

export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden className={clsx("animate-pulse rounded-ctl bg-paper-2", className)} />;
export const Spinner = ({ label = "Loading" }: { label?: string }) => (
  <div role="status" className="flex items-center justify-center gap-2 py-10 text-ink-3"><Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">{label}...</span></div>
);
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return <div role="status" aria-label="Loading" className="space-y-3">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
}
export function EmptyState({ title, children, action, icon }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-panel border border-dashed border-line-2 bg-white px-6 py-12 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-paper-2 text-ink-3">{icon ?? <Inbox className="h-5 w-5" />}</div>
      <h3 className="text-base">{title}</h3>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-ink-3">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-panel border border-alert/30 bg-alert-50 px-6 py-8 text-center">
      <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-alert" />
      <p className="text-sm text-ink">{message}</p>
      {onRetry && <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>Try again</Button>}
    </div>
  );
}
