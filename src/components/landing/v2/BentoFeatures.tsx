import { Bell, Calendar, Globe, LineChart, ShieldCheck, Users } from "lucide-react";
import { Reveal } from "./Reveal";

export function BentoFeatures() {
  return (
    <section id="features" className="bg-[#0c2340]/[0.025] px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <div className="mb-14 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#2d8a9e]">
              Features
            </p>
            <h2 className="mt-3 font-display text-4xl font-bold text-[#0c2340] md:text-5xl">
              Everything you need.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[#1a4a6e]/70">
              A focused toolkit built for the daily reality of a busy clinic — not bloated hospital
              software.
            </p>
          </div>
        </Reveal>

        <div className="grid auto-rows-[220px] grid-cols-1 gap-5 md:grid-cols-12">
          {/* Branded booking page — large */}
          <Reveal className="md:col-span-8 md:row-span-2">
            <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-[#1a4a6e]/5 bg-white p-8 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-[#0c2340]/10">
              <div className="relative z-10 max-w-md">
                <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-[#5cbdb9]/10 text-[#2d8a9e]">
                  <Globe className="size-6" />
                </div>
                <h3 className="font-display text-2xl font-bold text-[#0c2340]">
                  Branded booking page
                </h3>
                <p className="mt-3 text-[#1a4a6e]/70">
                  Every clinic gets a public page at{" "}
                  <code className="rounded bg-[#5cbdb9]/15 px-1.5 py-0.5 text-xs text-[#2d8a9e]">
                    /your-clinic
                  </code>
                  . Patients pick a doctor, date, and time — instantly.
                </p>
              </div>
              <div className="absolute -bottom-4 -right-4 w-80 translate-y-6 translate-x-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-xl shadow-[#0c2340]/10 transition-transform duration-500 group-hover:-translate-y-1 group-hover:translate-x-0">
                <div className="mb-3 flex items-center gap-3">
                  <div className="size-8 rounded-full bg-[#5cbdb9]/30" />
                  <div className="space-y-1">
                    <div className="h-2 w-24 rounded bg-[#1a4a6e]/15" />
                    <div className="h-1.5 w-16 rounded bg-[#1a4a6e]/10" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-8 rounded ${
                        i === 2 || i === 5
                          ? "bg-[#2d8a9e]"
                          : i === 3
                            ? "bg-[#5cbdb9]/40"
                            : "bg-[#1a4a6e]/5"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Reveal>

          {/* Insights — tall navy */}
          <Reveal delay={80} className="md:col-span-4 md:row-span-2">
            <div className="flex h-full flex-col justify-between overflow-hidden rounded-3xl bg-[#1a4a6e] p-8 text-white transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-[#0c2340]/30">
              <div>
                <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-white/10 text-[#5cbdb9]">
                  <LineChart className="size-6" />
                </div>
                <h3 className="font-display text-2xl font-bold">Insights you'll use</h3>
                <p className="mt-3 text-white/70">
                  See bookings, conversions, and busy slots at a glance — no spreadsheet required.
                </p>
              </div>
              <div className="mt-8 space-y-3">
                {[75, 52, 86].map((w, i) => (
                  <div key={i}>
                    <div className="mb-1 flex justify-between text-[10px] text-white/50">
                      <span>{["Mon", "Tue", "Wed"][i]}</span>
                      <span>{w}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#5cbdb9] to-[#2d8a9e]"
                        style={{ width: `${w}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Verified bookings — wide teal */}
          <Reveal delay={40} className="md:col-span-12">
            <div className="flex h-full flex-col items-start justify-between gap-6 rounded-3xl border border-[#5cbdb9]/25 bg-[#5cbdb9]/10 p-8 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-[#5cbdb9]/20 md:flex-row md:items-center">
              <div className="flex items-start gap-5">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white text-[#2d8a9e] shadow-sm">
                  <ShieldCheck className="size-6" />
                </div>
                <div>
                  <h3 className="font-display text-2xl font-bold text-[#0c2340]">
                    Verified bookings
                  </h3>
                  <p className="mt-1 max-w-xl text-[#1a4a6e]/75">
                    Each appointment is verified with a one-time code via SMS / WhatsApp, so contact
                    details are always real.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <span className="rounded-full border border-white/60 bg-white px-4 py-2 text-sm font-medium text-[#1a4a6e] shadow-sm">
                  Real identities
                </span>
                <span className="rounded-full border border-white/60 bg-white px-4 py-2 text-sm font-medium text-[#1a4a6e] shadow-sm">
                  No-show protection
                </span>
                <span className="rounded-full border border-white/60 bg-white px-4 py-2 text-sm font-medium text-[#1a4a6e] shadow-sm">
                  Audit trail
                </span>
              </div>
            </div>
          </Reveal>

          {/* Smart notifications */}
          <Reveal className="md:col-span-4">
            <div className="flex h-full flex-col justify-between rounded-3xl border border-[#1a4a6e]/5 bg-white p-7 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-[#0c2340]/10">
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-[#5cbdb9]/10 text-[#2d8a9e]">
                <Bell className="size-5" />
              </div>
              <div>
                <h3 className="font-display text-xl font-bold text-[#0c2340]">
                  Smart notifications
                </h3>
                <p className="mt-2 text-sm text-[#1a4a6e]/70">
                  Email + WhatsApp reminders that quietly cut no-shows in half.
                </p>
              </div>
            </div>
          </Reveal>

          {/* Multi-doctor teams */}
          <Reveal delay={80} className="md:col-span-4">
            <div className="flex h-full flex-col justify-between rounded-3xl border border-[#1a4a6e]/5 bg-white p-7 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-[#0c2340]/10">
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-[#5cbdb9]/10 text-[#2d8a9e]">
                <Users className="size-5" />
              </div>
              <div>
                <h3 className="font-display text-xl font-bold text-[#0c2340]">
                  Multi-doctor teams
                </h3>
                <p className="mt-2 text-sm text-[#1a4a6e]/70">
                  Add unlimited doctors, assign roles, and give the front desk one clean view.
                </p>
              </div>
            </div>
          </Reveal>

          {/* Per-doctor schedules */}
          <Reveal delay={160} className="md:col-span-4">
            <div className="flex h-full flex-col justify-between rounded-3xl border border-[#1a4a6e]/5 bg-white p-7 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-[#0c2340]/10">
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-[#5cbdb9]/10 text-[#2d8a9e]">
                <Calendar className="size-5" />
              </div>
              <div>
                <h3 className="font-display text-xl font-bold text-[#0c2340]">
                  Per-doctor schedules
                </h3>
                <p className="mt-2 text-sm text-[#1a4a6e]/70">
                  Weekly hours, date overrides, and per-doctor slot lengths — respected in real
                  time.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
