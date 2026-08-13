// Edit a clinic's subscription: activation + expiry. Super-admin only.
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Flag, CreditCard, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  updateClinicSubscription,
  type Customer,
} from "@/lib/superadmin.functions";

type Preset = "30" | "60" | "90" | "365" | "custom" | "none";

function presetFromExpiry(expiresAt: string | null): {
  preset: Preset;
  customDate: Date | undefined;
} {
  if (!expiresAt) return { preset: "none", customDate: undefined };
  return { preset: "custom", customDate: new Date(expiresAt) };
}

function statusKind(c: { is_active: boolean; expires_at: string | null }) {
  if (!c.is_active) return "inactive" as const;
  if (c.expires_at && new Date(c.expires_at).getTime() < Date.now())
    return "expired" as const;
  return "active" as const;
}

export function EditSubscriptionDialog({
  clinic,
  open,
  onOpenChange,
}: {
  clinic: Customer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const update = useServerFn(updateClinicSubscription);

  const initial = useMemo(() => presetFromExpiry(clinic.expires_at), [clinic]);
  const [isActive, setIsActive] = useState(clinic.is_active);
  const [preset, setPreset] = useState<Preset>(initial.preset);
  const [customDate, setCustomDate] = useState<Date | undefined>(initial.customDate);

  const currentStatus = statusKind(clinic);

  const expiresAt = useMemo(() => {
    if (preset === "none") return null;
    if (preset === "custom") return customDate?.toISOString() ?? null;
    const days = parseInt(preset, 10);
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
  }, [preset, customDate]);

  const mutation = useMutation({
    mutationFn: () =>
      update({
        data: { clinicId: clinic.clinic_id, isActive, expiresAt },
      }),
    onSuccess: () => {
      toast.success("Subscription updated");
      qc.invalidateQueries({ queryKey: ["sa-customers"] });
      qc.invalidateQueries({ queryKey: ["all-clinics"] });
      qc.invalidateQueries({ queryKey: ["sa-stats"] });
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    },
  });

  const disabled = preset === "custom" && !customDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-x-hidden">
        <div className="bg-gradient-to-br from-primary/5 via-card to-card px-6 pb-4 pt-6">
          <DialogHeader className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20">
                <CreditCard className="size-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  <span>Edit subscription</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ring-1 ring-inset",
                      currentStatus === "active" &&
                        "bg-emerald-500/15 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
                      currentStatus === "inactive" &&
                        "bg-muted text-muted-foreground ring-border",
                      currentStatus === "expired" &&
                        "bg-destructive/10 text-destructive ring-destructive/25",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        currentStatus === "active" && "bg-emerald-500",
                        currentStatus === "inactive" && "bg-muted-foreground/60",
                        currentStatus === "expired" && "bg-destructive",
                      )}
                    />
                    {currentStatus === "expired" && <Flag className="size-2.5" />}
                    {currentStatus}
                  </span>
                </DialogTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{clinic.clinic_name}</span>{" "}
                  <span className="text-xs">/{clinic.clinic_slug}</span>
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-5 px-6 py-4">
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/40 px-4 py-3 transition-colors hover:bg-muted/60">
            <div>
              <p className="text-sm font-medium">Clinic is active</p>
              <p className="text-xs text-muted-foreground">
                When off, the booking page shows a closed message.
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {currentStatus === "expired" && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              This clinic's subscription has expired. Pick a new expiry date below
              to reactivate.
            </p>
          )}

          <div>
            <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Active till
            </Label>
            <RadioGroup
              value={preset}
              onValueChange={(v) => setPreset(v as Preset)}
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
            >
              {[
                { v: "30", l: "30 days" },
                { v: "60", l: "60 days" },
                { v: "90", l: "90 days" },
                { v: "365", l: "1 year" },
                { v: "custom", l: "Custom" },
                { v: "none", l: "No expiry" },
              ].map((p) => (
                <Label
                  key={p.v}
                  htmlFor={`edit-p-${p.v}`}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all",
                    preset === p.v
                      ? "border-primary/40 bg-primary/5 font-medium text-foreground shadow-sm shadow-primary/5"
                      : "border-border/60 text-muted-foreground hover:border-primary/30 hover:bg-muted/40 hover:text-foreground",
                  )}
                >
                  <RadioGroupItem id={`edit-p-${p.v}`} value={p.v} />
                  <span>{p.l}</span>
                </Label>
              ))}
            </RadioGroup>

            {preset === "custom" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "mt-3 w-full justify-start text-left font-normal sm:w-72",
                      !customDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 size-4" />
                    {customDate ? format(customDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customDate}
                    onSelect={setCustomDate}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            )}

            <p className="mt-3 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {expiresAt
                ? `Expires on ${format(new Date(expiresAt), "PPP")}`
                : "No expiry — stays active until manually disabled."}
            </p>
          </div>
        </div>

        <DialogFooter className="border-t border-border/60 bg-muted/20 px-6 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={disabled || mutation.isPending}
            className="bg-gradient-to-r from-primary to-primary/85 shadow-sm shadow-primary/20"
          >
            <Check className="mr-1.5 size-4" />
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
