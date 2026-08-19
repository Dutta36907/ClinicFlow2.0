/**
 * Route: /$slug — public clinic landing page.
 *
 * Thin route shell. All UI lives in `@/components/landing/ClinicLanding`
 * and the booking dialog lives under `@/components/booking/`.
 */
import { createFileRoute, Link, Outlet, useMatches, useRouter } from "@tanstack/react-router";
import { getClinicLanding } from "@/lib/public.functions";
import { Button } from "@/components/ui/button";
import {
  ClinicLanding,
  ClinicUnavailable,
  type LandingClinic,
  type LandingPageContent,
} from "@/components/landing/ClinicLanding";
import { ClinicInactive } from "@/components/landing/ClinicInactive";
import { ClinicExpired } from "@/components/landing/ClinicExpired";
import { ClinicLandingSkeleton } from "@/components/landing/ClinicLandingSkeleton";
import type { Doctor } from "@/components/booking/types";
import { SITE_URL } from "@/lib/site-url";

function truncate(text: string | null | undefined, max: number) {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export const Route = createFileRoute("/$slug")({
  head: ({ params, loaderData }) => {
    const url = `${SITE_URL}/${params.slug}`;
    const clinic = (loaderData as { clinic?: LandingClinic | null } | undefined)?.clinic;
    const name = clinic?.name ?? params.slug;
    const tagline = (clinic as { tagline?: string | null } | undefined)?.tagline?.trim() || "";
    const description =
      truncate(tagline, 160) ||
      truncate(clinic?.description ?? "", 160) ||
      `Book your next appointment online at ${name}.`;
    const title = tagline ? `${name} — ${tagline}` : `Book an appointment — ${name}`;
    const ogImage =
      (clinic as { cover_image_url?: string | null } | undefined)?.cover_image_url ||
      (clinic as { logo_url?: string | null } | undefined)?.logo_url ||
      null;

    const meta: Array<{ title?: string; name?: string; property?: string; content?: string }> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: name },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { name: "twitter:title", content: name },
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
    };
  },
  loader: async ({ params }) => {
    if (!/^[a-z0-9-]+$/i.test(params.slug)) {
      return {
        clinic: null as LandingClinic | null,
        doctors: [] as Doctor[],
        content: { treatments: [], testimonials: [], gallery: [] },
      };
    }
    const res = (await getClinicLanding({ data: { slug: params.slug } })) as {
      clinic: LandingClinic | null;
      doctors: Doctor[];
      content: LandingPageContent;
    };
    return res;
  },
  component: ClinicLandingRoute,
  pendingComponent: ClinicLandingSkeleton,
  pendingMs: 150,
  errorComponent: BookingError,
  notFoundComponent: BookingNotFound,
});

function ClinicLandingRoute() {
  const { slug } = Route.useParams();
  const { clinic, doctors, content } = Route.useLoaderData();
  const matches = useMatches();

  if (matches.some((match) => match.routeId === "/$slug/doctors/$doctorId")) {
    return <Outlet />;
  }

  if (!clinic) {
    return <ClinicUnavailable slug={slug} clinic={clinic} />;
  }
  if (clinic.status === "expired") {
    return (
      <ClinicExpired
        clinic={{ name: clinic.name, logo_url: clinic.logo_url, slug: clinic.slug ?? slug }}
        expiresAt={clinic.expires_at ?? null}
      />
    );
  }
  if (clinic.status === "inactive" || !clinic.is_active) {
    return (
      <ClinicInactive
        clinic={{ name: clinic.name, logo_url: clinic.logo_url, slug: clinic.slug ?? slug }}
      />
    );
  }
  return <ClinicLanding slug={slug} clinic={clinic} doctors={doctors} content={content} />;
}

function BookingError({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
      <div className="max-w-md">
        <h1 className="font-display text-3xl font-semibold">We couldn't load this clinic</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Something went wrong on our end while loading the booking page. Your connection may have
          hiccuped — please try again in a moment.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Go home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function BookingNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-3xl">Clinic not found</h1>
      <p className="text-muted-foreground">This clinic booking page does not exist.</p>
      <Button asChild>
        <Link to="/">Back home</Link>
      </Button>
    </div>
  );
}
