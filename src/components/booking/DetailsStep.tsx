/**
 * Booking — Step 3: Patient details
 * Collects name + phone (required) and email + notes (optional), then
 * triggers an OTP send to the phone number.
 *
 * UI v2: required markers, inline validation hints, autocomplete
 * attributes, larger inputs, submit-loader, and an Enter-to-continue
 * affordance.
 */
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Mail, MessageSquare, Phone, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requestPatientOtp, requestOnScreenOtp } from "@/lib/public.functions";
import { getOrCreateBookingSessionId } from "@/lib/booking/session";
import { BackBtn } from "./parts";
import type { OtpProvider, PatientForm } from "./types";

// Minimal phone validation: 7-15 digits after stripping symbols.
function isValidPhone(p: string) {
  const digits = p.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}
function isValidEmail(e: string) {
  if (!e) return true; // optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export function DetailsStep({
  clinicId,
  patient,
  setPatient,
  otpProvider,
  onCodeIssued,
  onDevCodeIssued,
  onBack,
  onNext,
}: {
  clinicId: string;
  patient: PatientForm;
  setPatient: (p: PatientForm) => void;
  otpProvider: OtpProvider;
  onCodeIssued: (code: string) => void;
  onDevCodeIssued: (code: string | null) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const sendSmsOtp = useServerFn(requestPatientOtp);
  const sendScreenOtp = useServerFn(requestOnScreenOtp);
  const [submitting, setSubmitting] = useState(false);
  const [consent, setConsent] = useState(false);
  const [touched, setTouched] = useState<{ name?: boolean; phone?: boolean; email?: boolean }>({});

  const errors = useMemo(() => {
    return {
      name: !patient.name.trim() ? "Please enter your full name." : null,
      phone: !patient.phone.trim()
        ? "Phone number is required."
        : !isValidPhone(patient.phone)
          ? "Enter a valid phone number with country code."
          : null,
      email: !isValidEmail(patient.email) ? "That email doesn't look right." : null,
    };
  }, [patient]);

  const canContinue = !errors.name && !errors.phone && !errors.email && consent && !submitting;

  async function continueToVerify() {
    setTouched({ name: true, phone: true, email: true });
    if (!canContinue) return;
    setSubmitting(true);
    try {
      if (otpProvider === "on_screen") {
        const sessionId = getOrCreateBookingSessionId();
        const res = await sendScreenOtp({
          data: { phone: patient.phone, sessionId, clinicId },
        });
        onCodeIssued(res.code);
        toast.success("Your verification code is ready.", {
          description: "It appears on screen and expires in 30 seconds.",
        });
      } else {
        const res = await sendSmsOtp({ data: { phone: patient.phone, clinicId } });
        if (res.devCode) {
          onDevCodeIssued(res.devCode);
          toast.info(`Test OTP: ${res.devCode}`, {
            description: `Dev SMS provider — also shown on the verify screen.`,
            duration: 8_000,
          });
        } else {
          onDevCodeIssued(null);
          toast.success(`We sent a code to ${patient.phone}.`);
        }
      }
      onNext();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send code");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        continueToVerify();
      }}
    >
      <BackBtn onClick={onBack} />

      <div className="space-y-1">
        <h3 className="font-display text-lg font-semibold tracking-tight">Your details</h3>
        <p className="text-sm text-muted-foreground">
          We'll use these to confirm your booking and send reminders.
        </p>
      </div>

      <Field
        id="pn"
        label="Full name"
        required
        icon={User}
        error={touched.name ? errors.name : null}
      >
        <Input
          id="pn"
          autoComplete="name"
          autoFocus
          value={patient.name}
          onChange={(e) => setPatient({ ...patient, name: e.target.value })}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          aria-invalid={!!(touched.name && errors.name)}
          aria-describedby={touched.name && errors.name ? "pn-err" : undefined}
          className="pl-9"
        />
      </Field>

      <Field
        id="pp"
        label="Phone"
        required
        icon={Phone}
        hint="Include country code, e.g. +1 555 123 4567"
        error={touched.phone ? errors.phone : null}
      >
        <Input
          id="pp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+1 555 123 4567"
          value={patient.phone}
          onChange={(e) => setPatient({ ...patient, phone: e.target.value })}
          onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
          aria-invalid={!!(touched.phone && errors.phone)}
          aria-describedby={touched.phone && errors.phone ? "pp-err" : "pp-hint"}
          className="pl-9"
        />
      </Field>

      <Field id="pe" label="Email" optional icon={Mail} error={touched.email ? errors.email : null}>
        <Input
          id="pe"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={patient.email}
          onChange={(e) => setPatient({ ...patient, email: e.target.value })}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          aria-invalid={!!(touched.email && errors.email)}
          aria-describedby={touched.email && errors.email ? "pe-err" : undefined}
          className="pl-9"
        />
      </Field>

      <Field id="pno" label="Notes" optional icon={MessageSquare}>
        <Textarea
          id="pno"
          rows={3}
          placeholder="Anything we should know before your visit?"
          value={patient.notes}
          onChange={(e) => setPatient({ ...patient, notes: e.target.value })}
          className="pl-9"
        />
      </Field>

      <div className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>
          {otpProvider === "on_screen"
            ? "We'll generate a one-time code on the next screen to verify your number before booking."
            : "We'll send a one-time code to your phone to verify your number before booking."}
        </span>
      </div>

      <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border/60 p-3 text-xs">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 rounded border-border accent-primary"
          aria-describedby="consent-text"
        />
        <span id="consent-text" className="text-muted-foreground">
          I consent to the clinic storing my name, phone, and (optional) email to confirm this
          booking and send reminders, as described in the{" "}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener"
            className="text-primary hover:underline"
          >
            Privacy Policy
          </a>
          .
        </span>
      </label>

      <Button type="submit" className="w-full" disabled={!canContinue}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Sending code…
          </>
        ) : (
          "Continue"
        )}
      </Button>
    </form>
  );
}

/* ── Internal helpers ────────────────────────────────────────── */

function Field({
  id,
  label,
  required,
  optional,
  icon: Icon,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  icon: typeof User;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
          {required ? <span className="ml-0.5 text-destructive">*</span> : null}
        </Label>
        {optional ? <span className="text-[11px] text-muted-foreground">Optional</span> : null}
      </div>
      <div className="relative">
        <Icon
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        {children}
      </div>
      {error ? (
        <p id={`${id}-err`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
