import { CheckCircle2 } from "lucide-react";
import clinicTeam from "@/assets/clinic-team.jpg";

const REASONS = [
  {
    title: "Built for clinics, not generic SaaS",
    body: "Workflows shaped by real front-desk staff — not abstracted templates.",
  },
  {
    title: "Secure and compliant by design",
    body: "Row-level security on every record. Verified bookings. Audited admin actions.",
  },
  {
    title: "Set up in minutes",
    body: "Add doctors, set hours, share your booking link. No long onboarding calls.",
  },
  {
    title: "Friendly, human support",
    body: "Talk to a real human when you need help — usually within the same business day.",
  },
];

export function WhyChooseSection() {
  return (
    <section className="border-y border-border/60 bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 sm:py-24 lg:grid-cols-2 lg:items-center">
        <div className="order-2 lg:order-1">
          <div className="group relative overflow-hidden rounded-2xl border border-border/60 shadow-xl">
            <img
              src={clinicTeam}
              alt="Clinic team using the platform at reception"
              width={1280}
              height={1024}
              loading="lazy"
              className="h-auto w-full transition-transform duration-700 group-hover:scale-105"
            />
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Why choose us
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Premium software, without the premium hassle.
          </h2>
          <p className="mt-4 text-muted-foreground">
            We obsess over the details so your team can focus on patients. Clean interface,
            sensible defaults, and the few thoughtful features that actually move the needle.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {REASONS.map((r) => (
              <li
                key={r.title}
                className="rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <CheckCircle2 className="size-5 text-primary" aria-hidden />
                <h3 className="mt-3 text-sm font-semibold">{r.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{r.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

