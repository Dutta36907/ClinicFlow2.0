import { ArrowRight, BadgeCheck, CalendarDays, Sparkles } from "lucide-react";
import heroDashboard from "@/assets/hero-dashboard.jpg";

export function HeroBento({
  onPrimary,
  onSecondary,
}: {
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  return (
    <section className="relative overflow-hidden bg-[#fcfdfe] px-6 pt-20 pb-24">
      <div className="pointer-events-none absolute -left-32 top-20 size-96 rounded-full bg-[#5cbdb9]/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-40 size-96 rounded-full bg-[#2d8a9e]/10 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2">
        <div className="z-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#5cbdb9]/30 bg-[#5cbdb9]/10 px-3 py-1 text-sm font-medium text-[#2d8a9e]">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5cbdb9] opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-[#5cbdb9]" />
            </span>
            Built for modern clinics
          </div>

          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-[#0c2340] md:text-6xl lg:text-7xl">
            Run your clinic with{" "}
            <span className="relative inline-block text-[#2d8a9e]">
              calm
              <svg
                className="absolute -bottom-2 left-0 w-full"
                viewBox="0 0 200 12"
                fill="none"
                aria-hidden
              >
                <path
                  d="M2 9 Q 50 2, 100 6 T 198 5"
                  stroke="#5cbdb9"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </span>{" "}
            software.
          </h1>

          <p className="mt-7 max-w-xl text-lg text-[#1a4a6e]/80 leading-relaxed">
            Publish a branded booking page, manage doctors, and accept verified appointments online
            — without juggling spreadsheets, calls, or no-shows.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <button
              onClick={onPrimary}
              className="group inline-flex items-center gap-2 rounded-xl bg-[#2d8a9e] px-7 py-4 font-bold text-white shadow-lg shadow-[#2d8a9e]/30 transition-all hover:-translate-y-0.5 hover:bg-[#1a4a6e] hover:shadow-xl"
            >
              Request Demo
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </button>
            <button
              onClick={onSecondary}
              className="inline-flex items-center gap-2 rounded-xl border border-[#1a4a6e]/15 bg-white px-7 py-4 font-bold text-[#1a4a6e] transition-all hover:-translate-y-0.5 hover:border-[#2d8a9e]/40 hover:bg-[#5cbdb9]/5"
            >
              Sign Up Free
            </button>
          </div>

          <div className="mt-8 flex items-center gap-6 text-xs font-medium text-[#1a4a6e]/60">
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="size-4 text-[#2d8a9e]" /> No credit card
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="size-4 text-[#2d8a9e]" /> Live in 10 minutes
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4 text-[#2d8a9e]" /> Free demo call
            </span>
          </div>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute -inset-6 rounded-3xl bg-gradient-to-tr from-[#5cbdb9]/30 via-[#2d8a9e]/10 to-transparent blur-2xl" />

          <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-2xl shadow-[#0c2340]/20">
            <div className="flex h-9 items-center gap-1.5 bg-[#0c2340] px-4">
              <span className="size-2.5 rounded-full bg-red-400" />
              <span className="size-2.5 rounded-full bg-amber-400" />
              <span className="size-2.5 rounded-full bg-emerald-400" />
              <span className="ml-3 text-[10px] font-medium text-white/50">
                clinic.clinicflow.app
              </span>
            </div>
            <img
              src={heroDashboard}
              alt="ClinicFlow appointment dashboard preview"
              width={1280}
              height={896}
              className="block h-auto w-full"
            />
          </div>

          <div className="absolute -bottom-6 -left-8 hidden animate-[fade-in_0.6s_ease-out_0.4s_both] rounded-xl border border-slate-100 bg-white p-3.5 shadow-xl shadow-[#0c2340]/10 md:flex md:items-center md:gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-[#5cbdb9]/20 text-[#2d8a9e]">
              <BadgeCheck className="size-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#0c2340]">Appointment verified</div>
              <div className="text-[10px] text-slate-400">OTP sent to patient · 2s ago</div>
            </div>
          </div>

          <div className="absolute -top-4 -right-4 hidden animate-[fade-in_0.6s_ease-out_0.6s_both] rounded-xl border border-slate-100 bg-white p-3 shadow-xl shadow-[#0c2340]/10 md:block">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-emerald-500" />
              <div className="text-xs font-semibold text-[#0c2340]">3 new bookings today</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
