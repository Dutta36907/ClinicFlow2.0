import { TrendingDown, Smile, Timer } from "lucide-react";

const BENEFITS = [
  {
    icon: TrendingDown,
    stat: "−42%",
    label: "fewer no-shows",
    body: "Verified bookings and smart reminders mean patients actually show up.",
  },
  {
    icon: Timer,
    stat: "8 hrs",
    label: "saved per week",
    body: "Stop answering booking calls all day. Your team's time goes back to care.",
  },
  {
    icon: Smile,
    stat: "4.9/5",
    label: "patient rating",
    body: "A modern booking experience patients love — and remember.",
  },
];

export function BenefitsSection() {
  return (
    <section className="border-y border-border/60 bg-muted/30">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Real results, not vanity metrics.
          </h2>
          <p className="mt-4 text-muted-foreground">
            What clinics see within the first month of going live.
          </p>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, stat, label, body }) => (
            <div
              key={label}
              className="group rounded-2xl border border-border/60 bg-card p-7 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 transition-transform group-hover:scale-110">
                <Icon className="size-5" aria-hidden />
              </div>
              <p className="mt-5 bg-gradient-to-br from-primary to-[color-mix(in_oklab,var(--primary)_55%,white)] bg-clip-text text-4xl font-semibold tracking-tight text-transparent">{stat}</p>
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
