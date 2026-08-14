import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Stethoscope, ArrowRight, Shield } from "lucide-react";
import { AppLoadingSplash } from "@/components/common/AppLoadingSplash";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppHome,
});

function AppHome() {
  const auth = useAuth();
  if (auth.loading) {
    return <AppLoadingSplash message="Loading your clinics…" delayMs={0} />;
  }
  return <AppHomeInner />;
}

function AppHomeInner() {
  const { user, isSuperAdmin, managedClinics, userClinics, loading } = useAuth();
  const clinicIds = Array.from(new Set([...managedClinics, ...userClinics]));

  const clinicsQ = useQuery({
    queryKey: ["my-clinics", clinicIds.join(",")],
    queryFn: async () => {
      if (clinicIds.length === 0) return [];
      const { data } = await supabase
        .from("clinics")
        .select("id, name, slug, address")
        .in("id", clinicIds);
      return data ?? [];
    },
    enabled: !loading,
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-3xl">
        Welcome{user?.email ? `, ${user.email.split("@")[0]}` : ""}
      </h1>
      <p className="mt-1 text-muted-foreground">Choose where to go.</p>

      <div className="mt-8 grid gap-3">
        {isSuperAdmin && (
          <Link
            to="/superadmin"
            className="flex items-center justify-between rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-primary"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Shield className="size-5" />
              </div>
              <div>
                <div className="font-medium">Super Admin</div>
                <div className="text-sm text-muted-foreground">
                  Manage all clinics on the platform
                </div>
              </div>
            </div>
            <ArrowRight className="size-4 text-muted-foreground" />
          </Link>
        )}

        {clinicsQ.data?.map((c) => (
          <Link
            key={c.id}
            to="/$slug/clinicmanager"
            params={{ slug: c.slug }}
            className="flex items-center justify-between rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-primary"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Stethoscope className="size-5" />
              </div>
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-sm text-muted-foreground">
                  /{c.slug}
                  {c.address && ` · ${c.address}`}
                </div>
              </div>
            </div>
            <ArrowRight className="size-4 text-muted-foreground" />
          </Link>
        ))}

        {!isSuperAdmin && clinicsQ.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            You don't have access to any clinic yet. Ask a Super Admin to assign you.
          </p>
        )}
      </div>
    </main>
  );
}
