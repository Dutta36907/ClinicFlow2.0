import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getEmailSettings,
  updateEmailSettings,
  sendTestEmail,
} from "@/lib/email-settings.functions";

type EventKey =
  | "clinic_welcome"
  | "clinic_manager_invite"
  | "subscription_expiry"
  | "account_suspended"
  | "appointment_booked_patient"
  | "appointment_booked_clinic"
  | "appointment_rescheduled"
  | "appointment_cancelled";

type Form = {
  enabled: boolean;
  resendApiKey: string;
  fromAddress: string;
  fromName: string;
  events: Record<EventKey, boolean>;
  expiryReminderDaysText: string;
};

const EMPTY: Form = {
  enabled: false,
  resendApiKey: "",
  fromAddress: "",
  fromName: "",
  events: {
    clinic_welcome: true,
    clinic_manager_invite: true,
    subscription_expiry: true,
    account_suspended: true,
    appointment_booked_patient: true,
    appointment_booked_clinic: true,
    appointment_rescheduled: true,
    appointment_cancelled: true,
  },
  expiryReminderDaysText: "7,3,1",
};

const EVENT_LABELS: { key: EventKey; label: string; help: string }[] = [
  {
    key: "clinic_welcome",
    label: "New clinic welcome",
    help: "Sent to the manager when a new clinic is added.",
  },
  {
    key: "clinic_manager_invite",
    label: "Manager invite / credentials",
    help: "Sign-in details for a newly provisioned manager.",
  },
  {
    key: "subscription_expiry",
    label: "Subscription expiry reminders",
    help: "Sent on each configured day-before-expiry threshold.",
  },
  {
    key: "account_suspended",
    label: "Account suspended notice",
    help: "Sent once when a clinic transitions to suspended/expired.",
  },
  {
    key: "appointment_booked_patient",
    label: "Appointment booked — patient",
    help: "Confirmation email to the patient.",
  },
  {
    key: "appointment_booked_clinic",
    label: "Appointment booked — clinic",
    help: "New-booking alert to the clinic inbox.",
  },
  {
    key: "appointment_rescheduled",
    label: "Appointment rescheduled",
    help: "Sent to the patient when their slot changes.",
  },
  {
    key: "appointment_cancelled",
    label: "Appointment cancelled",
    help: "Sent to the patient when an appointment is cancelled.",
  },
];

export function EmailSettingsPanel() {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getEmailSettings);
  const save = useServerFn(updateEmailSettings);
  const test = useServerFn(sendTestEmail);

  const q = useQuery({ queryKey: ["sa-email-settings"], queryFn: () => fetchSettings() });

  const [form, setForm] = useState<Form>(EMPTY);
  const [keyTouched, setKeyTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  useEffect(() => {
    if (!q.data) return;
    const s = q.data.settings;
    setForm({
      enabled: s.enabled,
      // We never echo the real secret to the client; the field shows the
      // mask only as a visual hint that one is configured.
      resendApiKey: s.hasApiKey ? s.resendApiKey : "",
      fromAddress: s.fromAddress,
      fromName: s.fromName,
      events: s.events,
      expiryReminderDaysText: s.expiryReminderDays.join(","),
    });
    setKeyTouched(false);
  }, [q.data]);

  function buildPayload() {
    // Parse the comma list defensively — drop NaN, dedupe, sort desc.
    const days = Array.from(
      new Set(
        form.expiryReminderDaysText
          .split(",")
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => Number.isFinite(n) && n >= 1 && n <= 90),
      ),
    ).sort((a, b) => b - a);
    return {
      enabled: form.enabled,
      // Empty string = "keep existing secret" on the server.
      resendApiKey: keyTouched ? form.resendApiKey : "",
      fromAddress: form.fromAddress,
      fromName: form.fromName,
      events: form.events,
      expiryReminderDays: days.length > 0 ? days : [7, 3, 1],
    };
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await save({ data: buildPayload() });
      toast.success("Email settings saved");
      qc.invalidateQueries({ queryKey: ["sa-email-settings"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  async function onTest() {
    if (!testEmail.trim()) {
      toast.error("Enter an email address to test");
      return;
    }
    setTesting(true);
    try {
      await save({ data: buildPayload() });
      const r = await test({ data: { to: testEmail.trim() } });
      if (r.ok) {
        toast.success(`Test email sent${r.messageId ? ` (id: ${r.messageId})` : ""}`);
      } else {
        toast.error(`Test failed: ${r.error}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <form onSubmit={onSave} className="space-y-6">
      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <header className="flex items-start gap-3 border-b border-border p-5">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Mail className="size-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold">Email Notifications</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Transactional emails sent via <strong>Resend</strong> for clinic onboarding,
              subscription reminders, and booking activity. The dispatcher deduplicates by event so
              the same notification is never sent twice.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="email-enabled" className="text-sm">
              Enabled
            </Label>
            <Switch
              id="email-enabled"
              checked={form.enabled}
              onCheckedChange={(v) => setForm({ ...form, enabled: v })}
            />
          </div>
        </header>

        <div className="space-y-5 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <EmailField
              label="Resend API key"
              type="password"
              value={form.resendApiKey}
              placeholder={q.data?.settings.hasApiKey ? "•••• (saved)" : "re_xxxxxxxxxxxx"}
              onChange={(v) => {
                setForm({ ...form, resendApiKey: v });
                setKeyTouched(true);
              }}
              help="Find it under Resend → API Keys. Leave blank to keep the current key."
            />
            <EmailField
              label="From email"
              value={form.fromAddress}
              placeholder="notifications@yourdomain.com"
              onChange={(v) => setForm({ ...form, fromAddress: v })}
              help="Must be on a Resend-verified domain."
            />
            <EmailField
              label="From name"
              value={form.fromName}
              placeholder="ClinicFlow"
              onChange={(v) => setForm({ ...form, fromName: v })}
            />
            <EmailField
              label="Expiry reminder days"
              value={form.expiryReminderDaysText}
              placeholder="7,3,1"
              onChange={(v) => setForm({ ...form, expiryReminderDaysText: v })}
              help="Comma-separated days before expiry to remind. Defaults to 7,3,1."
            />
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <h3 className="text-sm font-semibold">Per-event toggles</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Off events are silently skipped — no Resend call, no log entry.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {EVENT_LABELS.map((evt) => (
                <label
                  key={evt.key}
                  className="flex items-start justify-between gap-3 rounded-md border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{evt.label}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{evt.help}</div>
                  </div>
                  <Switch
                    checked={form.events[evt.key]}
                    onCheckedChange={(v) =>
                      setForm({ ...form, events: { ...form.events, [evt.key]: v } })
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-5">
          <div className="flex flex-1 items-center gap-2 sm:max-w-md">
            <Input
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
              inputMode="email"
            />
            <Button
              type="button"
              variant="outline"
              onClick={onTest}
              disabled={testing}
              className="gap-2"
            >
              <Send className="size-4" />
              {testing ? "Sending…" : "Send test"}
            </Button>
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save settings"}
          </Button>
        </footer>
      </section>
    </form>
  );
}

function EmailField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  help?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
    </div>
  );
}
