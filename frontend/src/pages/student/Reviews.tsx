import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useState } from "react";
import { Button, Dialog, EmptyState, ErrorState, ListSkeleton, PageHeader, Select, Textarea, useToast } from "@/components/ui";
import { api, errMsg } from "@/lib/api";
import { dateOnly } from "@/lib/format";
import type { Booking, Review } from "@/lib/types";

interface R { received: Review[]; given: Review[]; awaiting_my_review: Booking[] }
const Stars = ({ n }: { n: number }) => <span className="inline-flex" aria-label={`${n} out of 5`}>{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`h-4 w-4 ${i <= n ? "fill-lamp text-lamp" : "text-line-2"}`} aria-hidden />)}</span>;

export default function Reviews() {
  const qc = useQueryClient();
  const toast = useToast();
  const [target, setTarget] = useState<Booking | null>(null);
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const q = useQuery({ queryKey: ["reviews"], queryFn: () => api.get<R>("/api/reviews/mine") });
  const send = useMutation({ mutationFn: () => api.post(`/api/bookings/${target!.id}/reviews`, { rating: Number(rating), comment }),
    onSuccess: () => { toast.success("Review submitted."); setTarget(null); setComment(""); qc.invalidateQueries({ queryKey: ["reviews"] }); }, onError: (e) => toast.error(errMsg(e)) });
  if (q.isLoading) return <ListSkeleton />;
  if (q.isError || !q.data) return <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} />;
  const d = q.data;
  const list = (items: Review[], who: "reviewer" | "reviewee") => !items.length ? <p className="text-sm text-ink-3">Nothing yet.</p> :
    <ul className="space-y-3">{items.map((r) => <li key={r.id} className="panel p-4"><div className="flex items-center justify-between"><Stars n={r.rating} /><span className="text-xs text-ink-3">{dateOnly(r.created_at)}</span></div><p className="mt-1 text-sm font-medium">{who === "reviewer" ? r.reviewer.name : `For ${r.reviewee.name}`}</p>{r.comment && <p className="text-sm text-ink-2">{r.comment}</p>}</li>)}</ul>;
  return (
    <div className="space-y-8">
      <PageHeader title="Reviews" subtitle="Reviews can be left once a rental is completed, one per person per booking." />
      <section><h2 className="mb-3 text-xl">Waiting for your review</h2>
        {!d.awaiting_my_review.length ? <EmptyState title="All caught up">Completed rentals you have not reviewed appear here.</EmptyState> :
          <ul className="space-y-2">{d.awaiting_my_review.map((b) => <li key={b.id} className="panel flex items-center justify-between gap-3 p-4"><span><strong>{b.resource.name}</strong> <span className="text-sm text-ink-3">with {b.owner.id === b.borrower.id ? "" : `${b.owner.name} / ${b.borrower.name}`}</span></span><Button size="sm" onClick={() => setTarget(b)}>Review</Button></li>)}</ul>}</section>
      <div className="grid gap-8 lg:grid-cols-2"><section><h2 className="mb-3 text-xl">Received</h2>{list(d.received, "reviewer")}</section><section><h2 className="mb-3 text-xl">Given</h2>{list(d.given, "reviewee")}</section></div>
      <Dialog open={!!target} onClose={() => setTarget(null)} title="Leave a review" footer={<><Button variant="secondary" onClick={() => setTarget(null)}>Cancel</Button><Button loading={send.isPending} onClick={() => send.mutate()}>Submit review</Button></>}>
        <div className="space-y-3"><Select label="Rating" value={rating} onChange={(e) => setRating(e.target.value)}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} out of 5</option>)}</Select><Textarea label="Comment" optional maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} /></div>
      </Dialog>
    </div>
  );
}
