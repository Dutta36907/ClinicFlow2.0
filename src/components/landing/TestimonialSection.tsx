import { Quote } from "lucide-react";
import doctorPortrait from "@/assets/doctor-portrait.jpg";

const TESTIMONIALS = [
  {
    quote:
      "We replaced three tools with ClinicFlow. Patients book themselves, reminders go out automatically, and our front desk finally breathes.",
    name: "Dr. Anjali Mehta",
    role: "Founder, Mehta Dental Care",
  },
  {
    quote:
      "Setup took an afternoon. The booking page looks like part of our brand and the verified contacts mean no more fake bookings.",
    name: "Rohan Iyer",
    role: "Practice Manager, Iyer Multispeciality",
  },
  {
    quote:
      "The schedule overrides are a small thing that changed everything for us. Our doctors love how flexible it is.",
    name: "Dr. Priya Suresh",
    role: "Pediatrician, Little Steps Clinic",
  },
];

export function TestimonialSection() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Loved by clinics, big and small.
        </h2>
        <p className="mt-4 text-muted-foreground">
          A few words from teams already running on ClinicFlow.
        </p>
      </div>

      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <figure
            key={t.name}
            className="flex h-full flex-col rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
          >
            <Quote className="size-6 text-primary/70" aria-hidden />
            <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-foreground">
              "{t.quote}"
            </blockquote>
            <figcaption className="mt-6 flex items-center gap-3">
              <img
                src={doctorPortrait}
                alt=""
                width={48}
                height={48}
                loading="lazy"
                className="size-12 rounded-full object-cover ring-2 ring-primary/20"
              />
              <div>
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
