const STEPS = [
  {
    n: "01",
    title: "Set up your clinic",
    body: "Add your clinic profile, doctors, working hours, and slot length in minutes.",
  },
  {
    n: "02",
    title: "Share your booking link",
    body: "Publish your branded page at /your-clinic and add it to your website or socials.",
  },
  {
    n: "03",
    title: "Manage appointments",
    body: "Track bookings, confirm or reschedule, and let automated reminders do the rest.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how" className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          From signup to first booking in under 10 minutes.
        </h2>
        <p className="mt-4 text-muted-foreground">
          A clear, three-step path to taking your first online appointment.
        </p>
      </div>

      <ol className="mt-14 grid gap-6 md:grid-cols-3">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className="relative rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
          >
            <span className="text-5xl font-semibold tracking-tight text-primary/30">{s.n}</span>
            <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
