import { ReactNode } from "react";
import { Badge } from "@/components/ui";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="container-x max-w-3xl py-10">
      <Badge tone="lamp" className="mb-3 border border-lamp/40">College project policy, not legal advice</Badge>
      <h1>{title}</h1>
      <p className="mt-2 text-sm text-ink-3">Last updated: October 2026</p>
      <div className="mt-6 space-y-6 text-ink-2 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:text-ink [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">{children}</div>
    </article>
  );
}
