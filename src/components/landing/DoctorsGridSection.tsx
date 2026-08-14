/**
 * DoctorsGridSection — "Meet Our Doctors" block rendered above the
 * footer on the public clinic landing page. Layout adapts to 1, 2,
 * or many doctors so the section never looks sparse.
 */
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, CalendarCheck, GraduationCap, Award, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Doctor } from "@/components/booking/types";

type Props = {
  doctors: Doctor[];
  slug: string;
  onBook: (doctor: Doctor) => void;
};

export function DoctorsGridSection({ doctors, slug, onBook }: Props) {
  if (!doctors || doctors.length === 0) return null;

  const count = doctors.length;
  const isSingle = count === 1;

  const gridClasses = isSingle
    ? "mx-auto max-w-2xl"
    : count === 2
      ? "mx-auto grid max-w-4xl gap-6 sm:grid-cols-2"
      : "grid gap-6 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="border-t border-border bg-muted/20 py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-14">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Our Team
          </span>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Meet Our Doctors
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Experienced specialists dedicated to your care. Book a visit with the doctor that's
            right for you.
          </p>
        </div>

        {/* Cards */}
        <div className={gridClasses}>
          {doctors.map((d) =>
            isSingle ? (
              <SpotlightCard key={d.id} doctor={d} slug={slug} onBook={onBook} />
            ) : (
              <DoctorCard key={d.id} doctor={d} slug={slug} onBook={onBook} />
            ),
          )}
        </div>
      </div>
    </section>
  );
}

function Avatar({
  doctor,
  className,
  iconClassName,
}: {
  doctor: Doctor;
  className?: string;
  iconClassName?: string;
}) {
  if (doctor.photo_url) {
    return (
      <img src={doctor.photo_url} alt={doctor.name} className={cn("object-cover", className)} />
    );
  }
  return (
    <div className={cn("flex items-center justify-center bg-primary/10 text-primary", className)}>
      <Stethoscope className={cn("size-8", iconClassName)} />
    </div>
  );
}

function DoctorCard({
  doctor,
  slug,
  onBook,
}: {
  doctor: Doctor;
  slug: string;
  onBook: (d: Doctor) => void;
}) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        <Avatar
          doctor={doctor}
          className="size-full transition duration-500 group-hover:scale-[1.03]"
          iconClassName="size-14"
        />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="font-display text-lg font-semibold leading-tight">{doctor.name}</h3>
          {doctor.specialization && (
            <p className="mt-0.5 text-sm text-muted-foreground">{doctor.specialization}</p>
          )}
        </div>

        {(doctor.degree || doctor.years_experience != null) && (
          <div className="flex flex-wrap gap-1.5">
            {doctor.degree && (
              <Badge variant="secondary" className="gap-1 text-[11px]">
                <GraduationCap className="size-3" />
                {doctor.degree}
              </Badge>
            )}
            {doctor.years_experience != null && (
              <Badge variant="secondary" className="gap-1 text-[11px]">
                <Award className="size-3" />
                {doctor.years_experience}+ yrs exp
              </Badge>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" className="w-full gap-2 sm:flex-1">
            <Link to="/$slug/doctors/$doctorId" params={{ slug, doctorId: doctor.id }}>
              <UserRound className="size-4" />
              View profile
            </Link>
          </Button>
          <Button className="w-full gap-2 sm:flex-1" onClick={() => onBook(doctor)}>
            <CalendarCheck className="size-4" />
            Book
          </Button>
        </div>
      </div>
    </article>
  );
}

function SpotlightCard({
  doctor,
  slug,
  onBook,
}: {
  doctor: Doctor;
  slug: string;
  onBook: (d: Doctor) => void;
}) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition hover:border-primary/40 hover:shadow-md sm:flex-row">
      <div className="relative aspect-square w-full overflow-hidden bg-muted sm:w-56 sm:shrink-0">
        <Avatar
          doctor={doctor}
          className="size-full transition duration-500 group-hover:scale-[1.03]"
          iconClassName="size-16"
        />
      </div>

      <div className="flex flex-1 flex-col gap-4 p-6 sm:p-7">
        <div>
          <h3 className="font-display text-2xl font-semibold leading-tight">{doctor.name}</h3>
          {doctor.specialization && (
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              {doctor.specialization}
            </p>
          )}
        </div>

        {doctor.description && (
          <p className="line-clamp-3 text-sm text-muted-foreground">{doctor.description}</p>
        )}

        {(doctor.degree || doctor.years_experience != null) && (
          <div className="flex flex-wrap gap-1.5">
            {doctor.degree && (
              <Badge variant="secondary" className="gap-1 text-[11px]">
                <GraduationCap className="size-3" />
                {doctor.degree}
              </Badge>
            )}
            {doctor.years_experience != null && (
              <Badge variant="secondary" className="gap-1 text-[11px]">
                <Award className="size-3" />
                {doctor.years_experience}+ yrs exp
              </Badge>
            )}
          </div>
        )}

        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:self-start">
          <Button asChild size="lg" variant="outline" className="gap-2">
            <Link to="/$slug/doctors/$doctorId" params={{ slug, doctorId: doctor.id }}>
              <UserRound className="size-4" />
              View profile
            </Link>
          </Button>
          <Button size="lg" className="gap-2" onClick={() => onBook(doctor)}>
            <CalendarCheck className="size-4" />
            Book
          </Button>
        </div>
      </div>
    </article>
  );
}
