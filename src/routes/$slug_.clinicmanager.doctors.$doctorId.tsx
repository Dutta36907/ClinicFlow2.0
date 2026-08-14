import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Award,
  CalendarClock,
  CalendarOff,
  Clock,
  ExternalLink,
  Languages as LanguagesIcon,
  MapPin,
  Phone,
  Mail,
  Sparkles,
  Stethoscope,
  Timer,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatRange12 } from "@/lib/clinic-time";
import { WEEKDAY_LABELS } from "@/lib/doctor-slots";

function ClinicManagerDoctorErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-md p-10 text-center">
      <h1 className="font-display text-2xl">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
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
}

export const Route = createFileRoute("/$slug_/clinicmanager/doctors/$doctorId")({
  head: ({ params }) => ({
    meta: [{ title: `Doctor profile — ${params.slug}` }],
  }),
  errorComponent: ClinicManagerDoctorErrorComponent,
  notFoundComponent: () => (
    <div className="mx-auto max-w-md p-10 text-center">
      <h1 className="font-display text-2xl">Doctor not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This doctor doesn't exist or isn't part of this clinic.
      </p>
    </div>
  ),
  component: DoctorProfilePage,
});

type Doctor = {
  id: string;
  clinic_id: string;
  name: string;
  degree: string | null;
  photo_url: string | null;
  description: string | null;
  years_experience: number | null;
  specialization: string | null;
  is_active: boolean;
  appointment_duration_minutes: number;
  specialties: string[] | null;
  languages: string[] | null;
};

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

type Clinic = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  google_map_url: string | null;
};

const FONT_STACK = {
  fontFamily: '"Sora", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
} as const;
const BODY_STACK = {
  fontFamily: '"Manrope", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
} as const;

function DoctorProfilePage() {
  const { slug, doctorId } = Route.useParams();
  const [sessionReady, setSessionReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      setHasSession(!!data.user && !error);
      setSessionReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const clinicQ = useQuery({
    queryKey: ["clinic-by-slug-profile", slug],
    enabled: hasSession,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinics")
        .select("id, name, slug, phone, email, address, google_map_url")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data as Clinic | null;
    },
  });

  const clinicId = clinicQ.data?.id ?? null;

  const doctorQ = useQuery({
    queryKey: ["doctor", doctorId, clinicId],
    enabled: !!clinicId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select(
          "id, clinic_id, name, degree, photo_url, description, years_experience, specialization, is_active, appointment_duration_minutes, specialties, languages",
        )
        .eq("id", doctorId)
        .eq("clinic_id", clinicId!)
        .maybeSingle();
      if (error) throw error;
      return data as Doctor | null;
    },
  });

  const schedulesQ = useQuery({
    queryKey: ["doctor-schedules", doctorId],
    enabled: !!doctorQ.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctor_schedules")
        .select("id, weekday, start_time, end_time, is_active")
        .eq("doctor_id", doctorId)
        .order("weekday", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Schedule[];
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const overridesQ = useQuery({
    queryKey: ["doctor-overrides", doctorId, today],
    enabled: !!doctorQ.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctor_slot_overrides")
        .select("id, date, start_time, end_time, is_blocked, reason")
        .eq("doctor_id", doctorId)
        .gte("date", today)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Override[];
    },
  });

  const apptsQ = useQuery({
    queryKey: ["doctor-upcoming-appts", doctorId],
    enabled: !!doctorQ.data,
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error, count } = await supabase
        .from("appointments")
        .select("id, patient_name, scheduled_at, status", { count: "exact" })
        .eq("doctor_id", doctorId)
        .gte("scheduled_at", now)
        .neq("status", "cancelled")
        .order("scheduled_at", { ascending: true })
        .limit(5);
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

  if (!sessionReady || clinicQ.isLoading) return <PageSkeleton />;

  if (!hasSession) {
    return (
      <Centered>
        <h1 className="font-display text-2xl" style={FONT_STACK}>
          Sign in required
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Please sign in to view doctor profiles.
        </p>
        <Button asChild className="mt-4">
          <Link to="/$slug_/clinicmanager" params={{ slug }}>
            Go to login
          </Link>
        </Button>
      </Centered>
    );
  }

  if (!clinicQ.data) {
    return (
      <Centered>
        <h1 className="font-display text-2xl" style={FONT_STACK}>
          Clinic not found
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">No clinic at /{slug}.</p>
      </Centered>
    );
  }

  if (doctorQ.isLoading) return <PageSkeleton />;

  const doctor = doctorQ.data;
  if (!doctor) {
    return (
      <Centered>
        <h1 className="font-display text-2xl" style={FONT_STACK}>
          Doctor not found
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">This doctor isn't part of /{slug}.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/$slug_/clinicmanager" params={{ slug }}>
            <ArrowLeft className="mr-2 size-4" /> Back to dashboard
          </Link>
        </Button>
      </Centered>
    );
  }

  const clinic = clinicQ.data;
  const schedules = schedulesQ.data ?? [];
  const overrides = overridesQ.data ?? [];

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

  // specialties[] preferred; fall back to legacy single specialization
  const specialtyChips =
    doctor.specialties && doctor.specialties.length > 0
      ? doctor.specialties
      : doctor.specialization
        ? [doctor.specialization]
        : [];
  const languageChips = doctor.languages ?? [];

  const mapsHref =
    clinic.google_map_url ??
    (clinic.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinic.address)}`
      : null);

  return (
    <div className="min-h-screen bg-[#f4f7fb]" style={BODY_STACK}>
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Back nav */}
        <div className="mb-5 flex items-center justify-between">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="gap-2 text-ocean-deep hover:bg-ocean-light/15 hover:text-ocean-ink"
          >
            <Link to="/$slug_/clinicmanager" params={{ slug }}>
              <ArrowLeft className="size-4" />
              Back to {clinic.name}
            </Link>
          </Button>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            /{clinic.slug}/doctors/{doctor.id.slice(0, 8)}
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start">
          {/* ============================================================ */}
          {/* LEFT: identity rail                                          */}
          {/* ============================================================ */}
          <aside className="lg:sticky lg:top-6">
            <div className="relative overflow-hidden rounded-3xl text-white shadow-[0_30px_60px_-30px_rgba(12,35,64,0.55)]">
              <div className="absolute inset-0 bg-gradient-to-br from-[#0c2340] via-[#13365a] to-[#1a4a6e]" />
              <div className="absolute -right-20 -top-24 size-72 rounded-full bg-[#2d8a9e]/30 blur-3xl" />
              <div className="absolute -left-16 bottom-0 size-56 rounded-full bg-[#5cbdb9]/20 blur-3xl" />

              <div className="relative flex flex-col items-center gap-5 px-6 pb-7 pt-9 text-center">
                {doctor.photo_url ? (
                  <img
                    src={doctor.photo_url}
                    alt={doctor.name}
                    className="size-32 rounded-full object-cover ring-4 ring-white/90 shadow-2xl"
                  />
                ) : (
                  <div
                    className="flex size-32 items-center justify-center rounded-full text-4xl font-semibold text-white ring-4 ring-white/90 shadow-2xl"
                    style={{
                      background: "linear-gradient(135deg, #2d8a9e 0%, #5cbdb9 100%)",
                      ...FONT_STACK,
                    }}
                  >
                    {doctor.name.slice(0, 1).toUpperCase()}
                  </div>
                )}

                <div className="space-y-1">
                  <h1
                    className="text-2xl font-semibold tracking-tight sm:text-3xl"
                    style={FONT_STACK}
                  >
                    {doctor.name}
                  </h1>
                  {doctor.degree && <p className="text-sm text-white/70">{doctor.degree}</p>}
                </div>

                <StatusPill active={doctor.is_active} />

                <div className="grid w-full grid-cols-3 gap-2 pt-2 text-left">
                  <MetaTile
                    icon={<Award className="size-4" />}
                    label="Experience"
                    value={doctor.years_experience != null ? `${doctor.years_experience} yr` : "—"}
                  />
                  <MetaTile
                    icon={<Timer className="size-4" />}
                    label="Slot"
                    value={`${doctor.appointment_duration_minutes}m`}
                  />
                  <MetaTile
                    icon={<Clock className="size-4" />}
                    label="Weekly"
                    value={formatHours(weeklyMinutes)}
                  />
                </div>

                <div className="flex w-full flex-col gap-2 pt-2">
                  <Button
                    asChild
                    size="sm"
                    className="w-full bg-[#2d8a9e] text-white hover:bg-[#2d8a9e]/90"
                  >
                    <Link to="/$slug_/clinicmanager" params={{ slug }}>
                      Manage in dashboard
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="w-full border-white/25 bg-white/5 text-white hover:bg-white/15 hover:text-white"
                  >
                    <Link to="/$slug" params={{ slug }}>
                      View public page
                      <ExternalLink className="ml-1.5 size-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </aside>

          {/* ============================================================ */}
          {/* RIGHT: detail stack                                          */}
          {/* ============================================================ */}
          <div className="space-y-5">
            {/* About */}
            <Section title="About" icon={<Sparkles className="size-4" />} delay={0}>
              {doctor.description ? (
                <p className="whitespace-pre-line text-sm leading-relaxed text-[#1f2a44]/90">
                  {doctor.description}
                </p>
              ) : (
                <EmptyLine>
                  No bio added yet. Add a short description so patients learn about{" "}
                  {doctor.name.split(" ")[0]}.
                </EmptyLine>
              )}
            </Section>

            {/* Specialties */}
            <Section title="Specialties" icon={<Stethoscope className="size-4" />} delay={60}>
              {specialtyChips.length === 0 ? (
                <EmptyLine>No specialties listed yet.</EmptyLine>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {specialtyChips.map((s, i) => (
                    <span
                      key={`${s}-${i}`}
                      className="rounded-full border border-[#2d8a9e]/25 bg-[#2d8a9e]/10 px-3 py-1 text-xs font-medium text-[#0c2340]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </Section>

            {/* Languages (hidden when empty to keep page tight) */}
            {languageChips.length > 0 && (
              <Section
                title="Languages spoken"
                icon={<LanguagesIcon className="size-4" />}
                delay={120}
              >
                <div className="flex flex-wrap gap-2">
                  {languageChips.map((l, i) => (
                    <span
                      key={`${l}-${i}`}
                      className="rounded-full border border-[#5cbdb9]/30 bg-[#5cbdb9]/15 px-3 py-1 text-xs font-medium text-[#0c2340]"
                    >
                      {l}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Clinic */}
            <Section title="Clinic" icon={<MapPin className="size-4" />} delay={180}>
              <div className="space-y-3">
                <div className="text-base font-semibold text-[#0c2340]" style={FONT_STACK}>
                  {clinic.name}
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  {clinic.phone && (
                    <a
                      href={`tel:${clinic.phone}`}
                      className="flex items-center gap-2 rounded-lg border border-[#0c2340]/8 bg-[#f4f7fb] px-3 py-2 text-[#1a4a6e] transition-colors hover:border-[#2d8a9e]/40 hover:bg-white"
                    >
                      <Phone className="size-4 text-[#2d8a9e]" />
                      <span className="truncate">{clinic.phone}</span>
                    </a>
                  )}
                  {clinic.email && (
                    <a
                      href={`mailto:${clinic.email}`}
                      className="flex items-center gap-2 rounded-lg border border-[#0c2340]/8 bg-[#f4f7fb] px-3 py-2 text-[#1a4a6e] transition-colors hover:border-[#2d8a9e]/40 hover:bg-white"
                    >
                      <Mail className="size-4 text-[#2d8a9e]" />
                      <span className="truncate">{clinic.email}</span>
                    </a>
                  )}
                  {clinic.address && (
                    <a
                      href={mapsHref ?? "#"}
                      target={mapsHref ? "_blank" : undefined}
                      rel={mapsHref ? "noreferrer" : undefined}
                      className="flex items-start gap-2 rounded-lg border border-[#0c2340]/8 bg-[#f4f7fb] px-3 py-2 text-[#1a4a6e] transition-colors hover:border-[#2d8a9e]/40 hover:bg-white sm:col-span-2"
                    >
                      <MapPin className="mt-0.5 size-4 shrink-0 text-[#2d8a9e]" />
                      <span className="text-sm">{clinic.address}</span>
                    </a>
                  )}
                  {!clinic.phone && !clinic.email && !clinic.address && (
                    <EmptyLine>No clinic contact info available.</EmptyLine>
                  )}
                </div>
              </div>
            </Section>

            {/* Weekly availability */}
            <Section
              title="Weekly availability"
              icon={<CalendarClock className="size-4" />}
              delay={240}
              right={
                <span className="text-xs font-medium text-[#1a4a6e]">
                  {formatHours(weeklyMinutes)} / week
                </span>
              }
            >
              {schedulesQ.isLoading ? (
                <SkeletonRows count={7} />
              ) : (
                <div className="grid gap-2">
                  {dayOrder.map((wd) => {
                    const list = (byWeekday.get(wd) ?? [])
                      .slice()
                      .sort((a, b) => a.start_time.localeCompare(b.start_time));
                    const active = list.filter((s) => s.is_active);
                    const isToday = wd === new Date().getDay();
                    return (
                      <div
                        key={wd}
                        className={
                          "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors " +
                          (isToday
                            ? "border-[#2d8a9e]/35 bg-[#5cbdb9]/10"
                            : "border-[#0c2340]/8 bg-white")
                        }
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={
                              "flex size-10 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold tracking-wide " +
                              (isToday ? "bg-[#0c2340] text-white" : "bg-[#f4f7fb] text-[#1a4a6e]")
                            }
                            style={FONT_STACK}
                          >
                            {WEEKDAY_LABELS[wd].slice(0, 3).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-[#0c2340]">
                              {WEEKDAY_LABELS[wd]}
                              {isToday && (
                                <span className="ml-2 rounded-full bg-[#5cbdb9]/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#0c2340]">
                                  Today
                                </span>
                              )}
                            </div>
                            {list.length === 0 && (
                              <div className="text-xs text-muted-foreground">Unavailable</div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {list.length === 0 && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                          {list.map((s) => (
                            <span
                              key={s.id}
                              className={
                                "rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums " +
                                (s.is_active
                                  ? "border-[#2d8a9e]/25 bg-[#2d8a9e]/10 text-[#0c2340]"
                                  : "border-[#0c2340]/10 bg-[#f4f7fb] text-muted-foreground line-through opacity-70")
                              }
                            >
                              {formatRange12(s.start_time.slice(0, 5), s.end_time.slice(0, 5))}
                            </span>
                          ))}
                          {list.length > 0 && active.length === 0 && (
                            <span className="rounded-full border border-[#0c2340]/10 bg-[#f4f7fb] px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              paused
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* Time off & overrides */}
            <Section
              title="Upcoming time off & overrides"
              icon={<CalendarOff className="size-4" />}
              delay={300}
            >
              {overridesQ.isLoading ? (
                <SkeletonRows count={3} />
              ) : overrides.length === 0 ? (
                <EmptyLine>
                  No upcoming overrides. {doctor.name.split(" ")[0]}'s weekly schedule applies.
                </EmptyLine>
              ) : (
                <ul className="divide-y divide-[#0c2340]/8">
                  {overrides.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[#0c2340]">
                          {formatDate(o.date)}
                        </div>
                        {o.reason && (
                          <div className="truncate text-xs text-muted-foreground">{o.reason}</div>
                        )}
                      </div>
                      <div>
                        {o.is_blocked ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-700">
                            <CalendarOff className="size-3" />
                            Blocked
                          </span>
                        ) : o.start_time && o.end_time ? (
                          <span className="rounded-full border border-[#2d8a9e]/25 bg-[#2d8a9e]/10 px-2.5 py-1 text-xs font-medium tabular-nums text-[#0c2340]">
                            {formatRange12(o.start_time.slice(0, 5), o.end_time.slice(0, 5))}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* Next appointments */}
            <Section
              title="Next appointments"
              icon={<CalendarClock className="size-4" />}
              delay={360}
              right={
                <span className="text-xs font-medium text-[#1a4a6e]">
                  {apptsQ.data?.count ?? 0} upcoming
                </span>
              }
            >
              {apptsQ.isLoading ? (
                <SkeletonRows count={3} />
              ) : (apptsQ.data?.rows.length ?? 0) === 0 ? (
                <EmptyLine>No upcoming appointments scheduled.</EmptyLine>
              ) : (
                <ul className="divide-y divide-[#0c2340]/8">
                  {apptsQ.data!.rows.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-[#0c2340]">
                          {a.patient_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateTime(a.scheduled_at)}
                        </div>
                      </div>
                      <span className="rounded-full border border-[#0c2340]/10 bg-[#f4f7fb] px-2.5 py-1 text-xs font-medium capitalize text-[#1a4a6e]">
                        {a.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Building blocks
// ----------------------------------------------------------------------------

function Section({
  title,
  icon,
  right,
  delay = 0,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  right?: React.ReactNode;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <section
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 rounded-2xl border border-[#0c2340]/8 bg-white p-5 shadow-[0_8px_24px_-18px_rgba(12,35,64,0.45)] transition-shadow duration-300 hover:shadow-[0_12px_30px_-18px_rgba(12,35,64,0.55)] sm:p-6"
      style={{ animationDelay: `${delay}ms`, animationDuration: "500ms" }}
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-[#2d8a9e]/10 text-[#2d8a9e]">
            {icon}
          </span>
          <h2 className="text-base font-semibold tracking-tight text-[#0c2340]" style={FONT_STACK}>
            {title}
          </h2>
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium " +
        (active
          ? "border-[#5cbdb9]/40 bg-[#5cbdb9]/15 text-white"
          : "border-white/20 bg-white/5 text-white/70")
      }
    >
      <span
        className={
          "size-2 rounded-full " +
          (active ? "bg-[#5cbdb9] motion-safe:animate-pulse" : "bg-white/40")
        }
      />
      {active ? "Accepting bookings" : "Inactive"}
    </span>
  );
}

function MetaTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/60">
        <span className="text-[#5cbdb9]">{icon}</span>
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-white" style={FONT_STACK}>
        {value}
      </div>
    </div>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-[#0c2340]/5" />
      ))}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md p-10 text-center" style={BODY_STACK}>
      {children}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10" style={BODY_STACK}>
      <div className="h-8 w-40 animate-pulse rounded-md bg-[#0c2340]/8" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="h-[420px] animate-pulse rounded-3xl bg-[#0c2340]/8" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-[#0c2340]/5" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Pure helpers
// ----------------------------------------------------------------------------

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

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
