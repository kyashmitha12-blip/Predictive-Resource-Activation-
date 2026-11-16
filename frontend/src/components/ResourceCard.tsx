import { MapPin, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Pilot } from "@/components/ui";
import { CategoryIcon } from "@/lib/categories";
import { money } from "@/lib/format";
import type { Resource } from "@/lib/types";

export function ResourceImage({ src, category, name, className = "h-40" }: { src?: string | null; category: string; name: string; className?: string }) {
  if (src) return <img src={src} alt={name} loading="lazy" className={`${className} w-full object-cover`} />;
  return (
    <div className={`${className} flex w-full items-center justify-center bg-paper-2 text-ink-3`} role="img" aria-label={`${name} (no photo yet)`}>
      <CategoryIcon category={category} className="h-10 w-10" />
    </div>
  );
}

export function ResourceCard({ r, to, score }: { r: Resource; to: string; score?: number }) {
  const rating = r.owner.stats?.average_rating;
  return (
    <Link to={to} className="group flex flex-col overflow-hidden rounded-panel border border-line bg-white transition-shadow hover:shadow-lift">
      <div className="relative">
        <ResourceImage src={r.images[0]?.url} category={r.category} name={r.name} />
        {r.newly_activated && <span className="absolute left-2 top-2"><Badge tone="lamp" className="bg-white/95"><Pilot state="lit" size={8} />Newly shared</Badge></span>}
        {score != null && <span className="num absolute right-2 top-2 rounded-ctl bg-night px-2 py-0.5 text-xs font-semibold text-white">{score}% match</span>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <p className="text-xs text-ink-3">{r.category_label}</p>
          <h3 className="line-clamp-1 text-base group-hover:text-cobalt">{r.name}</h3>
        </div>
        <div className="flex items-center gap-3 text-sm text-ink-2">
          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden />{r.pickup_area || "Area not set"}</span>
          <span className="capitalize">{r.condition}</span>
        </div>
        <div className="mt-auto flex items-end justify-between pt-1">
          <p className="num font-display text-lg font-semibold">{money(r.price_per_day)}<span className="ml-1 font-sans text-xs font-normal text-ink-3">{r.price_per_day ? "per day" : ""}</span></p>
          <p className="flex items-center gap-1 text-sm text-ink-2">
            {rating != null ? <><Star className="h-3.5 w-3.5 fill-lamp text-lamp" aria-hidden /><span className="num">{rating.toFixed(1)}</span></> : <span className="text-ink-3">No reviews yet</span>}
          </p>
        </div>
      </div>
    </Link>
  );
}
