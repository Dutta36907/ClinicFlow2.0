import { Loader2, ShieldCheck, Stethoscope } from "lucide-react";

export function ClinicManagerSplash({
  message = "Verifying access…",
}: {
  message?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-50 grid place-items-center bg-background/95 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="relative">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/20">
            <Stethoscope className="size-8" />
          </span>
          <span className="absolute -bottom-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full bg-accent text-accent-foreground ring-2 ring-background">
            <ShieldCheck className="size-3.5" />
          </span>
        </div>
        <div className="space-y-1.5">
          <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
            Clinic Manager
          </h2>
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
