import { ArrowRight } from "lucide-react";
import { Reveal } from "./Reveal";

export function FinalCTA({
  onPrimary,
  onSecondary,
}: {
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  return (
    <section className="px-6 py-20">
      <Reveal>
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#1a4a6e] via-[#0c2340] to-[#0c2340] p-12 text-center md:p-16">
          <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-[#2d8a9e]/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 size-72 rounded-full bg-[#5cbdb9]/20 blur-3xl" />
          <svg aria-hidden className="pointer-events-none absolute inset-0 size-full opacity-10">
            <defs>
              <pattern
                id="cta-dots"
                x="0"
                y="0"
                width="32"
                height="32"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="2" cy="2" r="1" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#cta-dots)" />
          </svg>

          <div className="relative">
            <h2 className="font-display text-4xl font-bold text-white md:text-5xl">
              Ready to upgrade your clinic flow?
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-white/70">
              Join 500+ clinics using ClinicFlow to deliver a calmer, more modern booking
              experience.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                onClick={onPrimary}
                className="group inline-flex items-center gap-2 rounded-xl bg-[#5cbdb9] px-8 py-4 font-bold text-[#0c2340] shadow-xl transition-all hover:-translate-y-0.5 hover:bg-white"
              >
                Start Free Trial
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button
                onClick={onSecondary}
                className="rounded-xl border border-white/25 bg-white/5 px-8 py-4 font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-white/10"
              >
                Book a Demo
              </button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
