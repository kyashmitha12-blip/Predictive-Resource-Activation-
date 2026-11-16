import { ChevronRight } from "lucide-react";
import { ReactNode } from "react";
import { Link } from "react-router-dom";

export function PageHeader({ title, subtitle, actions, crumbs }: { title: string; subtitle?: ReactNode; actions?: ReactNode; crumbs?: { to?: string; label: string }[] }) {
  return (
    <header className="mb-7">
      {crumbs && (
        <nav aria-label="Breadcrumb" className="mb-2.5 flex flex-wrap items-center gap-1.5 text-xs font-medium text-ink-3">
          {crumbs.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              {c.to ? (
                <Link to={c.to} className="rounded-md px-1.5 py-0.5 transition-colors hover:bg-paper-2 hover:text-ink">
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page" className="rounded-md bg-paper-2 px-1.5 py-0.5 text-ink-2 font-semibold">
                  {c.label}
                </span>
              )}
              {i < crumbs.length - 1 && <ChevronRight className="h-3 w-3 text-ink-3/60" aria-hidden />}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-2xl text-sm sm:text-base text-ink-2 leading-relaxed">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
      </div>
    </header>
  );
}
