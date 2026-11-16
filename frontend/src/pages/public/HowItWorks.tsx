import { LinkButton, PageHeader } from "@/components/ui";

const STEPS: [string, string][] = [
  ["Register and verify", "Create an account, confirm your email, and submit your student details. An administrator reviews them. Until you are approved you can browse but not list or book."],
  ["List or find a resource", "Owners list gear with photos, price (or free), deposit and the time windows they are happy to lend it. Borrowers search, filter or use smart match."],
  ["Request, approve, hand over", "A booking request goes to the owner. The server refuses any overlap with a confirmed booking, even if two people ask at the same moment."],
  ["Return and record the condition", "The borrower reports the return, the owner confirms the condition. Damage opens a dispute for an administrator; deposits are never deducted automatically."],
  ["Review each other", "After a completed rental both sides can leave one review. Ratings, completed rentals and on-time returns are calculated from recorded data."],
];
export default function HowItWorks() {
  return (
    <div className="container-x py-10">
      <PageHeader title="How it works" subtitle="From first sign-up to a returned projector, and the prediction loop behind it." />
      <ol className="max-w-3xl space-y-5">{STEPS.map(([t, d], i) => <li key={t} className="panel panel-pad"><h2 className="text-lg"><span className="num text-ink-3">{i + 1}. </span>{t}</h2><p className="mt-1 text-ink-2">{d}</p></li>)}</ol>
      <section className="on-night mt-10 max-w-3xl rounded-panel p-6"><h2 className="text-2xl">The activation loop</h2>
        <p className="mt-2 text-white/75">The platform forecasts weekly demand per category from booking history, compares it with the supply that is really bookable that week, and finds idle resources in categories that will fall short. Their owners get a request that explains why, with the dates. Only an owner who accepts makes a resource available. New bookings then feed the next forecast.</p>
        <p className="mt-3 text-sm text-white/60">Early on, the forecast uses clearly labelled synthetic history. It becomes more meaningful as real bookings accumulate.</p></section>
      <div className="mt-8 flex gap-3"><LinkButton to="/explore">Explore resources</LinkButton><LinkButton to="/register" variant="secondary">Create account</LinkButton></div>
    </div>
  );
}
