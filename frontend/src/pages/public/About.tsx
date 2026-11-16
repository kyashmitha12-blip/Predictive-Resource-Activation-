import { PageHeader } from "@/components/ui";

export default function About() {
  return (
    <div className="container-x max-w-3xl py-10">
      <PageHeader title="About the project" subtitle="LEND & LOOP is an intelligent campus resource-sharing platform that connects students who need equipment with people who have resources to lend." />
      <div className="space-y-5 text-ink-2">
        <p>Students often buy expensive equipment for one assignment while the same kind of equipment sits unused in someone else's room. And when many students need the same thing at once, a plain listing site cannot see the shortage coming.</p>
        <p>This project combines peer-to-peer sharing with demand forecasting, idle-resource detection and consent-based owner activation. Peer sharing and demand forecasting are established ideas. The proposed contribution is the integrated workflow that connects them: predict a shortage, find idle resources, ask owners, and feed the outcome back into the next prediction.</p>
        <h2 className="pt-2 text-xl text-ink">What it is, and is not</h2>
        <ul className="list-disc space-y-1 pl-5"><li>A decision-support system. Forecasts are estimates, not guarantees.</li><li>A college project. Payments and deposits are simulated.</li><li>Consent-based. No resource is activated or booked without its owner's decision.</li><li>Honest about data. Demo history is labelled synthetic and real bookings are tracked separately.</li></ul>
        <h2 className="pt-2 text-xl text-ink">Built with</h2>
        <p>React, TypeScript, Tailwind CSS, FastAPI, PostgreSQL, SQLAlchemy, Alembic, pandas and scikit-learn.</p>
      </div>
    </div>
  );
}
