import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { signOutSuperAdmin } from "@/lib/superadminAuth";

export const Route = createFileRoute("/superadmin/logout")({
  head: () => ({ meta: [{ title: "Signing out…" }] }),
  component: LogoutPage,
});

function LogoutPage() {
  useEffect(() => {
    void signOutSuperAdmin();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Signing you out…</p>
    </div>
  );
}
