import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { assertLoginRateLimit, assertSignupRateLimit } from "@/lib/login-rate-limit.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  UserPlus,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

export function ClinicManagerLoginForm({
  onSignedIn,
  defaultMode = "signin",
}: {
  onSignedIn?: () => void;
  defaultMode?: "signin" | "signup";
}) {
  const [mode, setMode] = useState<"signin" | "signup">(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const rateLimitLoginFn = useServerFn(assertLoginRateLimit);
  const rateLimitSignupFn = useServerFn(assertSignupRateLimit);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      if (mode === "signup") {
        await rateLimitSignupFn();
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
        await rateLimitLoginFn({ data: { email } });
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSignedIn?.();
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
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_10px_40px_-20px_oklch(0.55_0.22_265/0.35)] sm:p-8">
      <form onSubmit={onSubmit} className="space-y-4">
        {mode === "signup" && (
          <div className="space-y-1.5">
            <Label htmlFor="cm-name">Full name</Label>
            <div className="relative">
              <UserIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="cm-name"
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
          <Label htmlFor="cm-email">Work email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="cm-email"
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
            <Label htmlFor="cm-password">Password</Label>
            {mode === "signin" && (
              <span className="text-xs text-muted-foreground">Min. 6 characters</span>
            )}
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="cm-password"
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
  );
}
