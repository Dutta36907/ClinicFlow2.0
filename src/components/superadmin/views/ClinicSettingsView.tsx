// Global platform-wide defaults applied to all clinics.
// Single-row store in `platform_settings`.
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Save } from "lucide-react";

type Settings = {
  id: string;
  general: { timezone?: string; appointment_duration_minutes?: number };
  notifications: { email?: boolean; whatsapp?: boolean; sms?: boolean; push?: boolean };
  email: { sender_name?: string; reply_to?: string; signature?: string };
  whatsapp: { provider?: string; api_key?: string; sender_id?: string };
  sms: { provider?: string; api_key?: string; sender_id?: string };
};

const empty: Settings = {
  id: "",
  general: { timezone: "UTC", appointment_duration_minutes: 30 },
  notifications: { email: true, whatsapp: false, sms: false, push: false },
  email: { sender_name: "", reply_to: "", signature: "" },
  whatsapp: { provider: "", api_key: "", sender_id: "" },
  sms: { provider: "", api_key: "", sender_id: "" },
};

export function ClinicSettingsView() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Settings>(empty);
  const [saving, setSaving] = useState(false);

  const q = useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Settings | null;
    },
  });

  useEffect(() => {
    if (q.data) {
      setDraft({
        id: q.data.id,
        general: { ...empty.general, ...(q.data.general ?? {}) },
        notifications: { ...empty.notifications, ...(q.data.notifications ?? {}) },
        email: { ...empty.email, ...(q.data.email ?? {}) },
        whatsapp: { ...empty.whatsapp, ...(q.data.whatsapp ?? {}) },
        sms: { ...empty.sms, ...(q.data.sms ?? {}) },
      });
    }
  }, [q.data]);

  async function save() {
    if (!draft.id) {
      toast.error("Settings row not loaded yet");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("platform_settings")
      .update({
        general: draft.general,
        notifications: draft.notifications,
        email: draft.email,
        whatsapp: draft.whatsapp,
        sms: draft.sms,
      })
      .eq("id", draft.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Settings saved");
    qc.invalidateQueries({ queryKey: ["platform-settings"] });
  }

  return (
    <SuperAdminLayout
      title="Clinic Settings"
      subtitle="Global defaults applied across every clinic"
      actions={
        <Button onClick={save} disabled={saving || !draft.id} className="gap-2">
          <Save className="size-4" />
          {saving ? "Saving…" : "Save changes"}
        </Button>
      }
    >
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="sms">SMS</TabsTrigger>
          <TabsTrigger value="more">More</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General defaults</CardTitle>
              <CardDescription>Applied to newly created clinics.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Default timezone</Label>
                <Input
                  value={draft.general.timezone ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, general: { ...draft.general, timezone: e.target.value } })
                  }
                  placeholder="UTC"
                />
              </div>
              <div className="space-y-2">
                <Label>Default appointment duration (minutes)</Label>
                <Input
                  type="number"
                  min={5}
                  max={240}
                  value={draft.general.appointment_duration_minutes ?? 30}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      general: {
                        ...draft.general,
                        appointment_duration_minutes: parseInt(e.target.value || "30", 10),
                      },
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification channels</CardTitle>
              <CardDescription>Master switches for outbound messages.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(["email", "whatsapp", "sms", "push"] as const).map((k) => (
                <div key={k} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium capitalize">{k}</p>
                    <p className="text-xs text-muted-foreground">
                      Send {k} notifications when events occur
                    </p>
                  </div>
                  <Switch
                    checked={!!draft.notifications[k]}
                    onCheckedChange={(v) =>
                      setDraft({ ...draft, notifications: { ...draft.notifications, [k]: v } })
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle>Email settings</CardTitle>
              <CardDescription>Sender identity and templates.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Sender name</Label>
                  <Input
                    value={draft.email.sender_name ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, email: { ...draft.email, sender_name: e.target.value } })
                    }
                    placeholder="ClinicFlow"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reply-to email</Label>
                  <Input
                    type="email"
                    value={draft.email.reply_to ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, email: { ...draft.email, reply_to: e.target.value } })
                    }
                    placeholder="noreply@example.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Default signature</Label>
                <Textarea
                  rows={4}
                  value={draft.email.signature ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, email: { ...draft.email, signature: e.target.value } })
                  }
                  placeholder="— Sent by ClinicFlow"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp">
          <Card>
            <CardHeader>
              <CardTitle>WhatsApp provider</CardTitle>
              <CardDescription>Credentials are sent only over server-side calls.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Input
                  value={draft.whatsapp.provider ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, whatsapp: { ...draft.whatsapp, provider: e.target.value } })
                  }
                  placeholder="uazapi"
                />
              </div>
              <div className="space-y-2">
                <Label>API key</Label>
                <Input
                  type="password"
                  value={draft.whatsapp.api_key ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, whatsapp: { ...draft.whatsapp, api_key: e.target.value } })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Sender ID</Label>
                <Input
                  value={draft.whatsapp.sender_id ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, whatsapp: { ...draft.whatsapp, sender_id: e.target.value } })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sms">
          <Card>
            <CardHeader>
              <CardTitle>SMS provider</CardTitle>
              <CardDescription>Used for OTP and reminders.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Input
                  value={draft.sms.provider ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, sms: { ...draft.sms, provider: e.target.value } })
                  }
                  placeholder="twilio"
                />
              </div>
              <div className="space-y-2">
                <Label>API key</Label>
                <Input
                  type="password"
                  value={draft.sms.api_key ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, sms: { ...draft.sms, api_key: e.target.value } })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Sender ID</Label>
                <Input
                  value={draft.sms.sender_id ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, sms: { ...draft.sms, sender_id: e.target.value } })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="more">
          <Card>
            <CardHeader>
              <CardTitle>More integrations</CardTitle>
              <CardDescription>Coming soon — payments, calendar sync, analytics, etc.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Additional integration tabs will appear here as they are added to the platform.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </SuperAdminLayout>
  );
}
