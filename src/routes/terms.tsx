import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — ClinicFlow Suite" },
      {
        name: "description",
        content:
          "Terms of use for ClinicFlow Suite — booking, payments, cancellations, and acceptable use.",
      },
      { property: "og:title", content: "Terms of Service — ClinicFlow Suite" },
      { property: "og:url", content: `${SITE_URL}/terms` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/terms` }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-sm leading-relaxed text-foreground">
      <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
        ← Back to home
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-xs text-muted-foreground">
        Last updated: {new Date().toLocaleDateString()}
      </p>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">1. The service</h2>
        <p>
          ClinicFlow Suite is a software platform that lets clinics publish a booking page and lets
          patients request appointments. We are not a medical provider; clinics on the platform are
          independent practices.
        </p>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-semibold">2. Bookings</h2>
        <p>
          A booking is a request to the clinic — it is confirmed only after the clinic accepts it.
          Provide accurate contact details so the clinic can reach you about scheduling.
        </p>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-semibold">3. Cancellations &amp; no-shows</h2>
        <p>
          Cancellation and rescheduling policies are set by each clinic and shown on their booking
          page. Repeated no-shows may result in being blocked from future bookings on that clinic.
        </p>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-semibold">4. Acceptable use</h2>
        <p>
          Do not submit fake bookings, scrape data, or abuse SMS verification. Rate limits and abuse
          monitoring are enforced.
        </p>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-semibold">5. Liability</h2>
        <p>
          The platform is provided “as is.” Medical advice, treatment, and payment for services are
          the responsibility of the clinic you book with.
        </p>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-semibold">6. Changes</h2>
        <p>
          We may update these terms; the “Last updated” date above reflects the most recent change.
        </p>
      </section>
    </main>
  );
}
