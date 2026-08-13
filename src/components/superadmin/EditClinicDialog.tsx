import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { CalendarIcon, Building2, Check, Power } from "lucide-react";
import { checkSlugAvailable, updateClinic, listClinicManagers, setClinicManagerPassword } from "@/lib/superadmin.functions";
import { useSuperAdminPermissions } from "@/hooks/useSuperAdminPermissions";
import { useQuery } from "@tanstack/react-query";
import { Copy, Eye, EyeOff, KeyRound } from "lucide-react";

export type EditableClinic = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  website: string | null;
  address: string | null;
  google_map_url: string | null;
  description: string | null;
  is_active: boolean;
  expires_at: string | null;
};

type Preset = "1" | "30" | "60" | "90" | "365" | "custom" | "none";

function detectPreset(expires_at: string | null): {
  preset: Preset;
  customDate: Date | undefined;
} {
  if (!expires_at) return { preset: "none", customDate: undefined };
  const d = new Date(expires_at);
  const now = new Date();
  const diffDays = Math.round(
    (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if ([1, 30, 60, 90, 365].includes(diffDays)) {
    return { preset: String(diffDays) as Preset, customDate: undefined };
  }
  return { preset: "custom", customDate: d };
}

export function EditClinicDialog({
  clinic,
  open,
  onOpenChange,
}: {
  clinic: EditableClinic;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const checkSlugFn = useServerFn(checkSlugAvailable);
  const updateFn = useServerFn(updateClinic);
  const { data: perms } = useSuperAdminPermissions();
  const canSubscriptions = perms?.can_subscriptions ?? false;

  const seed = useMemo(() => detectPreset(clinic.expires_at), [clinic]);

  const [form, setForm] = useState({
    name: clinic.name,
    slug: clinic.slug,
    phone: clinic.phone ?? "",
    email: clinic.email ?? "",
    whatsapp: clinic.whatsapp ?? "",
    website: clinic.website ?? "",
    address: clinic.address ?? "",
    google_map_url: clinic.google_map_url ?? "",
    description: clinic.description ?? "",
    is_active: clinic.is_active,
    preset: seed.preset,
    customDate: seed.customDate,
  });
  const [slugState, setSlugState] = useState<
    "idle" | "checking" | "ok" | "taken" | "invalid"
  >("ok");
  const [saving, setSaving] = useState(false);

  // Reseed on row change
  useEffect(() => {
    const s = detectPreset(clinic.expires_at);
    setForm({
      name: clinic.name,
      slug: clinic.slug,
      phone: clinic.phone ?? "",
      email: clinic.email ?? "",
      whatsapp: clinic.whatsapp ?? "",
      website: clinic.website ?? "",
      address: clinic.address ?? "",
      google_map_url: clinic.google_map_url ?? "",
      description: clinic.description ?? "",
      is_active: clinic.is_active,
      preset: s.preset,
      customDate: s.customDate,
    });
    setSlugState("ok");
  }, [clinic]);

  // Debounced slug check, excluding self
  useEffect(() => {
    if (!form.slug) {
      setSlugState("invalid");
      return;
    }
    if (form.slug === clinic.slug) {
      setSlugState("ok");
      return;
    }
    setSlugState("checking");
    const t = setTimeout(async () => {
      try {
        const r = await checkSlugFn({
          data: { slug: form.slug, excludeId: clinic.id },
        });
        if (r.reason === "invalid") setSlugState("invalid");
        else setSlugState(r.available ? "ok" : "taken");
      } catch {
        setSlugState("idle");
      }
    }, 350);
    return () => clearTimeout(t);
  }, [form.slug, clinic.id, clinic.slug, checkSlugFn]);

  const expiresAt = useMemo(() => {
    if (form.preset === "none") return null;
    if (form.preset === "custom") return form.customDate?.toISOString() ?? null;
    const days = parseInt(form.preset, 10);
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
  }, [form.preset, form.customDate]);

  const canSave =
    form.name.trim().length >= 2 &&
    slugState === "ok" &&
    (form.preset !== "custom" || !!form.customDate) &&
    !saving;

  async function onSave() {
    setSaving(true);
    try {
      await updateFn({
        data: {
          id: clinic.id,
          name: form.name.trim(),
          slug: form.slug,
          phone: form.phone.trim(),
          email: form.email.trim(),
          whatsapp: form.whatsapp.trim(),
          website: form.website.trim(),
          address: form.address.trim(),
          google_map_url: form.google_map_url.trim(),
          description: form.description.trim(),
          is_active: canSubscriptions ? form.is_active : clinic.is_active,
          expires_at: canSubscriptions ? expiresAt : clinic.expires_at,
        },
      });
      toast.success("Clinic updated");
      qc.invalidateQueries({ queryKey: ["all-clinics"] });
      qc.invalidateQueries({ queryKey: ["sa-stats"] });
      qc.invalidateQueries({ queryKey: ["sa-recent-clinics"] });
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update";
      // Server zod errors come back as a JSON-stringified issue array.
      // Pull out the first issue and show a field-specific message so the
      // user knows what to fix, instead of dumping raw JSON in the toast.
      const labels: Record<string, string> = {
        google_map_url: "Google Maps URL",
        website: "Website",
        email: "Email",
        phone: "Phone",
        whatsapp: "WhatsApp",
        name: "Name",
        slug: "URL slug",
        description: "Description",
        address: "Address",
      };
      try {
        const parsed = JSON.parse(msg);
        const issue = Array.isArray(parsed) ? parsed[0] : null;
        const field = issue?.path?.[0] as string | undefined;
        if (field) {
          const label = labels[field] ?? field;
          toast.error(`${label}: ${issue.message ?? "invalid value"}`);
        } else {
          toast.error(msg);
        }
      } catch {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-x-hidden">
        <DialogHeader className="space-y-0 border-b border-border bg-gradient-to-br from-primary/5 via-card to-card px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20">
              <Building2 className="size-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base">Edit clinic profile</DialogTitle>
              <p className="truncate text-xs text-muted-foreground">
                {clinic.name} <span className="text-muted-foreground/60">·</span>{" "}
                <code className="rounded bg-muted/60 px-1.5 py-0.5">/{clinic.slug}</code>
              </p>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
                clinic.is_active
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  clinic.is_active ? "bg-emerald-500" : "bg-muted-foreground/50",
                )}
              />
              {clinic.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-6 overflow-y-auto px-6 py-5">
          {/* Basics */}
          <section className="space-y-4">
            <SectionTitle>Basics</SectionTitle>
            <div>
              <Label htmlFor="e-name">Clinic name *</Label>
              <Input
                id="e-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="e-slug">URL slug *</Label>
              <Input
                id="e-slug"
                value={form.slug}
                onChange={(e) =>
                  setForm({
                    ...form,
                    slug: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                  })
                }
              />
              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate">
                  Booking: <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">/{form.slug}</code>
                </span>
                <SlugBadge state={slugState} />
              </div>
            </div>
          </section>

          <Separator />

          {/* Contact */}
          <section className="space-y-4">
            <SectionTitle>Contact</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <Field label="WhatsApp" value={form.whatsapp} onChange={(v) => setForm({ ...form, whatsapp: v })} />
              <Field label="Website" type="url" value={form.website} onChange={(v) => setForm({ ...form, website: v })} />
            </div>
          </section>

          <Separator />

          {/* Location */}
          <section className="space-y-4">
            <SectionTitle>Location</SectionTitle>
            <div>
              <Label htmlFor="e-addr">Address</Label>
              <Textarea
                id="e-addr"
                rows={3}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <Field
              label="Google Maps URL"
              type="url"
              value={form.google_map_url}
              onChange={(v) => setForm({ ...form, google_map_url: v })}
            />
          </section>

          <Separator />

          {/* Description */}
          <section className="space-y-4">
            <SectionTitle>About</SectionTitle>
            <div>
              <Label htmlFor="e-desc">Description</Label>
              <Textarea
                id="e-desc"
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Short description shown on the booking page"
              />
            </div>
          </section>

          {canSubscriptions && (
            <>
              <Separator />

              {/* Status */}
              <section className="space-y-4">
                <SectionTitle>Status</SectionTitle>
                <div
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-4 py-3 transition-colors",
                    form.is_active
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-border bg-muted/30",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "grid size-8 place-items-center rounded-lg",
                        form.is_active
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Power className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Clinic is active</p>
                      <p className="text-xs text-muted-foreground">
                        When off, the booking page shows a closed message.
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Active till</Label>
                  <RadioGroup
                    value={form.preset}
                    onValueChange={(v) =>
                      setForm({ ...form, preset: v as Preset })
                    }
                    className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                  >
                    {[
                      { v: "1", l: "1 day" },
                      { v: "30", l: "30 days" },
                      { v: "60", l: "60 days" },
                      { v: "90", l: "90 days" },
                      { v: "365", l: "1 year" },
                      { v: "custom", l: "Custom" },
                      { v: "none", l: "No expiry" },
                    ].map((p) => (
                      <Label
                        key={p.v}
                        htmlFor={`ep-${p.v}`}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all",
                          form.preset === p.v
                            ? "border-primary/40 bg-primary/5 font-medium text-foreground shadow-sm"
                            : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                        )}
                      >
                        <RadioGroupItem id={`ep-${p.v}`} value={p.v} />
                        <span>{p.l}</span>
                      </Label>
                    ))}
                  </RadioGroup>
                  {form.preset === "custom" && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "mt-3 w-full justify-start text-left font-normal sm:w-72",
                            !form.customDate && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 size-4" />
                          {form.customDate ? format(form.customDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={form.customDate}
                          onSelect={(d) => setForm({ ...form, customDate: d })}
                          disabled={(d) =>
                            d < new Date(new Date().setHours(0, 0, 0, 0))
                          }
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                  {expiresAt && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Expires on <strong>{format(new Date(expiresAt), "PPP")}</strong>
                    </p>
                  )}
                </div>
              </section>
            </>
          )}

          <Separator />



          {/* Manager credentials */}
          <section className="space-y-4">
            <SectionTitle>Clinic manager access</SectionTitle>
            <ManagerCredentials clinicId={clinic.id} />
          </section>
        </div>

        <DialogFooter className="border-t border-border bg-muted/20 px-6 py-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={!canSave}
            className="bg-gradient-to-r from-primary to-primary/85 shadow-sm shadow-primary/20"
          >
            <Check className="size-4" />
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

function Field({
  label,
  value,
  onChange,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SlugBadge({
  state,
}: {
  state: "idle" | "checking" | "ok" | "taken" | "invalid";
}) {
  if (state === "idle") return null;
  const map = {
    checking: { t: "Checking…", c: "text-muted-foreground" },
    ok: { t: "Available", c: "text-emerald-600 dark:text-emerald-400" },
    taken: { t: "Already taken", c: "text-destructive" },
    invalid: { t: "Invalid characters", c: "text-destructive" },
  } as const;
  const m = map[state];
  return <span className={cn("font-medium", m.c)}>{m.t}</span>;
}

function ManagerCredentials({ clinicId }: { clinicId: string }) {
  const listFn = useServerFn(listClinicManagers);
  const setPwFn = useServerFn(setClinicManagerPassword);

  const managersQ = useQuery({
    queryKey: ["clinic-managers", clinicId],
    queryFn: () => listFn({ data: { clinic_id: clinicId } }),
  });

  if (managersQ.isLoading) {
    return <p className="text-xs text-muted-foreground">Loading managers…</p>;
  }
  const managers = managersQ.data?.managers ?? [];

  if (managers.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        No clinic manager has been assigned to this clinic yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {managers.map((m) => (
        <ManagerRow
          key={m.user_id}
          userId={m.user_id}
          email={m.email}
          fullName={m.full_name}
          clinicId={clinicId}
          onSet={(password) =>
            setPwFn({ data: { clinic_id: clinicId, user_id: m.user_id, password } })
          }
        />
      ))}
      <p className="text-xs text-muted-foreground">
        Share the new password with the clinic manager. They can sign in at{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">/clinicmanager</code>.
      </p>
    </div>
  );
}

function ManagerRow({
  userId,
  email,
  fullName,
  onSet,
}: {
  userId: string;
  email: string | null;
  fullName: string | null;
  clinicId: string;
  onSet: (password: string) => Promise<unknown>;
}) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  function generate() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let p = "";
    const arr = new Uint32Array(12);
    crypto.getRandomValues(arr);
    for (let i = 0; i < arr.length; i++) p += chars[arr[i] % chars.length];
    setPassword(p);
    setShow(true);
  }

  async function save() {
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSaving(true);
    try {
      await onSet(password);
      toast.success("Password updated. Share it with the manager.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {fullName || email || userId}
          </p>
          {email && (
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          )}
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
          <KeyRound className="size-3" /> Manager
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Input
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Set a new password"
            className="pr-9 font-mono"
          />
          <button
            type="button"
            onClick={async () => {
              if (!password) return;
              await navigator.clipboard.writeText(password);
              toast.success("Password copied to clipboard");
            }}
            disabled={!password}
            className="absolute inset-y-0 right-9 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
            aria-label="Copy password"
          >
            <Copy className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={generate}>
          Generate
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={saving || password.length < 6}>
          {saving ? "Saving…" : "Set password"}
        </Button>
      </div>
    </div>
  );
}

