import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Stethoscope,
  ShieldCheck,
  Clock,
  HeartPulse,
  ArrowRight,
  CalendarCheck,
  Users,
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  UserPlus,
  AlertCircle,
} from "lucide-react";

export const Route = createFileRoute("/clinicmanager")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({ meta: [{ title: "Clinic Manager Login — ClinicFlow" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created. You can sign in now.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const redirectMatch = redirect?.match(/^\/([a-z0-9-]+)\/clinicmanager$/i);

        if (redirectMatch) {
          navigate({
            to: "/$slug/clinicmanager",
            params: { slug: redirectMatch[1].toLowerCase() },
          });
        } else {
          navigate({ to: "/app" });
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Authentication failed";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-20 size-[28rem] rounded-full bg-white/10 blur-3xl"
        />

        <div className="relative">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm ring-1 ring-white/25">
              <Stethoscope className="size-5" />
            </span>
            <span className="text-xl font-semibold tracking-tight">ClinicFlow</span>
          </Link>

          <h1 className="mt-16 max-w-md text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            Run your clinic, calmly.
          </h1>
          <p className="mt-4 max-w-md text-base text-primary-foreground/85">
            The manager workspace for your day — doctors, schedules, and every patient booking in
            one place.
          </p>

          <ul className="mt-10 space-y-4">
            {[
              { icon: CalendarCheck, text: "See today's appointments at a glance" },
              { icon: Users, text: "Manage your doctors, staff, and rosters" },
              { icon: ShieldCheck, text: "Approve, reschedule, and notify patients instantly" },
            ].map((item) => (
              <li key={item.text} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
                  <item.icon className="size-4" />
                </span>
                <span className="text-sm text-primary-foreground/90">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative grid grid-cols-3 gap-3 rounded-2xl bg-white/10 p-5 ring-1 ring-white/15 backdrop-blur-sm">
          {[
            { v: "15+", l: "Years" },
            { v: "10k+", l: "Patients" },
            { v: "98%", l: "Success" },
          ].map((s) => (
            <div key={s.l}>
              <div className="text-2xl font-semibold tracking-tight">{s.v}</div>
              <div className="text-xs text-primary-foreground/75">{s.l}</div>
            </div>
          ))}
        </div>
      </aside>

      {/* Auth panel */}
      <main className="flex flex-col px-6 py-8 sm:px-10 lg:px-12">
        {/* Mobile brand */}
        <div className="flex items-center justify-between lg:hidden">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Stethoscope className="size-5" />
            </span>
            ClinicFlow
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            Home
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">
            <div className="mb-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                <ShieldCheck className="size-3.5" />
                Clinic Manager
              </span>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
                {mode === "signin" ? "Welcome back, manager" : "Set up your manager access"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {mode === "signin"
                  ? "Sign in to run your clinic — schedules, doctors, and patient bookings."
                  : "Create your account to start managing your clinic's day-to-day."}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_10px_40px_-20px_oklch(0.55_0.22_265/0.35)] sm:p-8">
              <form onSubmit={onSubmit} className="space-y-4">
                {mode === "signup" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Full name</Label>
                    <div className="relative">
                      <UserIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="name"
                        autoComplete="name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Dr. Jane Doe"
                        className="h-11 pl-9"
                        required
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">Work email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@clinic.com"
                      className="h-11 pl-9"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === "signin" && (
                      <span className="text-xs text-muted-foreground">Min. 6 characters</span>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPw ? "text" : "password"}
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      placeholder="••••••••"
                      className="h-11 pl-9 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? "Hide password" : "Show password"}
                      aria-pressed={showPw}
                      className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {errorMsg && (
                  <div
                    role="alert"
                    aria-live="polite"
                    className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
                  >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <span className="leading-snug">{errorMsg}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="group h-11 w-full rounded-xl text-base shadow-sm"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Please wait…
                    </>
                  ) : mode === "signin" ? (
                    <>
                      <LogIn className="size-4" /> Sign in
                      <ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  ) : (
                    <>
                      <UserPlus className="size-4" /> Create account
                    </>
                  )}
                </Button>
              </form>

              <div className="my-6 flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
                <Separator className="flex-1" />
              </div>

              <button
                type="button"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {mode === "signin" ? (
                  <>
                    First time managing your clinic here?{" "}
                    <span className="font-medium text-primary">Create an account</span>
                  </>
                ) : (
                  <>
                    Already registered? <span className="font-medium text-primary">Sign in</span>
                  </>
                )}
              </button>
            </div>

            {/* Trust chips */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
              {[
                { icon: ShieldCheck, label: "HIPAA-ready" },
                { icon: Clock, label: "24/7 uptime" },
                { icon: HeartPulse, label: "NABH workflows" },
              ].map((c) => (
                <span
                  key={c.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1"
                >
                  <c.icon className="size-3.5 text-primary" />
                  {c.label}
                </span>
              ))}
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Your patients book directly at{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">/your-clinic</code> —
              no account needed for them.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
