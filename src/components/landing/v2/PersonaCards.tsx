import { ArrowRight } from "lucide-react";
import personaDoctor from "@/assets/persona-doctor.jpg";
import personaClinic from "@/assets/persona-clinic.jpg";
import personaHospital from "@/assets/persona-hospital.jpg";
import { Reveal } from "./Reveal";

const PERSONAS = [
  {
    img: personaDoctor,
    tag: "Solo doctors",
    title: "One doctor, zero chaos",
    body: "Get back to patients — let bookings, reminders, and confirmations run themselves.",
  },
  {
    img: personaClinic,
    tag: "Multi-doctor clinics",
    title: "Your whole team in one view",
    body: "Per-doctor schedules, shared front desk, and clean handoffs. No more sticky notes.",
  },
  {
    img: personaHospital,
    tag: "Hospitals & chains",
    title: "Scale without breaking flow",
    body: "Run multiple branches and specialties under one roof with role-based access.",
  },
];

export function PersonaCards({ onCta }: { onCta: () => void }) {
  return (
    <section className="bg-[#fcfdfe] px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <div className="mb-14 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#2d8a9e]">
              Built for
            </p>
            <h2 className="mt-3 font-display text-4xl font-bold text-[#0c2340] md:text-5xl">
              Whatever your practice looks like.
            </h2>
          </div>
        </Reveal>

        <div className="grid gap-6 md:grid-cols-3">
          {PERSONAS.map((p, i) => (
            <Reveal key={p.tag} delay={i * 100}>
              <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-[#1a4a6e]/5 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-[#0c2340]/10">
                <div className="relative aspect-[5/4] overflow-hidden">
                  <img
                    src={p.img}
                    alt={p.title}
                    loading="lazy"
                    width={768}
                    height={768}
                    className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0c2340]/40 via-transparent to-transparent" />
                  <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-[#2d8a9e] backdrop-blur">
                    {p.tag}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-7">
                  <h3 className="font-display text-xl font-bold text-[#0c2340]">{p.title}</h3>
                  <p className="mt-3 flex-1 text-[#1a4a6e]/70">{p.body}</p>
                  <button
                    onClick={onCta}
                    className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-[#2d8a9e] transition-colors hover:text-[#1a4a6e]"
                  >
                    Start free
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
