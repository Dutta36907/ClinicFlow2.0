/**
 * Booking — top-level dialog
 *
 * Holds the cross-step state (selected doctor, slot, patient form,
 * confirmation) and routes between step components. Each step component
 * lives in its own file so changing one doesn't risk breaking another.
 *
 * To add a step:
 *   1. Add it to the `Step` union in `./types.ts`.
 *   2. Create `./MyStep.tsx`.
 *   3. Render it from the switch below and add it to `DialogStepper`.
 */
import { useEffect, useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { BadgeCheck, Stethoscope } from "lucide-react";
import { DialogStepper } from "./parts";
import { DoctorPickStep } from "./DoctorPickStep";
import { DateTimeStep } from "./DateTimeStep";
import { DetailsStep } from "./DetailsStep";
import { VerifyStep } from "./VerifyStep";
import { DoneStep } from "./DoneStep";
import { getBookingConfig } from "@/lib/public.functions";
import { clearBookingSessionId } from "@/lib/booking/session";
import type { Confirmation, Doctor, OtpProvider, PatientForm, Step } from "./types";

const EMPTY_PATIENT: PatientForm = { name: "", phone: "", email: "", notes: "" };

export function BookingDialog({
  open,
  onOpenChange,
  clinicId,
  clinicTimezone,
  clinicName,
  clinicLogoUrl,
  clinicTagline,
  doctors,
  presetDoctor,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clinicId: string;
  clinicTimezone: string;
  clinicName: string;
  clinicLogoUrl?: string | null;
  clinicTagline?: string | null;
  doctors: Doctor[];
  presetDoctor: Doctor | null;
}) {
  const queryClient = useQueryClient();
  const fetchBookingConfig = useServerFn(getBookingConfig);
  const { data: bookingCfg } = useQuery({
    queryKey: ["bookingConfig"],
    queryFn: () => fetchBookingConfig(),
    staleTime: 60_000,
  });
  const otpProvider: OtpProvider = bookingCfg?.otpProvider ?? "on_screen";

  const [step, setStep] = useState<Step>("doctor");
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [date, setDate] = useState<Date | undefined>();
  const [slot, setSlot] = useState<string | null>(null);
  const [patient, setPatient] = useState<PatientForm>(EMPTY_PATIENT);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [onScreenCode, setOnScreenCode] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  // Reset state every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    if (presetDoctor) {
      setDoctor(presetDoctor);
      setStep("datetime");
    } else {
      setDoctor(null);
      setStep("doctor");
    }
    setDate(undefined);
    setSlot(null);
    setPatient(EMPTY_PATIENT);
    setConfirmation(null);
    setOnScreenCode(null);
    setDevCode(null);
  }, [open, presetDoctor]);

  const stepLabel =
    step === "done" ? "Appointment confirmed" : "Book an appointment";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6 gap-3">
        <DialogHeader className="space-y-3">
          {/* Clinic identity */}
          <div className="flex items-start gap-3">
            {clinicLogoUrl ? (
              <img
                src={clinicLogoUrl}
                alt=""
                className="size-10 sm:size-12 shrink-0 rounded-xl border border-border object-cover"
              />
            ) : (
              <span className="flex size-10 sm:size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Stethoscope className="size-5 sm:size-6" />
              </span>
            )}
            <div className="min-w-0 flex-1 text-left">
              <DialogTitle className="flex items-center gap-1.5 font-display text-lg sm:text-xl font-semibold tracking-tight">
                <span className="truncate">{clinicName}</span>
                <BadgeCheck className="size-5 shrink-0 fill-primary/10 text-primary" />
              </DialogTitle>
              {clinicTagline ? (
                <DialogDescription className="mt-0.5 line-clamp-2 text-sm text-muted-foreground hidden sm:block">
                  {clinicTagline}
                </DialogDescription>
              ) : null}
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                {stepLabel}
              </p>
            </div>
          </div>
        </DialogHeader>


        {step !== "done" && <DialogStepper step={step} />}

        {step === "doctor" && (
          <DoctorPickStep
            doctors={doctors}
            onPick={(d) => {
              setDoctor(d);
              setStep("datetime");
            }}
          />
        )}

        {step === "datetime" && doctor && (
          <DateTimeStep
            doctor={doctor}
            date={date}
            setDate={setDate}
            slot={slot}
            setSlot={setSlot}
            onBack={() => !presetDoctor && setStep("doctor")}
            onNext={() => setStep("details")}
            canBack={!presetDoctor}
          />
        )}

        {step === "details" && (
          <DetailsStep
            clinicId={clinicId}
            patient={patient}
            setPatient={setPatient}
            otpProvider={otpProvider}
            onCodeIssued={(c) => setOnScreenCode(c)}
            onDevCodeIssued={(c) => setDevCode(c)}
            onBack={() => setStep("datetime")}
            onNext={() => setStep("verify")}
          />
        )}

        {step === "verify" && doctor && slot && (
          <VerifyStep
            clinicId={clinicId}
            doctor={doctor}
            slot={slot}
            patient={patient}
            otpProvider={otpProvider}
            onScreenCode={onScreenCode}
            onCodeRefreshed={(c) => setOnScreenCode(c)}
            devCode={devCode}
            onDevCodeRefreshed={(c) => setDevCode(c)}
            onBack={() => setStep("details")}
            onConfirmed={(c) => {
              setConfirmation(c);
              setOnScreenCode(null);
              setDevCode(null);
              clearBookingSessionId();
              if (doctor) {
                if (date) {
                  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                  queryClient.invalidateQueries({ queryKey: ["slots", doctor.id, dateStr] });
                }
                queryClient.invalidateQueries({ queryKey: ["slots", doctor.id] });
              }
              setStep("done");
            }}
            onSlotTaken={(msg) => {
              toast.error(msg || "This slot was just booked by someone else. Please pick another time.");
              setSlot(null);
              if (doctor && date) {
                const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                queryClient.invalidateQueries({ queryKey: ["slots", doctor.id, dateStr] });
              }
              setStep("datetime");
            }}
          />
        )}

        {step === "done" && confirmation && doctor && (
          <DoneStep
            confirmation={confirmation}
            doctor={doctor}
            clinicTimezone={clinicTimezone}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
