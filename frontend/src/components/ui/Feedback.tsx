import clsx from "clsx";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { ReactNode } from "react";
import { Button } from "./Button";

export const Skeleton = ({ className }: { className?: string }) => (
  <div aria-hidden className={clsx("animate-pulse rounded-ctl bg-paper-2/80", className)} />
);

export const Spinner = ({ label = "Loading" }: { label?: string }) => (
  <div role="status" className="flex items-center justify-center gap-2.5 py-12 text-ink-3">
    <Loader2 className="h-5 w-5 animate-spin text-cobalt" />
    <span className="text-sm font-medium">{label}...</span>
  </div>
);

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ title, children, action, icon }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-panel border border-dashed border-line bg-white/60 backdrop-blur-sm px-6 py-14 text-center shadow-subtle">
      <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-paper-2 text-cobalt shadow-subtle">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {children && <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-2 leading-relaxed">{children}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-panel border border-alert/25 bg-alert-50/60 backdrop-blur-sm px-6 py-8 text-center shadow-subtle">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-alert-50 text-alert shadow-subtle">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-ink">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
