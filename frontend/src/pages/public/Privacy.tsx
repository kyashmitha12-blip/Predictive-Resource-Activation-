import { PageHeader } from "@/components/ui";

export default function Privacy() {
  return (
    <div className="container-x max-w-3xl py-10">
      <PageHeader title="Privacy" subtitle="Project policy for a college demonstration." />
      <div className="space-y-4 text-ink-2">
        <p><strong className="text-ink">What we store.</strong> Your name, email, student ID, department, optional college, a hashed password, your listings, bookings, reviews and notifications.</p>
        <p><strong className="text-ink">Verification documents.</strong> They are stored privately and shown only to you and to administrators. They are never served from a public URL.</p>
        <p><strong className="text-ink">What others see.</strong> Other students see your name, department, verified status, rating and rental statistics. Your email and student ID are not shown. Pickup locations are general campus areas, not home addresses.</p>
        <p><strong className="text-ink">Passwords and sessions.</strong> Passwords are hashed with Argon2. Sessions use secure, HTTP-only cookies.</p>
        <p><strong className="text-ink">Forecasting.</strong> Aggregated booking counts per category are used to forecast demand. Suggestions to owners are based on their own resources' usage and can be switched off in your profile.</p>
        <p><strong className="text-ink">Email.</strong> Emails are sent only if the operator has configured an email service. Otherwise none are sent.</p>
      </div>
    </div>
  );
}
