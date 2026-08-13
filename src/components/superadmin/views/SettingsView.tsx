import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MessageSquare, Send } from "lucide-react";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EmailSettingsPanel } from "./EmailSettingsPanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getSmsSettings,
  updateSmsSettings,
  sendTestSms,
} from "@/lib/superadmin.functions";

type Provider = "on_screen" | "dev" | "twilio" | "msg91" | "gupshup";

type Form = {
  provider: Provider;
  enabled: boolean;
  twilio: { accountSid: string; authToken: string; fromNumber: string };
  msg91: { authKey: string; senderId: string; templateId: string };
  gupshup: { apiKey: string; source: string; appName: string };
};

const EMPTY: Form = {
  provider: "on_screen",
  enabled: true,
  twilio: { accountSid: "", authToken: "", fromNumber: "" },
  msg91: { authKey: "", senderId: "", templateId: "" },
  gupshup: { apiKey: "", source: "", appName: "" },
};

export function SettingsView() {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getSmsSettings);
  const save = useServerFn(updateSmsSettings);
  const test = useServerFn(sendTestSms);

  const q = useQuery({ queryKey: ["sa-sms-settings"], queryFn: () => fetchSettings() });

  const [form, setForm] = useState<Form>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  // Track which credential fields the operator has actually edited — empty
  // fields are sent as "" which the server treats as "keep existing".
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!q.data) return;
    const s = q.data.settings;
    setForm({
      provider: s.provider,
      enabled: s.enabled,
      twilio: {
        accountSid: s.twilio?.accountSid ?? "",
        authToken: s.twilio?.authToken ?? "",
        fromNumber: s.twilio?.fromNumber ?? "",
      },
      msg91: {
        authKey: s.msg91?.authKey ?? "",
        senderId: s.msg91?.senderId ?? "",
        templateId: s.msg91?.templateId ?? "",
      },
      gupshup: {
        apiKey: s.gupshup?.apiKey ?? "",
        source: s.gupshup?.source ?? "",
        appName: s.gupshup?.appName ?? "",
      },
    });
    setTouched({});
  }, [q.data]);

  function mark(path: string) {
    setTouched((t) => ({ ...t, [path]: true }));
  }

  function payload() {
    // Only send fields the user actually edited; everything else stays "".
    const pick = <T extends Record<string, string>>(group: string, src: T) => {
      const out: Record<string, string> = {};
      for (const k of Object.keys(src)) {
        out[k] = touched[`${group}.${k}`] ? src[k] : "";
      }
      return out;
    };
    return {
      provider: form.provider,
      enabled: form.enabled,
      twilio: pick("twilio", form.twilio),
      msg91: pick("msg91", form.msg91),
      gupshup: pick("gupshup", form.gupshup),
    };
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await save({ data: payload() });
      toast.success("SMS settings saved");
      qc.invalidateQueries({ queryKey: ["sa-sms-settings"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  async function onTest() {
    if (!testPhone.trim()) {
      toast.error("Enter a phone number to test");
      return;
    }
    setTesting(true);
    try {
      // Save current settings first so the test uses the latest config.
      await save({ data: payload() });
      const r = await test({ data: { phone: testPhone.trim() } });
      if (!r.ok) {
        toast.error(`Test failed: ${r.error}`);
      } else if (r.devCode) {
        toast.success(`Dev mode — code: ${r.devCode}`);
      } else {
        toast.success(`Test SMS dispatched via ${r.provider}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  const provider = form.provider;

  return (
    <SuperAdminLayout title="Settings" subtitle="Platform configuration">
      <Tabs defaultValue="sms" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sms">SMS</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
        </TabsList>
        <TabsContent value="sms" className="m-0">
      <form onSubmit={onSave} className="space-y-6">
        <section className="rounded-2xl border border-border bg-card shadow-sm">
          <header className="flex items-start gap-3 border-b border-border p-5">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MessageSquare className="size-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold">SMS Provider</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Controls how patient OTP codes are delivered. While in <strong>Dev</strong>{" "}
                mode, the booking flow returns the code in the response so you can
                test without a paid SMS account.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="sms-enabled" className="text-sm">Enabled</Label>
              <Switch
                id="sms-enabled"
                checked={form.enabled}
                onCheckedChange={(v) => setForm({ ...form, enabled: v })}
              />
            </div>
          </header>

          <div className="space-y-5 p-5">
            <div className="grid gap-2 sm:max-w-xs">
              <Label>Provider</Label>
              <p className="text-xs text-muted-foreground">
                Recommended: On-screen code — free, no SMS costs. SMS providers
                are available for future use.
              </p>
              <Select
                value={provider}
                onValueChange={(v) => setForm({ ...form, provider: v as Provider })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="on_screen">On-screen code — free, no SMS, browser-session bound</SelectItem>
                  <SelectItem value="dev">Dev — log only (returns code in response)</SelectItem>
                  <SelectItem value="twilio">Twilio</SelectItem>
                  <SelectItem value="msg91">MSG91</SelectItem>
                  <SelectItem value="gupshup">Gupshup</SelectItem>
                </SelectContent>
              </Select>
              {provider === "on_screen" ? (
                <p className="text-xs text-muted-foreground">
                  On-screen codes are free and require no SMS provider. The
                  6-digit code is shown directly in the patient's browser,
                  expires in 60 seconds, and is bound to that browser tab.
                  Existing SMS credentials are preserved below.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Existing secrets are masked. Leave a field blank to keep its
                  current value.
                </p>
              )}
            </div>

            {provider === "twilio" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Account SID"
                  value={form.twilio.accountSid}
                  onChange={(v) => { setForm({ ...form, twilio: { ...form.twilio, accountSid: v } }); mark("twilio.accountSid"); }}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
                <Field
                  label="Auth Token"
                  type="password"
                  value={form.twilio.authToken}
                  onChange={(v) => { setForm({ ...form, twilio: { ...form.twilio, authToken: v } }); mark("twilio.authToken"); }}
                  placeholder="••••••••"
                />
                <Field
                  label="From Number"
                  value={form.twilio.fromNumber}
                  onChange={(v) => { setForm({ ...form, twilio: { ...form.twilio, fromNumber: v } }); mark("twilio.fromNumber"); }}
                  placeholder="+15551234567"
                />
              </div>
            )}

            {provider === "msg91" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Auth Key"
                  type="password"
                  value={form.msg91.authKey}
                  onChange={(v) => { setForm({ ...form, msg91: { ...form.msg91, authKey: v } }); mark("msg91.authKey"); }}
                  placeholder="••••••••"
                />
                <Field
                  label="Sender ID"
                  value={form.msg91.senderId}
                  onChange={(v) => { setForm({ ...form, msg91: { ...form.msg91, senderId: v } }); mark("msg91.senderId"); }}
                  placeholder="CLINIC"
                />
                <Field
                  label="OTP Template ID"
                  value={form.msg91.templateId}
                  onChange={(v) => { setForm({ ...form, msg91: { ...form.msg91, templateId: v } }); mark("msg91.templateId"); }}
                  placeholder="64xxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>
            )}

            {provider === "gupshup" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="API Key / Password"
                  type="password"
                  value={form.gupshup.apiKey}
                  onChange={(v) => { setForm({ ...form, gupshup: { ...form.gupshup, apiKey: v } }); mark("gupshup.apiKey"); }}
                  placeholder="••••••••"
                />
                <Field
                  label="User ID / Source"
                  value={form.gupshup.source}
                  onChange={(v) => { setForm({ ...form, gupshup: { ...form.gupshup, source: v } }); mark("gupshup.source"); }}
                  placeholder="2000xxxxxx"
                />
                <Field
                  label="App Name (optional)"
                  value={form.gupshup.appName}
                  onChange={(v) => { setForm({ ...form, gupshup: { ...form.gupshup, appName: v } }); mark("gupshup.appName"); }}
                />
              </div>
            )}

            {provider === "dev" && (
              <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                Dev mode is active. OTP codes are returned in the booking response
                and never sent over SMS. Switch to a real provider before launch.
              </div>
            )}
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-5">
            <div className="flex flex-1 items-center gap-2 sm:max-w-md">
              <Input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+91 90000 00000"
                inputMode="tel"
              />
              <Button type="button" variant="outline" onClick={onTest} disabled={testing} className="gap-2">
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
        </TabsContent>
        <TabsContent value="email" className="m-0">
          <EmailSettingsPanel />
        </TabsContent>
      </Tabs>
    </SuperAdminLayout>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
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
    </div>
  );
}
