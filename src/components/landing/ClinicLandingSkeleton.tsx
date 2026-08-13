/**
 * Skeleton shown while the /$slug route loader is fetching the clinic,
 * its doctors, and the page content. Wired as `pendingComponent` on the
 * route so users see structure (not a blank screen) during navigation.
 */
import { Skeleton } from "@/components/ui/skeleton";

export function ClinicLandingSkeleton() {
  return (
    <div
      className="min-h-screen bg-background"
      aria-busy="true"
      aria-label="Loading clinic page"
    >
      {/* Header */}
      <div className="border-b border-border/60 bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      {/* Hero */}
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 lg:grid-cols-2 lg:items-center">
        <div className="space-y-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-12 w-11/12" />
          <Skeleton className="h-12 w-9/12" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-10/12" />
          <div className="flex gap-3 pt-2">
            <Skeleton className="h-11 w-36 rounded-md" />
            <Skeleton className="h-11 w-32 rounded-md" />
          </div>
        </div>
        <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
      </div>

      {/* Doctors */}
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Skeleton className="mb-6 h-7 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="space-y-3 rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="size-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
