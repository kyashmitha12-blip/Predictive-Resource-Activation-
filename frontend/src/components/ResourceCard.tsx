import { MapPin, Sparkles, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Pilot } from "@/components/ui";
import { CategoryIcon } from "@/lib/categories";
import { money } from "@/lib/format";
import type { Resource } from "@/lib/types";

export function ResourceImage({ src, category, name, className = "h-44" }: { src?: string | null; category: string; name: string; className?: string }) {
  if (src) {
    return (
      <div className={`overflow-hidden ${className} w-full bg-paper-2`}>
        <img
          src={src}
          alt={name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />
      </div>
    );
  }
  return (
    <div
      className={`${className} flex w-full items-center justify-center bg-gradient-to-br from-paper-2 to-paper text-ink-3 transition-colors group-hover:from-cobalt-50 group-hover:to-paper-2 group-hover:text-cobalt`}
      role="img"
      aria-label={`${name} (no photo yet)`}
    >
      <CategoryIcon category={category} className="h-10 w-10 transition-transform duration-300 group-hover:scale-110" />
    </div>
  );
}

export function ResourceCard({ r, to, score }: { r: Resource; to: string; score?: number }) {
  const rating = r.owner?.stats?.average_rating;
  return (
    <Link
      to={to}
      className="group flex flex-col overflow-hidden rounded-panel border border-line bg-white shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-cobalt/30 hover:shadow-lift"
    >
      <div className="relative overflow-hidden">
        <ResourceImage src={r.images?.[0]?.url} category={r.category} name={r.name} />
        {r.newly_activated && (
          <span className="absolute left-2.5 top-2.5">
            <Badge tone="lamp" className="border-0 bg-white/95 backdrop-blur-md shadow-sm">
              <Pilot state="lit" size={8} />Newly shared
            </Badge>
          </span>
        )}
        {score != null && (
          <span className="num absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-night/90 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-white shadow-sm">
            <Sparkles className="h-3 w-3 text-lamp" />
            {score}% match
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-between gap-3 p-4 sm:p-5">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-cobalt">{r.category_label}</span>
          <h3 className="line-clamp-1 mt-0.5 text-base font-bold text-ink transition-colors group-hover:text-cobalt">
            {r.name}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-ink-2">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-ink-3" aria-hidden />
            {r.pickup_area || "Campus"}
          </span>
          <span className="rounded bg-paper-2 px-1.5 py-0.5 font-medium capitalize text-ink-2">
            {r.condition}
          </span>
        </div>
        <div className="flex items-end justify-between border-t border-line/70 pt-3">
          <div>
            <p className="num font-display text-lg font-extrabold text-ink">
              {money(r.price_per_day)}
              <span className="ml-1 font-sans text-xs font-normal text-ink-3">
                {r.price_per_day ? "/day" : ""}
              </span>
            </p>
          </div>
          <p className="flex items-center gap-1 text-xs font-semibold text-ink-2">
            {rating != null ? (
              <>
                <Star className="h-3.5 w-3.5 fill-lamp text-lamp" aria-hidden />
                <span className="num">{rating.toFixed(1)}</span>
              </>
            ) : (
              <span className="text-ink-3 font-normal">New</span>
            )}
          </p>
        </div>
      </div>
    </Link>
  );
}
