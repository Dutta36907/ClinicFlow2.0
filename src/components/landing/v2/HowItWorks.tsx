import { CalendarCheck, Link2, Rocket } from "lucide-react";
import { Reveal } from "./Reveal";

const STEPS = [
  {
    icon: Rocket,
    title: "Set up your clinic",
    body: "Add your profile, doctors, working hours, and slot length in minutes.",
  },
  {
    icon: Link2,
    title: "Share your booking link",
    body: "Publish your branded page at /your-clinic and embed it anywhere.",
  },
  {
    icon: CalendarCheck,
    title: "Manage appointments",
    body: "Confirm, reschedule, or cancel — automated reminders do the rest.",
  },
];

export function HowItWorks({ onCta }: { onCta: () => void }) {
  return (
    <section id="how" className="px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <div className="mb-16 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#2d8a9e]">
              How it works
            </p>
            <h2 className="mt-3 font-display text-4xl font-bold text-[#0c2340] md:text-5xl">
              From signup to first booking
              <br /> in under 10 minutes.
            </h2>
          </div>
        </Reveal>

        <div className="relative">
          <div
            aria-hidden
            className="absolute left-[10%] right-[10%] top-9 hidden border-t-2 border-dashed border-[#5cbdb9]/40 md:block"
          />

          <div className="relative grid gap-10 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 100}>
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-6 flex size-18 items-center justify-center rounded-2xl border border-[#5cbdb9]/30 bg-white shadow-lg shadow-[#5cbdb9]/20">
                    <s.icon className="size-7 text-[#2d8a9e]" />
                    <span className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-[#1a4a6e] text-xs font-bold text-white">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-[#0c2340]">{s.title}</h3>
                  <p className="mt-3 max-w-xs text-[#1a4a6e]/70">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal delay={300}>
          <div className="mt-14 text-center">
            <button
              onClick={onCta}
              className="rounded-xl bg-[#2d8a9e] px-7 py-3.5 font-bold text-white shadow-lg shadow-[#2d8a9e]/30 transition-all hover:-translate-y-0.5 hover:bg-[#1a4a6e]"
            >
              Start your free trial
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
