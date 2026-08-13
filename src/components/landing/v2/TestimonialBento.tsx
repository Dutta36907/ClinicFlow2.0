import { Quote } from "lucide-react";
import { Reveal } from "./Reveal";

export function TestimonialBento() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <div className="mb-14 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#2d8a9e]">
              Loved by clinics
            </p>
            <h2 className="mt-3 font-display text-4xl font-bold text-[#0c2340] md:text-5xl">
              Big and small.
            </h2>
          </div>
        </Reveal>

        <div className="grid gap-5 md:grid-cols-12 md:grid-rows-2">
          <Reveal className="md:col-span-7 md:row-span-2">
            <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a4a6e] to-[#0c2340] p-10 text-white">
              <Quote className="absolute -top-2 -right-2 size-40 text-white/5" />
              <p className="relative font-display text-2xl font-medium leading-relaxed md:text-3xl">
                "We replaced three tools with ClinicFlow. Patients book themselves, reminders
                go out automatically, and our front desk finally breathes."
              </p>
              <div className="mt-8 flex items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-full bg-[#5cbdb9]/30 font-display font-bold text-[#5cbdb9]">
                  AM
                </div>
                <div>
                  <div className="font-bold">Dr. Anjali Mehta</div>
                  <div className="text-sm text-white/60">Founder, Mehta Dental Care</div>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={100} className="md:col-span-5">
            <div className="flex h-full flex-col justify-between rounded-3xl border border-[#1a4a6e]/5 bg-white p-7">
              <p className="text-[#1a4a6e]/85">
                "Setup took an afternoon. The booking page looks like part of our brand and the
                verified contacts mean no more fake bookings."
              </p>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-[#5cbdb9]/20 font-bold text-[#2d8a9e]">
                  RI
                </div>
                <div>
                  <div className="text-sm font-bold text-[#0c2340]">Rohan Iyer</div>
                  <div className="text-xs text-[#1a4a6e]/60">Practice Manager, Iyer Multispeciality</div>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={200} className="md:col-span-5">
            <div className="flex h-full flex-col justify-between rounded-3xl border border-[#5cbdb9]/25 bg-[#5cbdb9]/10 p-7">
              <p className="text-[#1a4a6e]/85">
                "The schedule overrides are a small thing that changed everything for us. Our
                doctors love how flexible it is."
              </p>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-white font-bold text-[#2d8a9e]">
                  PS
                </div>
                <div>
                  <div className="text-sm font-bold text-[#0c2340]">Dr. Priya Suresh</div>
                  <div className="text-xs text-[#1a4a6e]/60">Pediatrician, Little Steps Clinic</div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
