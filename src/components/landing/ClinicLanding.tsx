/**
 * ClinicLanding — public landing page for `/[slug]`.
 *
 * Pure presentation: header, hero, tabs (Overview / Doctors /
 * Treatments / Reviews / Gallery) and a Book button that opens the
 * BookingDialog. All data comes in via props.
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { utcToZonedParts } from "@/lib/clinic-time";
import {
  Stethoscope,
  MapPin,
  Phone,
  CalendarCheck,
  BadgeCheck,
  Star,
  Clock,
  Globe,
  Mail,
  MessageCircle,
  Award,
  HeartPulse,
  ShieldCheck,
  Image as ImageIcon,
  MessageSquareQuote,
  Pill,
} from "lucide-react";
import { BookingDialog } from "@/components/booking/BookingDialog";
import type { Doctor } from "@/components/booking/types";
import { ContactItem, EmptyTab } from "./parts";
import { TreatmentIcon } from "./treatment-icons";
import { ClinicInactive } from "./ClinicInactive";

// Weekday lookup matches utcToZonedParts().weekday (0=Sun … 6=Sat).
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export type PerformanceStat = { label: string; value: string };
export type LandingTreatment = {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  display_order: number;
};
export type LandingTestimonial = {
  id: string;
  patient_name: string;
  rating: number;
  quote: string;
  photo_url: string | null;
  review_date: string | null;
  is_featured: boolean;
};
export type LandingGalleryItem = {
  id: string;
  image_url: string;
  caption: string | null;
};
export type LandingPageContent = {
  treatments: LandingTreatment[];
  testimonials: LandingTestimonial[];
  gallery: LandingGalleryItem[];
};

export type LandingClinic = {
  id: string;
  name: string;
  slug?: string;
  description: string | null;
  tagline?: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  performance_stats: PerformanceStat[] | null;
  timezone: string | null;
  is_active: boolean;
  expires_at?: string | null;
  status?: "active" | "inactive" | "expired";
  working_hours: Record<string, [string, string] | null> | null;
  [k: string]: unknown;
};
function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-8 flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
        {eyebrow}
      </span>
      <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      {subtitle && (
        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{subtitle}</p>
      )}
    </div>
  );
}

export function ClinicLanding({
  slug,
  clinic,
  doctors,
  content,
}: {
  slug: string;
  clinic: LandingClinic;
  doctors: Doctor[];
  content: LandingPageContent;
}) {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [presetDoctor, setPresetDoctor] = useState<Doctor | null>(null);
  const [lightbox, setLightbox] = useState<LandingGalleryItem | null>(null);
  const [activeSection, setActiveSection] = useState<string>("overview");

  function openBooking(d?: Doctor) {
    setPresetDoctor(d ?? null);
    setBookingOpen(true);
  }

  // Auto-open booking when arriving with ?book=<doctorId> (from doctor profile).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const bookId = params.get("book");
    if (!bookId) return;
    const match = doctors.find((d) => d.id === bookId);
    if (match) openBooking(match);
    // Clean URL so a refresh doesn't re-open.
    const url = new URL(window.location.href);
    url.searchParams.delete("book");
    window.history.replaceState({}, "", url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll-spy: highlight the nav link for the section currently in view.
  useEffect(() => {
    const ids = ["overview", "doctors", "treatments", "reviews", "gallery"];
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // ── Open/closed signal based on clinic working hours ──────────
  const tz = clinic.timezone || "UTC";
  const nowParts = utcToZonedParts(new Date(), tz);
  const todayKey = DAY_KEYS[nowParts.weekday];
  const rawWindow = clinic.working_hours?.[todayKey] ?? null;
  // Tolerate either ["09:00","17:00"] tuples or {open,close} objects so a
  // legacy/malformed row can't crash the public landing page.
  const todayWindow: [string, string] | null = Array.isArray(rawWindow)
    ? typeof rawWindow[0] === "string" && typeof rawWindow[1] === "string"
      ? [rawWindow[0], rawWindow[1]]
      : null
    : rawWindow &&
        typeof rawWindow === "object" &&
        typeof (rawWindow as Record<string, unknown>).open === "string" &&
        typeof (rawWindow as Record<string, unknown>).close === "string"
      ? [(rawWindow as Record<string, string>).open, (rawWindow as Record<string, string>).close]
      : null;
  const toMin = (t: string) => {
    const [h, m] = (t ?? "").split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const isOpenNow =
    !!todayWindow &&
    nowParts.minOfDay >= toMin(todayWindow[0]) &&
    nowParts.minOfDay < toMin(todayWindow[1]);
  const todayLabel = todayWindow ? `Today ${todayWindow[0]}–${todayWindow[1]}` : "Closed today";

  return (
    <div className="min-h-screen bg-background">
      {/* ── Sticky header ───────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            {clinic.logo_url ? (
              <img src={clinic.logo_url} alt="" className="size-9 rounded-xl object-cover" />
            ) : (
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Stethoscope className="size-5" />
              </span>
            )}
            <span className="font-display text-lg font-semibold tracking-tight">{clinic.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => openBooking()}>
              Book Appointment
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative">
        <div className="relative h-56 w-full overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-accent sm:h-72 md:h-[360px]">
          {clinic.cover_image_url ? (
            <img
              src={clinic.cover_image_url}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_30%_20%,oklch(var(--primary)/0.35),transparent_50%),radial-gradient(circle_at_75%_70%,oklch(var(--primary)/0.25),transparent_55%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-background/10 to-transparent" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
          <div className="-mt-10 flex flex-col gap-6 pb-6 sm:-mt-14 sm:flex-row sm:items-end sm:gap-8 sm:pb-8">
            {/* Avatar with open/closed badge */}
            <div className="relative shrink-0">
              {clinic.logo_url ? (
                <img
                  src={clinic.logo_url}
                  alt={clinic.name}
                  className="size-32 rounded-3xl border-4 border-background object-cover shadow-lg sm:size-40"
                />
              ) : (
                <div className="flex size-32 items-center justify-center rounded-3xl border-4 border-background bg-card text-primary shadow-lg sm:size-40">
                  <Stethoscope className="size-14" />
                </div>
              )}
              <span
                className={cn(
                  "absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm",
                  isOpenNow ? "bg-emerald-500" : "bg-muted-foreground",
                )}
              >
                {isOpenNow ? "Open" : "Closed"}
              </span>
            </div>

            {/* Identity */}
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                  {clinic.name}
                </h1>
                <BadgeCheck className="size-6 fill-primary/10 text-primary" />
              </div>
              {(clinic.tagline || clinic.description) && (
                <p className="mt-1.5 line-clamp-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                  {clinic.tagline || clinic.description}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground sm:text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <Star className="size-3.5 fill-amber-400 text-amber-400" /> 4.9 Rating
                </span>
                {clinic.address && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5" /> {clinic.address}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  {isOpenNow ? "Open now" : "Closed now"} · {todayLabel}
                </span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-2 sm:pb-1">
              <Button size="lg" onClick={() => openBooking()} className="gap-2">
                <CalendarCheck className="size-4" /> Book Visit
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href={clinic.phone ? `tel:${clinic.phone}` : "#contact"} className="gap-2">
                  <Phone className="size-4" /> Contact
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section nav (anchor links, sticky scroll-spy) ─────── */}
      <nav className="sticky top-[57px] z-30 mt-8 border-b border-border bg-card/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
          {[
            { v: "overview", l: "Overview" },
            { v: "doctors", l: "Doctors" },
            { v: "treatments", l: "Treatments" },
            { v: "reviews", l: "Reviews" },
            { v: "gallery", l: "Gallery" },
          ].map((t) => (
            <a
              key={t.v}
              href={`#${t.v}`}
              className={cn(
                "border-b-2 px-4 py-3.5 text-sm font-medium transition-colors",
                activeSection === t.v
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.l}
            </a>
          ))}
        </div>
      </nav>

      {/* ── Single-page sections ──────────────────────────────── */}
      <main className="mx-auto max-w-6xl space-y-16 px-4 py-12 sm:space-y-20 sm:px-6 sm:py-16">
        {/* Overview */}
        <section id="overview" className="scroll-mt-32">
          <SectionHeader
            eyebrow="About"
            title="Overview"
            subtitle="A snapshot of the clinic, facilities and how to reach us."
          />
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-2">
              <p className="text-sm leading-relaxed text-foreground/90 sm:text-base">
                {clinic.description ||
                  `${clinic.name} is committed to patient-first care, bringing together experienced specialists and modern facilities. Book your next visit online in seconds.`}
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { icon: Clock, label: "24/7 Emergency", tone: "text-rose-500 bg-rose-500/10" },
                  { icon: Award, label: "NABH Accredited", tone: "text-amber-500 bg-amber-500/10" },
                  { icon: HeartPulse, label: "Advanced ICU", tone: "text-sky-500 bg-sky-500/10" },
                  {
                    icon: ShieldCheck,
                    label: "Insurance Support",
                    tone: "text-emerald-500 bg-emerald-500/10",
                  },
                ].map((f) => (
                  <div
                    key={f.label}
                    className="flex flex-col items-center gap-2 rounded-xl border border-border bg-background p-4 text-center"
                  >
                    <span
                      className={cn(
                        "flex size-10 items-center justify-center rounded-full",
                        f.tone,
                      )}
                    >
                      <f.icon className="size-5" />
                    </span>
                    <span className="text-xs font-medium">{f.label}</span>
                  </div>
                ))}
              </div>

              {/* Contact strip */}
              <div
                id="contact"
                className="mt-6 grid gap-3 rounded-xl border border-border bg-muted/30 p-4 text-sm sm:grid-cols-2"
              >
                {clinic.phone && (
                  <ContactItem
                    icon={Phone}
                    label="Phone"
                    value={clinic.phone}
                    href={`tel:${clinic.phone}`}
                  />
                )}
                {clinic.email && (
                  <ContactItem
                    icon={Mail}
                    label="Email"
                    value={clinic.email}
                    href={`mailto:${clinic.email}`}
                  />
                )}
                {clinic.whatsapp && (
                  <ContactItem
                    icon={MessageCircle}
                    label="WhatsApp"
                    value={clinic.whatsapp}
                    href={`https://wa.me/${clinic.whatsapp.replace(/\D/g, "")}`}
                  />
                )}
                {typeof clinic.website === "string" && clinic.website && (
                  <ContactItem
                    icon={Globe}
                    label="Website"
                    value={clinic.website}
                    href={clinic.website}
                  />
                )}
              </div>
            </div>

            {/* Performance card */}
            <aside className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground shadow-lg">
              <h3 className="font-display text-lg font-semibold">Clinic Performance</h3>
              <div className="mt-5 space-y-5">
                {(clinic.performance_stats?.length
                  ? clinic.performance_stats
                  : [
                      { label: "Years Experience", value: "15+" },
                      { label: "Happy Patients", value: "10k+" },
                      { label: "Success Rate", value: "98%" },
                    ]
                ).map((s, i, arr) => {
                  const Icon = [Award, HeartPulse, ShieldCheck, BadgeCheck][i % 4];
                  return (
                    <div key={`${s.label}-${i}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-3xl font-semibold tracking-tight">{s.value}</div>
                          <div className="text-xs text-primary-foreground/80">{s.label}</div>
                        </div>
                        <Icon className="size-5 text-primary-foreground/70" />
                      </div>
                      {i < arr.length - 1 && (
                        <div className="mt-5 h-px w-full bg-primary-foreground/15" />
                      )}
                    </div>
                  );
                })}
              </div>
              <Button
                variant="secondary"
                className="mt-6 w-full bg-background text-foreground hover:bg-background/90"
                onClick={() => openBooking()}
              >
                Book a Visit
              </Button>
            </aside>
          </div>
        </section>

        {/* Doctors */}
        <section id="doctors" className="scroll-mt-32">
          <SectionHeader
            eyebrow="Care team"
            title="Our Doctors"
            subtitle="Experienced specialists ready to see you."
          />
          {doctors.length === 0 ? (
            <EmptyTab
              icon={Stethoscope}
              title="No doctors yet"
              text="This clinic hasn't added any doctors."
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {doctors.map((d) => (
                <article
                  key={d.id}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 focus-within:ring-2 focus-within:ring-ring"
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/5 to-transparent" />
                  <div className="relative flex items-center gap-3">
                    <div className="relative">
                      <div className="absolute -inset-0.5 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 opacity-0 blur-sm transition-opacity group-hover:opacity-100" />
                      {d.photo_url ? (
                        <img
                          src={d.photo_url}
                          alt={d.name}
                          className="relative size-14 rounded-full object-cover ring-2 ring-background"
                        />
                      ) : (
                        <div className="relative flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-lg font-semibold text-primary ring-2 ring-background">
                          {d.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <span
                        className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-card text-primary ring-2 ring-background"
                        aria-hidden
                      >
                        <BadgeCheck className="size-3.5 fill-primary text-primary-foreground" />
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-display font-semibold leading-tight">
                        {d.name}
                      </h3>
                      <p className="truncate text-xs text-muted-foreground">
                        {d.specialization}
                        {d.degree && ` · ${d.degree}`}
                      </p>
                    </div>
                  </div>
                  {d.description && (
                    <p className="relative mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                      {d.description}
                    </p>
                  )}
                  {d.years_experience != null && (
                    <div className="relative mt-3 flex items-center gap-2">
                      <Badge variant="secondary" className="gap-1 text-[11px]">
                        <Award className="size-3" />
                        {d.years_experience}+ yrs experience
                      </Badge>
                    </div>
                  )}
                  <div className="relative mt-4 flex gap-2">
                    <Button asChild variant="outline" className="flex-1 gap-2">
                      <Link to="/$slug/doctors/$doctorId" params={{ slug, doctorId: d.id }}>
                        View profile
                      </Link>
                    </Button>
                    <Button
                      className="flex-1 gap-2 shadow-sm transition-transform group-hover:scale-[1.01]"
                      onClick={() => openBooking(d)}
                    >
                      <CalendarCheck className="size-4" />
                      Book
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Treatments */}
        <section id="treatments" className="scroll-mt-32">
          <SectionHeader
            eyebrow="Services"
            title="Treatments"
            subtitle="Conditions and procedures offered at the clinic."
          />
          {content.treatments.length === 0 ? (
            <EmptyTab
              icon={Pill}
              title="Treatments coming soon"
              text="The clinic will list specialized treatments here."
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {content.treatments.map((t) => (
                <article
                  key={t.id}
                  className="group relative flex gap-4 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-primary/5 blur-2xl transition-opacity duration-300 group-hover:opacity-80"
                  />
                  <span className="relative flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/10 transition-transform duration-300 group-hover:scale-105 group-hover:ring-primary/30">
                    <TreatmentIcon name={t.icon} className="size-6" />
                  </span>
                  <div className="relative min-w-0">
                    <h3 className="font-display font-semibold leading-tight">{t.title}</h3>
                    {t.description && (
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {t.description}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Reviews */}
        <section id="reviews" className="scroll-mt-32">
          <SectionHeader
            eyebrow="Testimonials"
            title="Patient Reviews"
            subtitle="What patients are saying about their visits."
          />
          {content.testimonials.length === 0 ? (
            <EmptyTab
              icon={MessageSquareQuote}
              title="Reviews coming soon"
              text="Patient reviews will appear here."
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {content.testimonials.map((r) => (
                <article
                  key={r.id}
                  className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
                >
                  <MessageSquareQuote
                    aria-hidden
                    className="pointer-events-none absolute -right-2 -top-2 size-20 text-primary/5 transition-colors duration-300 group-hover:text-primary/10"
                  />
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-0.5 text-amber-400">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "size-4",
                            i < r.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/25",
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {r.rating}.0
                    </span>
                  </div>
                  <p className="relative text-sm leading-relaxed text-foreground/90">
                    <span className="font-display text-2xl leading-none text-primary/40">
                      &ldquo;
                    </span>
                    {r.quote}
                    <span className="font-display text-2xl leading-none text-primary/40">
                      &rdquo;
                    </span>
                  </p>
                  <div className="relative mt-auto flex items-center gap-3 border-t border-border/60 pt-3">
                    {r.photo_url ? (
                      <img
                        src={r.photo_url}
                        alt={r.patient_name}
                        className="size-10 rounded-full object-cover ring-2 ring-background"
                      />
                    ) : (
                      <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-sm font-semibold text-primary ring-2 ring-background">
                        {r.patient_name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 truncate text-sm font-medium">
                        {r.patient_name}
                        <BadgeCheck
                          className="size-3.5 text-primary"
                          aria-label="Verified patient"
                        />
                      </div>
                      {r.review_date && (
                        <div className="text-xs text-muted-foreground">
                          {new Date(r.review_date).toLocaleDateString(undefined, {
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Gallery */}
        <section id="gallery" className="scroll-mt-32">
          <SectionHeader
            eyebrow="Inside the clinic"
            title="Gallery"
            subtitle="A look at the space, team and facilities."
          />
          {content.gallery.length === 0 ? (
            <EmptyTab
              icon={ImageIcon}
              title="Gallery coming soon"
              text="Clinic photos will appear here."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {content.gallery.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setLightbox(g)}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={g.caption ? `View image: ${g.caption}` : "View image"}
                >
                  <img
                    src={g.image_url}
                    alt={g.caption ?? ""}
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/0 via-black/0 to-black/0 transition-colors duration-300 group-hover:from-black/40"
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-white/90 text-foreground opacity-0 shadow-md backdrop-blur transition-opacity duration-300 group-hover:opacity-100"
                  >
                    <ImageIcon className="size-4" />
                  </span>
                  {g.caption && (
                    <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 py-2 text-left text-[11px] font-medium text-white">
                      {g.caption}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="mt-8 border-t border-border bg-card/50 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-2 px-4 text-xs text-muted-foreground sm:flex-row sm:gap-6 sm:px-6">
          <p>
            © {new Date().getFullYear()} {clinic.name}
          </p>
          <a href="/privacy" className="hover:text-foreground">
            Privacy
          </a>
          <a href="/terms" className="hover:text-foreground">
            Terms
          </a>
        </div>
      </footer>

      {/* Booking dialog (controlled by openBooking above) */}
      <BookingDialog
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        clinicId={clinic.id}
        clinicTimezone={tz}
        clinicName={clinic.name}
        clinicLogoUrl={clinic.logo_url}
        clinicTagline={(clinic as { tagline?: string | null }).tagline ?? clinic.description}
        doctors={doctors}
        presetDoctor={presetDoctor}
      />

      {/* Gallery lightbox */}
      {lightbox && (
        <button
          type="button"
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          aria-label="Close image"
        >
          <img
            src={lightbox.image_url}
            alt={lightbox.caption ?? ""}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </button>
      )}
    </div>
  );
}

/**
 * Lightweight fallback shown when a clinic exists but is not accepting
 * online bookings (or doesn't exist at all). Kept here so $slug.tsx
 * stays minimal.
 */
export function ClinicUnavailable({
  slug,
  clinic,
}: {
  slug: string;
  clinic: LandingClinic | null;
}) {
  if (!clinic) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="font-display text-3xl">Clinic not found</h1>
        <p className="text-muted-foreground">No clinic exists at /{slug}.</p>
        <Button asChild>
          <Link to="/">Back home</Link>
        </Button>
      </div>
    );
  }
  return <ClinicInactive clinic={{ ...clinic, slug: clinic.slug ?? slug }} />;
}
