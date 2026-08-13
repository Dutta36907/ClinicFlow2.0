import {
  CalendarCheck,
  Clock,
  ShieldCheck,
  Bell,
  Users,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: CalendarCheck,
    title: "Branded booking page",
    body: "Every clinic gets a public booking page at /your-clinic — pick a doctor, time, and confirm.",
  },
  {
    icon: Clock,
    title: "Per-doctor schedules",
    body: "Weekly hours, date overrides, and per-doctor slot length — all respected in real time.",
  },
  {
    icon: ShieldCheck,
    title: "Verified bookings",
    body: "Each appointment is verified with a one-time code, so the contact details are always real.",
  },
  {
    icon: Bell,
    title: "Smart notifications",
    body: "Email and WhatsApp reminders keep patients informed and dramatically cut no-shows.",
  },
  {
    icon: Users,
    title: "Multi-doctor teams",
    body: "Add unlimited doctors, manage roles, and give your front desk a clean shared view.",
  },
  {
    icon: BarChart3,
    title: "Insights you'll use",
    body: "See bookings, conversions, and busy slots at a glance — no spreadsheet required.",
  },
];

export function FeatureSection() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Everything your clinic needs, nothing it doesn't.
        </h2>
        <p className="mt-4 text-muted-foreground">
          A focused toolkit built around the day-to-day reality of running a busy clinic.
        </p>
      </div>

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="group rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <Icon className="size-5" aria-hidden />
            </div>
            <h3 className="mt-5 text-base font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
