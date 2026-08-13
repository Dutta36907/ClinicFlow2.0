import { Activity, HeartPulse, ShieldCheck, Stethoscope, Syringe } from "lucide-react";
import { CountUp } from "./CountUp";

export function TrustStrip() {
  return (
    <section className="border-y border-[#1a4a6e]/5 bg-white/60 px-6 py-10 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 lg:flex-row lg:justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#1a4a6e]/50">
          Trusted by 500+ clinics across India
        </p>

        <div className="flex items-center gap-7 text-[#1a4a6e]/40">
          <Stethoscope className="size-6" />
          <HeartPulse className="size-6" />
          <Activity className="size-6" />
          <ShieldCheck className="size-6" />
          <Syringe className="size-6" />
        </div>

        <div className="flex items-center gap-6">
          <div>
            <div className="font-display text-2xl font-bold text-[#2d8a9e]">
              <CountUp to={42} prefix="-" suffix="%" />
            </div>
            <div className="text-xs text-[#1a4a6e]/60">no-shows</div>
          </div>
          <div className="h-8 w-px bg-[#1a4a6e]/10" />
          <div>
            <div className="font-display text-2xl font-bold text-[#2d8a9e]">
              <CountUp to={8} />
              <span> hrs</span>
            </div>
            <div className="text-xs text-[#1a4a6e]/60">saved / week</div>
          </div>
          <div className="h-8 w-px bg-[#1a4a6e]/10" />
          <div>
            <div className="font-display text-2xl font-bold text-[#2d8a9e]">
              <CountUp to={4.9} decimals={1} />
              <span>/5</span>
            </div>
            <div className="text-xs text-[#1a4a6e]/60">patient rating</div>
          </div>
        </div>
      </div>
    </section>
  );
}
