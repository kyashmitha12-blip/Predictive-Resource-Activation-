import { PageHeader } from "@/components/ui";

export default function Terms() {
  return (
    <div className="container-x max-w-3xl py-10">
      <PageHeader title="Terms of use" subtitle="Project terms for a college demonstration. These are not legal advice." />
      <div className="space-y-4 text-ink-2">
        <p><strong className="text-ink">Project status.</strong> This platform is a student hackathon project. It is provided as is, without warranty.</p>
        <p><strong className="text-ink">Simulated payments.</strong> Rental amounts and deposits are demonstration values. No real money is charged, held or refunded, and no escrow service exists.</p>
        <p><strong className="text-ink">Your responsibilities.</strong> List only items you own and may lend. Describe their condition honestly, return borrowed items on time and report damage promptly.</p>
        <p><strong className="text-ink">Verification.</strong> Listing and booking require approval by a platform administrator. This is not an official college verification.</p>
        <p><strong className="text-ink">Disputes.</strong> Damage and disputes are reviewed by an administrator. Deposits are not changed automatically.</p>
        <p><strong className="text-ink">Moderation.</strong> Administrators may remove listings or suspend accounts that break these rules.</p>
        <p><strong className="text-ink">Forecasts.</strong> Demand predictions are estimates for decision support. Do not rely on them as guarantees.</p>
      </div>
    </div>
  );
}
