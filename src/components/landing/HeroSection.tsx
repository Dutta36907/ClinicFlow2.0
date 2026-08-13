import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroDashboard from "@/assets/hero-dashboard.jpg";

export function HeroSection({
  onPrimary,
  onSecondary,
}: {
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, color-mix(in oklab, var(--primary) 18%, transparent), transparent 70%)",
        }}
      />
      <div className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center sm:pt-28 sm:pb-24">
        <span className="inline-flex animate-fade-in items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
          <Sparkles className="size-3.5 text-primary" aria-hidden />
          Built for modern clinics
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl animate-fade-in text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
          Run your clinic with{" "}
          <span className="bg-gradient-to-r from-primary to-[color-mix(in_oklab,var(--primary)_55%,white)] bg-clip-text text-transparent">
            calm, modern software.
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl animate-fade-in text-pretty text-base text-muted-foreground sm:text-lg">
          Publish a branded booking page, manage doctors and schedules, and accept verified
          appointments online — without juggling calls, spreadsheets, or no-shows.
        </p>
        <div className="mt-9 flex animate-fade-in flex-wrap justify-center gap-3">
          <Button size="lg" onClick={onPrimary} className="group">
            Request Demo
            <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
          <Button size="lg" variant="outline" onClick={onSecondary}>
            Sign Up
          </Button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Trusted by clinics across India · No credit card required
        </p>

        <div className="relative mx-auto mt-16 max-w-5xl animate-scale-in">
          <div
            aria-hidden
            className="absolute -inset-6 -z-10 rounded-[2rem] blur-2xl"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in oklab, var(--primary) 25%, transparent), transparent 60%)",
            }}
          />
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl ring-1 ring-border/40 transition-transform duration-500 hover:-translate-y-1">
            <img
              src={heroDashboard}
              alt="Clinic appointment dashboard preview"
              width={1536}
              height={1024}
              className="h-auto w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
