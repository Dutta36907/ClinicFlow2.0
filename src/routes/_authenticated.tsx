import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useAuth, signOut } from "@/hooks/useAuth";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Stethoscope, LogOut } from "lucide-react";
import { AppLoadingSplash } from "@/components/common/AppLoadingSplash";
import { markInactivityLogout } from "@/lib/logout-reason";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import { InactivityWarningDialog } from "@/components/InactivityWarningDialog";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading, isSuperAdmin, managedClinics, userClinics } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const { warningOpen, secondsLeft, stayActive } = useInactivityLogout({
    enabled: !loading && !!user,
    onTimeout: () => {
      markInactivityLogout();
      void signOut();
    },
  });

  if (loading || !user) {
    return <AppLoadingSplash message="Verifying your session…" delayMs={0} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2 font-display text-lg">
            <Stethoscope className="size-5 text-primary" /> ClinicFlow
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            {isSuperAdmin && (
              <Link to="/superadmin">
                <Button variant="ghost" size="sm">
                  Super Admin
                </Button>
              </Link>
            )}
            {managedClinics.length + userClinics.length > 0 && (
              <Link to="/app">
                <Button variant="ghost" size="sm">
                  My clinics
                </Button>
              </Link>
            )}
            <span className="hidden text-muted-foreground sm:inline">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="size-4" />
            </Button>
          </nav>
        </div>
      </header>
      <Outlet />
      <InactivityWarningDialog
        open={warningOpen}
        secondsLeft={secondsLeft}
        onStayActive={stayActive}
      />
    </div>
  );
}
