/**
 * Public doctor profile page: /$slug/doctors/$doctorId
 *
 * Patient-facing, read-only. Ocean Deep aesthetic. Booking handoff goes
 * back to /$slug?book=<doctorId> where ClinicLanding auto-opens the
 * BookingDialog for that doctor.
 */
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarCheck,
  CalendarOff,
  Languages as LanguagesIcon,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRange12 } from "@/lib/clinic-time";
import { WEEKDAY_LABELS } from "@/lib/doctor-slots";
import { getClinicBySlug, getPublicDoctorProfile } from "@/lib/public.functions";
import { SITE_URL } from "@/lib/site-url";

export const Route = createFileRoute("/$slug/doctors/$doctorId")({
  loader: async ({ params }) => {
    if (!/^[a-z0-9-]+$/i.test(params.slug)) throw notFound();
    const clinic = await getClinicBySlug({ data: { slug: params.slug } });
    if (!clinic) throw notFound();
    const profile = await getPublicDoctorProfile({
      data: { clinicId: clinic.id, doctorId: params.doctorId },
    });
    if (!profile) throw notFound();
    return { clinic, ...profile };
  },
  head: ({ params, loaderData }) => {
    const url = `${SITE_URL}/${params.slug}/doctors/${params.doctorId}`;
    if (!loaderData) {
      return { meta: [{ title: "Doctor profile" }] };
    }
    const { doctor, clinic } = loaderData;
    const spec = doctor.specialization ? ` · ${doctor.specialization}` : "";
    const title = `${doctor.name}${spec} — ${clinic.name}`;
    const rawDesc =
      (doctor.description?.trim()) ||
      `${doctor.name}${spec}. Book an appointment at ${clinic.name}.`;
    const description =
      rawDesc.length > 160 ? `${rawDesc.replace(/\s+/g, " ").slice(0, 159).trimEnd()}…` : rawDesc.replace(/\s+/g, " ");
    const ogImage =
      doctor.photo_url ||
      (clinic as { cover_image_url?: string | null }).cover_image_url ||
      (clinic as { logo_url?: string | null }).logo_url ||
      null;
    const meta: Array<{ title?: string; name?: string; property?: string; content?: string }> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "profile" },
      { property: "og:url", content: url },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ];
    if (ogImage) {
      meta.push({ property: "og:image", content: ogImage });
      meta.push({ name: "twitter:image", content: ogImage });
      meta.push({ name: "twitter:card", content: "summary_large_image" });
    }
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Physician",
            name: doctor.name,
            ...(doctor.specialization ? { medicalSpecialty: doctor.specialization } : {}),
            ...(ogImage ? { image: ogImage } : {}),
            url,
            worksFor: {
              "@type": "MedicalClinic",
              name: clinic.name,
              url: `${SITE_URL}/${params.slug}`,
            },
          }),
        },
      ],
    };
  },
  pendingMs: 0,
  pendingMinMs: 300,
  pendingComponent: DoctorProfileSkeleton,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div
        role="alert"
        className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center p-10 text-center"
      >
        <h1 className="font-display text-2xl">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error?.message ?? "We couldn't load this doctor's profile."}
        </p>
        <Button
          className="mt-4"
          onClick={() => {
            reset();
            router.invalidate();
          }}
        >
          Try again
        </Button>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center p-10 text-center">
      <h1 className="font-display text-2xl">Doctor not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This doctor isn't available at this clinic.
      </p>
    </div>
  ),
  component: PublicDoctorProfilePage,
});

function DoctorProfileSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading doctor profile"
      className="min-h-screen bg-[#f4f7fb]"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-5 h-8 w-48 animate-pulse rounded-md bg-[#0c2340]/10" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <div className="h-[420px] animate-pulse rounded-3xl bg-gradient-to-br from-[#0c2340]/20 to-[#2d8a9e]/15" />
          <div className="space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-2xl bg-white/80 ring-1 ring-[#0c2340]/5"
              />
            ))}
          </div>
        </div>
        <span className="sr-only">Loading doctor profile…</span>
      </div>
    </div>
  );
}

const FONT_STACK = {
  fontFamily:
    '"Sora", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
} as const;
const BODY_STACK = {
  fontFamily:
    '"Manrope", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
} as const;

type Schedule = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};
type Override = {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  is_blocked: boolean;
  reason: string | null;
};

function PublicDoctorProfilePage() {
  const { slug } = Route.useParams();
  const data = Route.useLoaderData();
  const { clinic, doctor } = data;
  const schedules = data.schedules as Schedule[];
  const overrides = data.overrides as Override[];

  const weeklyMinutes = schedules
    .filter((s) => s.is_active)
    .reduce((sum, s) => sum + minutesBetween(s.start_time, s.end_time), 0);

  const dayOrder = [1, 2, 3, 4, 5, 6, 0];
  const byWeekday = new Map<number, Schedule[]>();
  for (const s of schedules) {
    const list = byWeekday.get(s.weekday) ?? [];
    list.push(s);
    byWeekday.set(s.weekday, list);
  }

  const specialtyChips: string[] =
    doctor.specialties && doctor.specialties.length > 0
      ? (doctor.specialties as string[])
      : doctor.specialization
        ? [doctor.specialization]
        : [];
  const languageChips: string[] = (doctor.languages as string[] | null) ?? [];

  const mapsHref =
    clinic.google_map_url ??
    (clinic.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinic.address)}`
      : null);

  const initials = doctor.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="min-h-screen bg-[#f6f9fb] flex flex-col md:flex-row" style={BODY_STACK}>
      {/* LEFT — sticky identity rail */}
      <aside className="md:w-[400px] lg:w-[450px] shrink-0 bg-[#0c2340] text-white md:sticky md:top-0 md:h-screen flex flex-col p-8 lg:p-12">
        <div className="flex-1 flex flex-col">
          {/* Avatar with offset gradient layer */}
          <div className="relative w-44 h-44 lg:w-56 lg:h-56 mx-auto mb-8">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#2d8a9e] to-[#5cbdb9] rotate-3 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 duration-700" />
            <div className="absolute inset-0 rounded-3xl bg-[#1a4a6e] border-4 border-[#0c2340] overflow-hidden flex items-center justify-center">
              {doctor.photo_url ? (
                <img
                  src={doctor.photo_url}
                  alt={doctor.name}
                  className="size-full object-cover"
                />
              ) : (
                <span
                  className="text-6xl font-semibold text-[#5cbdb9]"
                  style={FONT_STACK}
                >
                  {initials || doctor.name.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
          </div>

          <div className="text-center space-y-2">
            <h1
              className="text-3xl lg:text-4xl font-semibold tracking-tight"
              style={FONT_STACK}
            >
              {doctor.name}
            </h1>
            {(doctor.degree || doctor.specialization) && (
              <p className="text-[#5cbdb9] font-medium tracking-wide uppercase text-xs">
                {[doctor.degree, doctor.specialization].filter(Boolean).join(" • ")}
              </p>
            )}
            <div className="pt-2">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1a4a6e] text-xs font-semibold">
                <span className="size-2 rounded-full bg-[#5cbdb9] motion-safe:animate-pulse" />
                Accepting bookings
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-10">
            <SideStat
              value={
                doctor.years_experience != null
                  ? String(doctor.years_experience)
                  : "—"
              }
              label="Years Exp"
            />
            <SideStat
              value={`${doctor.appointment_duration_minutes}m`}
              label="Avg Slot"
            />
            <SideStat value={formatHours(weeklyMinutes)} label="Weekly" />
          </div>
        </div>

        {/* Sticky CTA */}
        <div className="mt-10">
          <Button
            asChild
            size="lg"
            className="w-full gap-2 bg-[#5cbdb9] hover:bg-[#2d8a9e] text-[#0c2340] hover:text-white font-bold rounded-2xl py-6 shadow-xl shadow-black/20 transition-all group"
          >
            <Link
              to="/$slug"
              params={{ slug }}
              search={{ book: doctor.id } as never}
            >
              <CalendarCheck className="size-4" />
              Book appointment
              <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </Button>
          <p className="text-center text-white/40 text-[11px] mt-3">
            No payment required to book
          </p>
        </div>
      </aside>

      {/* RIGHT — scrollable detail stack */}
      <main className="flex-1 p-6 lg:p-16 space-y-12">
        {/* Breadcrumb */}
        <nav className="flex items-center text-sm text-slate-500 gap-2">
          <Link
            to="/$slug"
            params={{ slug }}
            className="inline-flex items-center gap-1 hover:text-[#2d8a9e] transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Clinics
          </Link>
          <span>/</span>
          <span className="text-[#0c2340] font-medium truncate">{clinic.name}</span>
        </nav>

        {/* About */}
        <section className="space-y-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 duration-500">
          <h2
            className="text-2xl font-semibold text-[#0c2340]"
            style={FONT_STACK}
          >
            About
          </h2>
          {doctor.description ? (
            <p className="text-slate-600 leading-relaxed text-lg whitespace-pre-line">
              {doctor.description}
            </p>
          ) : (
            <p className="text-slate-400 italic">No bio added yet.</p>
          )}
        </section>

        {/* Specialties */}
        <section className="space-y-4">
          <h2
            className="text-xl font-semibold text-[#0c2340]"
            style={FONT_STACK}
          >
            Specialties
          </h2>
          {specialtyChips.length === 0 ? (
            <p className="text-slate-400 italic">No specialties listed yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {specialtyChips.map((s, i) => (
                <span
                  key={`${s}-${i}`}
                  className="px-4 py-2 bg-[#2d8a9e]/10 text-[#2d8a9e] rounded-full font-medium text-sm"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Languages (only when present) */}
        {languageChips.length > 0 && (
          <section className="space-y-4">
            <h2
              className="text-xl font-semibold text-[#0c2340] flex items-center gap-2"
              style={FONT_STACK}
            >
              <LanguagesIcon className="size-5 text-[#2d8a9e]" />
              Languages
            </h2>
            <div className="flex flex-wrap gap-2">
              {languageChips.map((l, i) => (
                <span
                  key={`${l}-${i}`}
                  className="px-4 py-2 bg-[#5cbdb9]/15 text-[#0c2340] rounded-full font-medium text-sm"
                >
                  {l}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Clinic Details */}
        <section className="space-y-6">
          <h2
            className="text-xl font-semibold text-[#0c2340]"
            style={FONT_STACK}
          >
            Clinic Details
          </h2>
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="font-bold text-[#0c2340]" style={FONT_STACK}>
                {clinic.name}
              </h3>
              {clinic.address ? (
                <a
                  href={mapsHref ?? "#"}
                  target={mapsHref ? "_blank" : undefined}
                  rel={mapsHref ? "noreferrer" : undefined}
                  className="flex items-start gap-3 text-slate-600 hover:text-[#0c2340] transition-colors group"
                >
                  <MapPin className="size-5 text-[#2d8a9e] shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <p>{clinic.address}</p>
                </a>
              ) : (
                <p className="text-slate-400 italic text-sm">No address on file.</p>
              )}
            </div>
            <div className="space-y-4">
              {clinic.phone && (
                <a
                  href={`tel:${clinic.phone}`}
                  className="flex items-center gap-3 text-slate-600 hover:text-[#0c2340] transition-colors"
                >
                  <Phone className="size-5 text-[#2d8a9e]" />
                  <span>{clinic.phone}</span>
                </a>
              )}
              {clinic.email && (
                <a
                  href={`mailto:${clinic.email}`}
                  className="flex items-center gap-3 text-slate-600 hover:text-[#0c2340] transition-colors break-all"
                >
                  <Mail className="size-5 text-[#2d8a9e] shrink-0" />
                  <span className="truncate">{clinic.email}</span>
                </a>
              )}
              {!clinic.phone && !clinic.email && (
                <p className="text-slate-400 italic text-sm">No contact info.</p>
              )}
            </div>
          </div>
        </section>

        {/* Weekly Availability */}
        <section className="space-y-6">
          <div className="flex justify-between items-end gap-4">
            <h2
              className="text-xl font-semibold text-[#0c2340]"
              style={FONT_STACK}
            >
              Weekly Availability
            </h2>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              {formatHours(weeklyMinutes)} per week
            </span>
          </div>
          <div className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm">
            <div className="divide-y divide-slate-100">
              {dayOrder.map((wd) => {
                const list = (byWeekday.get(wd) ?? [])
                  .slice()
                  .sort((a, b) => a.start_time.localeCompare(b.start_time));
                const isToday = wd === new Date().getDay();
                const unavailable = list.length === 0;
                return (
                  <div
                    key={wd}
                    className={
                      "flex items-center justify-between gap-4 p-5 transition-colors " +
                      (isToday
                        ? "bg-[#5cbdb9]/10"
                        : unavailable
                          ? "bg-slate-50/60"
                          : "")
                    }
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className={
                          "size-10 rounded-xl flex items-center justify-center font-bold text-[11px] shrink-0 " +
                          (isToday
                            ? "bg-[#0c2340] text-white"
                            : unavailable
                              ? "bg-slate-200 text-slate-500"
                              : "bg-slate-100 text-slate-500")
                        }
                        style={FONT_STACK}
                      >
                        {WEEKDAY_LABELS[wd].slice(0, 3).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex items-center gap-2 flex-wrap">
                        <span
                          className={
                            "font-semibold " +
                            (isToday
                              ? "text-[#0c2340]"
                              : unavailable
                                ? "text-slate-400"
                                : "text-slate-700")
                          }
                        >
                          {WEEKDAY_LABELS[wd]}
                        </span>
                        {isToday && (
                          <span className="text-[10px] bg-[#2d8a9e] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            Today
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5 text-right">
                      {unavailable ? (
                        <span className="text-slate-400 italic text-sm">Unavailable</span>
                      ) : (
                        list.map((s) => (
                          <span
                            key={s.id}
                            className={
                              "text-sm font-medium tabular-nums " +
                              (s.is_active
                                ? "text-slate-700"
                                : "text-slate-400 line-through")
                            }
                          >
                            {formatRange12(
                              s.start_time.slice(0, 5),
                              s.end_time.slice(0, 5),
                            )}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Time Off */}
        <section className="space-y-4">
          <h2
            className="text-xl font-semibold text-[#0c2340]"
            style={FONT_STACK}
          >
            Upcoming Time Off
          </h2>
          {overrides.length === 0 ? (
            <div className="bg-[#5cbdb9]/10 rounded-2xl p-6 border border-[#5cbdb9]/20 flex items-center gap-4">
              <div className="size-10 rounded-full bg-white flex items-center justify-center text-[#2d8a9e] shrink-0">
                <CalendarOff className="size-5" />
              </div>
              <p className="text-slate-600 text-sm">
                No upcoming time off — {doctor.name.split(" ")[0]}'s weekly
                schedule applies normally.
              </p>
            </div>
          ) : (
            <ul className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-100">
              {overrides.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-4 p-5"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-[#0c2340]">
                      {formatDate(o.date)}
                    </div>
                    {o.reason && (
                      <div className="truncate text-xs text-slate-500 mt-0.5">
                        {o.reason}
                      </div>
                    )}
                  </div>
                  <div>
                    {o.is_blocked ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                        <CalendarOff className="size-3" />
                        Blocked
                      </span>
                    ) : o.start_time && o.end_time ? (
                      <span className="rounded-full bg-[#2d8a9e]/10 text-[#0c2340] px-3 py-1 text-xs font-semibold tabular-nums">
                        {formatRange12(
                          o.start_time.slice(0, 5),
                          o.end_time.slice(0, 5),
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function SideStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-[#1a4a6e]/40 p-4 rounded-2xl text-center">
      <div className="text-[#5cbdb9] text-xl font-bold tabular-nums" style={FONT_STACK}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-white/60 mt-0.5">
        {label}
      </div>
    </div>
  );
}

// ---------- helpers ----------


function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

function formatHours(totalMinutes: number): string {
  if (!totalMinutes) return "0h";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
