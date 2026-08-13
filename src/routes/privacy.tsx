import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — ClinicFlow Suite" },
      {
        name: "description",
        content:
          "How ClinicFlow Suite collects, uses, stores, and deletes personal data under India's DPDP Act 2023.",
      },
      { property: "og:title", content: "Privacy Policy — ClinicFlow Suite" },
      { property: "og:url", content: "https://book-my-clinic-98.lovable.app/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://book-my-clinic-98.lovable.app/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-sm leading-relaxed text-foreground">
      <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
        ← Back to home
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-xs text-muted-foreground">
        Last updated: {new Date().toLocaleDateString()}
      </p>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">1. What we collect</h2>
        <p>
          When you book an appointment or submit an enquiry, we collect your
          name, phone number, and (optionally) email and message. Clinics on the
          platform may also store appointment notes you provide.
        </p>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-semibold">2. How we use it</h2>
        <p>
          We use this data solely to confirm your booking, send appointment
          reminders, allow the clinic to contact you, and meet legal record-keeping
          requirements. We do not sell or share your data for marketing.
        </p>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-semibold">3. Consent</h2>
        <p>
          By submitting a booking or enquiry, you consent to the processing
          described here. Consent is recorded with a timestamp at the moment of
          submission, as required by India's Digital Personal Data Protection
          Act, 2023.
        </p>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-semibold">4. Retention &amp; deletion</h2>
        <p>
          You may request deletion of your enquiry or appointment data by writing
          to your clinic, or to the platform at the contact below. Verified
          deletion requests are honoured within 30 days.
        </p>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-semibold">5. Security</h2>
        <p>
          Data is stored on encrypted servers with strict role-based access. SMS
          verification protects against unauthorised bookings made in your name.
        </p>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-semibold">6. Contact</h2>
        <p>
          For privacy questions or data requests, contact your clinic directly or
          email the platform administrator.
        </p>
      </section>
    </main>
  );
}
