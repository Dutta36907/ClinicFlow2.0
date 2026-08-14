import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapFirstSuperAdmin, getSignupStatus } from "@/lib/superadmin.functions";
import { applyRememberMe } from "@/lib/rememberMe";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/superadmin/login")({
  head: () => ({ meta: [{ title: "Super Admin Login — ClinicFlow" }] }),
  component: LoginPage,
});

const ALLOWED_BOOTSTRAP_EMAIL = "priyabrata.dutta.slg@gmail.com";

function LoginPage() {
  const navigate = useNavigate();
  const fetchStatus = useServerFn(getSignupStatus);
  const bootstrapFn = useServerFn(bootstrapFirstSuperAdmin);

  const statusQ = useQuery({
    queryKey: ["sa-signup-status"],
    queryFn: () => fetchStatus(),
    staleTime: 30_000,
  });

  // bootstrapMode === true iff zero super admins exist. Once one exists,
  // this becomes false forever and the setup card is unreachable.
  const bootstrapMode = !!statusQ.data?.bootstrapMode;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mode: "signin" | "setup" = bootstrapMode ? "setup" : "signin";

  // In setup mode, the bootstrap email is fixed by policy.
  useEffect(() => {
    if (bootstrapMode) setEmail(ALLOWED_BOOTSTRAP_EMAIL);
    setErrorMsg(null);
  }, [bootstrapMode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      if (mode === "setup") {
        const res = await bootstrapFn({
          data: { email, password, fullName },
        });
        if (!res.bootstrapped) {
          throw new Error(
            "Setup is no longer available — a platform admin already exists. Please sign in.",
          );
        }
        // Auto sign-in with the new credentials.
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) throw signInErr;
        applyRememberMe(rememberMe);
        toast.success("Platform admin created. Welcome!");
        navigate({ to: "/superadmin" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        applyRememberMe(rememberMe);
        navigate({ to: "/superadmin" });
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
            The whole platform, one console.
          </h1>
          <p className="mt-4 max-w-md text-base text-primary-foreground/85">
            Onboard clinics, assign managers, and keep every tenant healthy from a single super
            admin workspace.
          </p>

          <ul className="mt-10 space-y-4">
            {[
              { icon: CalendarCheck, text: "Provision new clinics in seconds" },
              { icon: Users, text: "Oversee every manager, doctor, and booking" },
              { icon: ShieldCheck, text: "Platform-wide audit log and access control" },
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
      <main className="flex flex-col px-4 py-6 sm:px-8 sm:py-8 lg:px-12">
        {/* Mobile brand */}
        <div className="flex items-center justify-between lg:hidden">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Stethoscope className="size-5" />
            </span>
            ClinicFlow
          </Link>
          <Link
            to="/clinicmanager"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Users className="size-3.5" /> Manager
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-6 sm:py-10">
          <div className="w-full max-w-md">
            <div className="mb-5 sm:mb-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                {mode === "setup" ? (
                  <>
                    <Sparkles className="size-3.5" /> First-time setup
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-3.5" /> Super Admin
                  </>
                )}
              </span>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {mode === "signin" ? "Sign in to the platform" : "Create the platform admin"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {mode === "signin"
                  ? "Restricted access. For platform operators only."
                  : "No platform admin exists yet. This one-time form creates the first one — after that, this setup screen is permanently disabled."}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_10px_40px_-20px_oklch(0.55_0.22_265/0.35)] sm:p-7">
              <form onSubmit={onSubmit} className="space-y-4">
                {mode === "setup" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Full name</Label>
                    <div className="relative">
                      <UserIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Jane Doe"
                        className="h-11 pl-9"
                        required
                        minLength={2}
                        maxLength={120}
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
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@clinicflow.com"
                      className="h-11 pl-9"
                      required
                      readOnly={mode === "setup"}
                      aria-readonly={mode === "setup"}
                    />
                  </div>
                  {mode === "setup" && (
                    <p className="text-xs text-muted-foreground">
                      The first platform admin is restricted to this email by policy.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <span className="text-xs text-muted-foreground">
                      {mode === "setup" ? "Min. 12 characters" : "Min. 6 characters"}
                    </span>
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPw ? "text" : "password"}
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={mode === "setup" ? 12 : 6}
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

                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
                  <Checkbox
                    checked={rememberMe}
                    onCheckedChange={(v) => setRememberMe(v === true)}
                  />
                  <span>
                    Remember me
                    <span className="ml-1 text-xs text-muted-foreground/70">
                      (stay signed in across browser restarts)
                    </span>
                  </span>
                </label>

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
                  disabled={loading || statusQ.isLoading}
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
                      <UserPlus className="size-4" /> Create platform admin
                    </>
                  )}
                </Button>
              </form>

              {mode === "setup" && (
                <>
                  <Separator className="my-5 sm:my-6" />
                  <p className="text-center text-xs text-muted-foreground">
                    This screen disappears the moment the first admin is created.
                  </p>
                </>
              )}
            </div>

            {/* Trust chips */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground sm:mt-6">
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
              Clinic manager? Sign in at{" "}
              <Link to="/clinicmanager" className="font-medium text-primary hover:underline">
                /clinicmanager
              </Link>
              .
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
