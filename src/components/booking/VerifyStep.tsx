/**
 * Booking — Step 4: OTP verification + final confirmation
 *
 * Two delivery modes (decided by the platform_settings.sms.provider):
 *  - on_screen: the code was generated server-side and returned over HTTPS
 *    in the previous step. We display it via <OnScreenOtpCard /> for the
 *    user to type, with a 60s hard expiry. Verify via verifyOnScreenOtp.
 *  - sms / dev: classic SMS flow — verify via verifyPatientOtp, no card.
 */
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertCircle, Loader2, RotateCw, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  verifyPatientOtp,
  createAppointment,
  requestPatientOtp,
  verifyOnScreenOtp,
  requestOnScreenOtp,
} from "@/lib/public.functions";
import { getOrCreateBookingSessionId } from "@/lib/booking/session";
import { OnScreenOtpCard } from "./OnScreenOtpCard";
import { BackBtn } from "./parts";
import type { Confirmation, Doctor, OtpProvider, PatientForm } from "./types";

const RESEND_COOLDOWN_SECONDS = 30;
const MAX_ATTEMPTS = 5;

export function VerifyStep({
  clinicId,
  doctor,
  slot,
  patient,
  otpProvider,
  onScreenCode,
  onCodeRefreshed,
  devCode,
  onDevCodeRefreshed,
  onBack,
  onConfirmed,
  onSlotTaken,
}: {
  clinicId: string;
  doctor: Doctor;
  slot: string;
  patient: PatientForm;
  otpProvider: OtpProvider;
  onScreenCode: string | null;
  onCodeRefreshed: (code: string) => void;
  devCode: string | null;
  onDevCodeRefreshed: (code: string | null) => void;
  onBack: () => void;
  onConfirmed: (c: Confirmation) => void;
  onSlotTaken: (message: string) => void;
}) {
  const isOnScreen = otpProvider === "on_screen";
  const isDev = otpProvider === "dev";

  const verifySms = useServerFn(verifyPatientOtp);
  const verifyScreen = useServerFn(verifyOnScreenOtp);
  const sendSmsOtp = useServerFn(requestPatientOtp);
  const sendScreenOtp = useServerFn(requestOnScreenOtp);
  const book = useServerFn(createAppointment);

  const [otpCode, setOtpCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(isOnScreen ? 0 : RESEND_COOLDOWN_SECONDS);
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<Date>(new Date());
  const [codeExpired, setCodeExpired] = useState(false);
  const autoSubmitted = useRef(false);

  // Resend cooldown countdown (SMS path only)
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // If we land on the verify step with no on-screen code (e.g. state lost on
  // remount or browser back/forward), auto-issue one so the card always shows.
  const autoIssuedRef = useRef(false);
  useEffect(() => {
    if (!isOnScreen) return;
    if (onScreenCode) return;
    if (autoIssuedRef.current) return;
    autoIssuedRef.current = true;
    (async () => {
      try {
        const sessionId = getOrCreateBookingSessionId();
        const res = await sendScreenOtp({
          data: { phone: patient.phone, sessionId, clinicId },
        });
        onCodeRefreshed(res.code);
        setCodeExpired(false);
        setLastSentAt(new Date());
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Couldn't generate a verification code.";
        setError(msg);
        toast.error(msg);
      }
    })();
  }, [isOnScreen, onScreenCode, sendScreenOtp, patient.phone, clinicId, onCodeRefreshed]);

  async function confirm() {
    if (otpCode.length !== 6 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      let token: string | null = null;
      if (isOnScreen) {
        const sessionId = getOrCreateBookingSessionId();
        const v = await verifyScreen({
          data: { phone: patient.phone, code: otpCode, sessionId },
        });
        if (!v.ok || !("token" in v) || !v.token) {
          const msg = ("error" in v && v.error) || "That code didn't match.";
          setError(msg);
          setAttempts((a) => a + 1);
          setOtpCode("");
          toast.error(msg);
          setSubmitting(false);
          return;
        }
        token = v.token;
      } else {
        const v = await verifySms({
          data: { phone: patient.phone, code: otpCode },
        });
        if (!v.ok || !("token" in v) || !v.token) {
          const msg =
            ("error" in v && v.error) ||
            "That code didn't match. Please double-check and try again.";
          setError(msg);
          setAttempts((a) => a + 1);
          setOtpCode("");
          toast.error(msg);
          setSubmitting(false);
          return;
        }
        token = v.token;
      }

      const res = await book({
        data: {
          clinicId,
          doctorId: doctor.id,
          scheduledAt: slot,
          patientName: patient.name,
          patientPhone: patient.phone,
          patientEmail: patient.email || undefined,
          notes: patient.notes || undefined,
          verifyToken: token,
          consent: true as const,
        },
      });
      onConfirmed({ id: res.appointmentId, scheduledAt: res.scheduledAt });
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "Something went wrong while confirming your booking.";
      const lower = msg.toLowerCase();
      if (
        lower.includes("just booked") ||
        lower.includes("unavailable") ||
        lower.includes("outside the doctor") ||
        lower.includes("in the past")
      ) {
        onSlotTaken(msg);
        setSubmitting(false);
        return;
      }
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // Auto-submit once the user types all 6 digits
  useEffect(() => {
    if (otpCode.length === 6 && !submitting && !autoSubmitted.current) {
      autoSubmitted.current = true;
      confirm();
    }
    if (otpCode.length < 6) {
      autoSubmitted.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpCode]);

  async function resend() {
    if (resending) return;
    if (!isOnScreen && cooldown > 0) return;
    setResending(true);
    setError(null);
    setOtpCode("");
    try {
      if (isOnScreen) {
        const sessionId = getOrCreateBookingSessionId();
        const res = await sendScreenOtp({
          data: { phone: patient.phone, sessionId, clinicId },
        });
        onCodeRefreshed(res.code);
        setCodeExpired(false);
        toast.success("New verification code generated.");
      } else {
        const res = await sendSmsOtp({ data: { phone: patient.phone, clinicId } });
        if (res.devCode) {
          onDevCodeRefreshed(res.devCode);
          toast.info(`Test OTP: ${res.devCode}`, {
            description: `Dev SMS provider — also shown on this screen.`,
            duration: 8_000,
          });
        } else {
          onDevCodeRefreshed(null);
          toast.success(`A new code was sent to ${patient.phone}.`);
        }
        setCooldown(RESEND_COOLDOWN_SECONDS);
      }
      setAttempts(0);
      setLastSentAt(new Date());
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "We couldn't generate a new code right now.";
      setError(msg);
      toast.error(msg);
    } finally {
      setResending(false);
    }
  }

  const lockedOut = attempts >= MAX_ATTEMPTS;
  const inputDisabled = submitting || lockedOut || (isOnScreen && (codeExpired || !onScreenCode));

  return (
    <div className="space-y-5">
      <BackBtn onClick={onBack} />

      <div className="space-y-1">
        <h3 className="font-display text-lg font-semibold tracking-tight">
          {isOnScreen ? "Verify your phone" : "Verify your phone"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {isOnScreen ? (
            <>
              For your security, this booking uses an on-screen code tied to
              this browser tab. Phone on file:{" "}
              <span className="font-medium text-foreground">{patient.phone}</span>.
            </>
          ) : (
            <>
              We sent a 6-digit code to{" "}
              <span className="font-medium text-foreground">{patient.phone}</span>.
              Enter it below to confirm your appointment.
            </>
          )}
        </p>
      </div>

      {isOnScreen && onScreenCode ? (
        <OnScreenOtpCard
          code={onScreenCode}
          onExpire={() => setCodeExpired(true)}
        />
      ) : null}

      {isDev && devCode ? (
        <div
          role="region"
          aria-label="Test verification code"
          className="rounded-2xl border border-amber-500/50 bg-amber-500/5 p-4 sm:p-5"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
            <AlertCircle className="size-4" />
            <span>Test code (dev SMS provider)</span>
          </div>
          <div className="mt-3 flex justify-center gap-1.5 sm:gap-2">
            {Array.from(devCode).map((digit, i) => (
              <div
                key={i}
                className="flex h-12 w-10 sm:h-14 sm:w-12 items-center justify-center rounded-lg border border-amber-500/60 font-mono text-2xl sm:text-3xl font-semibold tabular-nums text-amber-700"
              >
                {digit}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Shown here because the platform is configured with the development
            SMS provider. Real providers never display the code on screen.
          </p>
        </div>
      ) : null}

      <div className="flex justify-center">
        <InputOTP
          maxLength={6}
          value={otpCode}
          onChange={(v) => {
            setOtpCode(v);
            if (error) setError(null);
          }}
          disabled={inputDisabled}
        >
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTPSlot
                key={i}
                index={i}
                className={error ? "border-destructive" : undefined}
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-0.5">
            <p>{error}</p>
            {attempts > 0 && !lockedOut ? (
              <p className="text-xs opacity-80">
                {MAX_ATTEMPTS - attempts} attempt
                {MAX_ATTEMPTS - attempts === 1 ? "" : "s"} remaining.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {lockedOut ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Too many incorrect attempts. Please request a new code to continue.
        </div>
      ) : null}

      {isOnScreen && codeExpired ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700">
          Your code expired. Tap "Get a new code" below to generate a new one.
        </div>
      ) : null}

      <Button
        className="w-full"
        disabled={otpCode.length !== 6 || inputDisabled}
        onClick={confirm}
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Confirming…
          </>
        ) : (
          "Confirm appointment"
        )}
      </Button>

      <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Timer className="size-4" />
            <span>
              {isOnScreen ? "Code generated" : "Code sent"}{" "}
              <time dateTime={lastSentAt.toISOString()}>
                {lastSentAt.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </span>
          </div>
          {!isOnScreen ? (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                cooldown > 0
                  ? "bg-primary/10 text-primary"
                  : "bg-emerald-500/10 text-emerald-600"
              }`}
            >
              {cooldown > 0 ? (
                <>
                  <Loader2 className="mr-1 size-3 animate-spin" />
                  Resend in {cooldown}s
                </>
              ) : (
                "Ready to resend"
              )}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={resend}
          disabled={(!isOnScreen && cooldown > 0) || resending}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-background py-2.5 text-sm font-medium text-foreground shadow-sm ring-1 ring-border transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {resending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {isOnScreen ? "Generating new code…" : "Sending new code…"}
            </>
          ) : !isOnScreen && cooldown > 0 ? (
            <>
              <RotateCw className="size-4 opacity-50" />
              Resend disabled — wait {cooldown}s
            </>
          ) : (
            <>
              <RotateCw className="size-4" />
              {isOnScreen ? "Get a new code" : "Resend verification code"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
