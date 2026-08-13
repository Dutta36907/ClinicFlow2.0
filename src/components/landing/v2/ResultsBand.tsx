import { CalendarX, Clock, Star } from "lucide-react";
import { CountUp } from "./CountUp";
import { Reveal } from "./Reveal";

const METRICS = [
  {
    icon: CalendarX,
    value: <CountUp to={42} prefix="-" suffix="%" />,
    label: "Fewer no-shows",
    sub: "Verified bookings & smart reminders show real impact in the first month.",
  },
  {
    icon: Clock,
    value: (
      <>
        <CountUp to={8} /> hrs
      </>
    ),
    label: "Saved per week",
    sub: "Stop answering booking calls all day. Your team's time goes back to care.",
  },
  {
    icon: Star,
    value: (
      <>
        <CountUp to={4.9} decimals={1} />
        /5
      </>
    ),
    label: "Patient rating",
    sub: "A modern booking experience patients love — and remember.",
  },
];

export function ResultsBand() {
  return (
    <section className="relative overflow-hidden bg-[#0c2340] px-6 py-24 text-white">
      <div className="pointer-events-none absolute -left-32 top-0 size-96 rounded-full bg-[#2d8a9e]/30 blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 bottom-0 size-96 rounded-full bg-[#5cbdb9]/20 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl">
        <Reveal>
          <div className="mb-14 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#5cbdb9]">
              Real results
            </p>
            <h2 className="mt-3 font-display text-4xl font-bold md:text-5xl">
              Not vanity metrics.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/60">
              What clinics see within the first month of going live with ClinicFlow.
            </p>
          </div>
        </Reveal>

        <div className="grid gap-6 md:grid-cols-3">
          {METRICS.map((m, i) => (
            <Reveal key={m.label} delay={i * 100}>
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur-sm transition-all hover:border-[#5cbdb9]/40 hover:bg-white/[0.06]">
                <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-[#5cbdb9]/15 text-[#5cbdb9]">
                  <m.icon className="size-6" />
                </div>
                <div className="font-display text-5xl font-bold text-[#5cbdb9]">{m.value}</div>
                <div className="mt-2 text-lg font-semibold text-white">{m.label}</div>
                <p className="mt-3 text-sm text-white/60">{m.sub}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
