import { useMemo, useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Plus,
  Check,
  ChevronRight,
  ChevronLeft,
  CalendarIcon,
  Building2,
  Phone,
  MapPin,
  ToggleRight,
  Sparkles,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { checkSlugAvailable, createClinic } from "@/lib/superadmin.functions";
import {
  validateField,
  validateStep,
  STEP_FIELDS,
  type WizardForm,
} from "@/lib/validation/add-clinic";
import { useSuperAdminPermissions } from "@/hooks/useSuperAdminPermissions";
import { ShieldAlert } from "lucide-react";

type FormState = {
  name: string;
  slug: string;
  slugTouched: boolean;
  phone: string;
  email: string;
  whatsapp: string;
  website: string;
  address: string;
  google_map_url: string;
  is_active: boolean;
  preset: "1" | "30" | "60" | "90" | "365" | "custom" | "none";
  customDate: Date | undefined;
  manager_full_name: string;
  manager_email: string;
  manager_password: string;
};

const initial: FormState = {
  name: "",
  slug: "",
  slugTouched: false,
  phone: "",
  email: "",
  whatsapp: "",
  website: "",
  address: "",
  google_map_url: "",
  is_active: false,
  preset: "30",
  customDate: undefined,
  manager_full_name: "",
  manager_email: "",
  manager_password: "",
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const STEPS = [
  { id: 1, title: "Basics", icon: Building2 },
  { id: 2, title: "Contact", icon: Phone },
  { id: 3, title: "Location", icon: MapPin },
  { id: 4, title: "Activation", icon: ToggleRight },
  { id: 5, title: "Manager", icon: KeyRound },
  { id: 6, title: "Review", icon: Sparkles },
] as const;

export function AddClinicWizard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initial);
  const [slugState, setSlugState] = useState<
    "idle" | "checking" | "ok" | "taken" | "invalid"
  >("idle");
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof WizardForm, string>>>({});
  const [touched, setTouched] = useState<Set<keyof WizardForm>>(new Set());
  const qc = useQueryClient();
  const checkSlugFn = useServerFn(checkSlugAvailable);
  const createClinicFn = useServerFn(createClinic);
  const { data: perms } = useSuperAdminPermissions();
  const canActivate = perms?.can_subscriptions ?? false;

  function reset() {
    setForm({ ...initial, is_active: canActivate });
    setStep(1);
    setSlugState("idle");
    setErrors({});
    setTouched(new Set());
  }

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    // live-clear an existing error as the user types
    if (errors[key as keyof WizardForm]) {
      setErrors((e) => ({ ...e, [key]: undefined }));
    }
  }

  function onBlur(key: keyof WizardForm) {
    setTouched((t) => new Set(t).add(key));
    const value = (form as unknown as Record<string, string>)[key] ?? "";
    const err = validateField(key, value);
    setErrors((e) => ({ ...e, [key]: err ?? undefined }));
  }

  // Auto-slug when name changes, unless user has touched slug
  useEffect(() => {
    if (!form.slugTouched) {
      setForm((f) => ({ ...f, slug: slugify(f.name) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.name]);

  // Debounced slug availability check
  useEffect(() => {
    if (!form.slug) {
      setSlugState("idle");
      return;
    }
    setSlugState("checking");
    const t = setTimeout(async () => {
      try {
        const r = await checkSlugFn({ data: { slug: form.slug } });
        if (r.reason === "invalid") setSlugState("invalid");
        else setSlugState(r.available ? "ok" : "taken");
      } catch {
        setSlugState("idle");
      }
    }, 350);
    return () => clearTimeout(t);
  }, [form.slug, checkSlugFn]);

  const expiresAt = useMemo(() => {
    if (form.preset === "none") return null;
    if (form.preset === "custom") return form.customDate?.toISOString() ?? null;
    const days = parseInt(form.preset, 10);
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
  }, [form.preset, form.customDate]);

  const bookingUrl =
    typeof window !== "undefined" ? `${window.location.origin}/${form.slug}` : `/${form.slug}`;
  const managerUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/${form.slug}/clinicmanager`
      : `/${form.slug}/clinicmanager`;

  const stepValid = validateStep(step, form as unknown as WizardForm).ok;
  const canNext = (() => {
    if (step === 1) return stepValid && slugState === "ok";
    if (step === 4) {
      if (form.preset === "custom") return !!form.customDate;
      return true;
    }
    return stepValid;
  })();

  function tryAdvance() {
    const r = validateStep(step, form as unknown as WizardForm);
    if (!r.ok) {
      setErrors((e) => ({ ...e, ...r.errors }));
      setTouched((t) => {
        const next = new Set(t);
        (STEP_FIELDS[step] ?? []).forEach((k) => next.add(k));
        return next;
      });
      return;
    }
    setStep((s) => s + 1);
  }

  async function onSubmit() {
    setSubmitting(true);
    try {
      const res = await createClinicFn({
        data: {
          name: form.name.trim(),
          slug: form.slug,
          phone: form.phone.trim(),
          email: form.email.trim(),
          whatsapp: form.whatsapp.trim(),
          website: form.website.trim(),
          address: form.address.trim(),
          google_map_url: form.google_map_url.trim(),
          is_active: canActivate ? form.is_active : false,
          expires_at: expiresAt,
          manager_full_name: form.manager_full_name.trim(),
          manager_email: form.manager_email.trim(),
          manager_password: form.manager_password,
        },
      });
      const desc = res.manager.existed
        ? `Existing user ${res.manager.email} was granted manager access (password unchanged).`
        : `Manager login created for ${res.manager.email}.`;
      toast.success(`Clinic “${form.name}” created`, { description: desc });
      qc.invalidateQueries({ queryKey: ["all-clinics"] });
      qc.invalidateQueries({ queryKey: ["sa-stats"] });
      qc.invalidateQueries({ queryKey: ["sa-recent-clinics"] });
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create clinic");
    } finally {
      setSubmitting(false);
    }
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <Plus className="size-4" /> New clinic
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl p-0 sm:max-w-2xl overflow-x-hidden">
        <DialogHeader className="border-b border-border bg-gradient-to-br from-primary/5 via-card to-card px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/20">
              <Sparkles className="size-4" />
            </span>
            <div>
              <DialogTitle>Onboard a new clinic</DialogTitle>
              <p className="text-xs text-muted-foreground">
                Step {step} of {STEPS.length} · {STEPS[step - 1]?.title}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Stepper */}
        <ol className="flex items-center gap-1 border-b border-border bg-card px-6 py-4 overflow-x-auto">
          {STEPS.map((s, i) => {
            const active = step === s.id;
            const done = step > s.id;
            return (
              <li key={s.id} className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "relative grid size-8 place-items-center rounded-full border text-xs font-semibold transition-all",
                    active &&
                      "border-primary bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/30 ring-4 ring-primary/15",
                    done && "border-primary/40 bg-primary/10 text-primary",
                    !active && !done && "border-border bg-card text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" /> : s.id}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium whitespace-nowrap transition-colors",
                    active
                      ? "text-foreground"
                      : done
                        ? "text-primary"
                        : "text-muted-foreground",
                  )}
                >
                  {s.title}
                </span>
                {i < STEPS.length - 1 && (
                  <span
                    className={cn(
                      "mx-1 h-0.5 w-6 rounded-full transition-colors",
                      done ? "bg-primary/60" : "bg-border",
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Clinic name *</Label>
                <Input
                  id="name"
                  autoFocus
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  onBlur={() => onBlur("name")}
                  placeholder="Apollo Wellness Centre"
                  aria-invalid={!!(touched.has("name") && errors.name)}
                />
                <FieldError msg={touched.has("name") ? errors.name : undefined} />
              </div>
              <div>
                <Label htmlFor="slug">URL slug *</Label>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      slug: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                      slugTouched: true,
                    })
                  }
                  onBlur={() => onBlur("slug")}
                  placeholder="apollo-wellness"
                  aria-invalid={!!(touched.has("slug") && errors.slug)}
                />
                <div className="mt-1.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate">
                    Booking page: <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">{bookingUrl}</code>
                  </span>
                  <SlugBadge state={slugState} />
                </div>
                <FieldError msg={touched.has("slug") ? errors.slug : undefined} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone number" value={form.phone} onChange={(v) => setField("phone", v)} onBlur={() => onBlur("phone")} error={touched.has("phone") ? errors.phone : undefined} placeholder="+91 98765 43210" />
              <Field label="Email" type="email" value={form.email} onChange={(v) => setField("email", v)} onBlur={() => onBlur("email")} error={touched.has("email") ? errors.email : undefined} placeholder="hello@clinic.com" />
              <Field label="WhatsApp number" value={form.whatsapp} onChange={(v) => setField("whatsapp", v)} onBlur={() => onBlur("whatsapp")} error={touched.has("whatsapp") ? errors.whatsapp : undefined} placeholder="+91 98765 43210" />
              <Field label="Website" type="url" value={form.website} onChange={(v) => setField("website", v)} onBlur={() => onBlur("website")} error={touched.has("website") ? errors.website : undefined} placeholder="https://clinic.com" />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="addr">Clinic address</Label>
                <Textarea
                  id="addr"
                  value={form.address}
                  onChange={(e) => setField("address", e.target.value)}
                  onBlur={() => onBlur("address")}
                  placeholder="123 Health Avenue, Bangalore 560001"
                  rows={3}
                />
                <FieldError msg={touched.has("address") ? errors.address : undefined} />
              </div>
              <Field
                label="Google Maps URL"
                type="url"
                value={form.google_map_url}
                onChange={(v) => setField("google_map_url", v)}
                onBlur={() => onBlur("google_map_url")}
                error={touched.has("google_map_url") ? errors.google_map_url : undefined}
                placeholder="https://maps.app.goo.gl/..."
              />
              <Collapsible>
                <div className="flex items-center justify-between gap-2">
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="h-auto gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
                      <HelpCircle className="size-3.5" />
                      How do I get this link?
                    </Button>
                  </CollapsibleTrigger>
                  <Button type="button" variant="outline" size="sm" asChild className="h-7 gap-1 text-xs">
                    <a href="https://maps.google.com" target="_blank" rel="noreferrer">
                      Open Google Maps <ExternalLink className="size-3" />
                    </a>
                  </Button>
                </div>
                <CollapsibleContent className="mt-2 rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
                  <ol className="list-inside list-decimal space-y-1">
                    <li>Open Google Maps and search for your clinic.</li>
                    <li>Click your clinic name to open its details panel.</li>
                    <li>
                      Click <strong className="text-foreground">Share</strong> →{" "}
                      <strong className="text-foreground">Copy link</strong>.
                    </li>
                    <li>
                      Paste it here. Valid links look like:
                      <ul className="mt-1 list-inside list-disc pl-2 font-mono text-[11px]">
                        <li>https://maps.app.goo.gl/…</li>
                        <li>https://www.google.com/maps/place/…</li>
                      </ul>
                    </li>
                  </ol>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              {!canActivate && (
                <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Activation is Super Admin only</p>
                    <p className="text-xs text-muted-foreground">
                      This clinic will be created as <strong className="text-foreground">Inactive</strong>.
                      You can still set when the subscription should expire — the Super Admin will activate it from the Subscriptions tab.
                    </p>
                  </div>
                </div>
              )}

              {canActivate && (
                <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Clinic is active</p>
                    <p className="text-xs text-muted-foreground">
                      When off, the booking page shows a closed message.
                    </p>
                  </div>
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                  />
                </div>
              )}

              <div>
                <Label className="mb-2 block">Active till</Label>
                <RadioGroup
                  value={form.preset}
                  onValueChange={(v) => setForm({ ...form, preset: v as FormState["preset"] })}
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
                      htmlFor={`p-${p.v}`}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                        form.preset === p.v
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      <RadioGroupItem id={`p-${p.v}`} value={p.v} />
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
                        disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
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
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-xs text-muted-foreground">
                Create the first clinic manager login. They will sign in at{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                  {managerUrl}
                </code>{" "}
                to manage doctors, appointments, and the booking page.
              </div>
              <Field
                label="Manager full name *"
                value={form.manager_full_name}
                onChange={(v) => setField("manager_full_name", v)}
                onBlur={() => onBlur("manager_full_name")}
                error={touched.has("manager_full_name") ? errors.manager_full_name : undefined}
                placeholder="Dr. Priya Sharma"
              />
              <Field
                label="Manager email *"
                type="email"
                value={form.manager_email}
                onChange={(v) => setField("manager_email", v)}
                onBlur={() => onBlur("manager_email")}
                error={touched.has("manager_email") ? errors.manager_email : undefined}
                placeholder="manager@clinic.com"
              />
              <div>
                <Label>Manager password *</Label>
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    value={form.manager_password}
                    onChange={(e) => setField("manager_password", e.target.value)}
                    onBlur={() => onBlur("manager_password")}
                    placeholder="Minimum 8 characters, letters + numbers"
                    className="pr-20"
                    aria-invalid={!!(touched.has("manager_password") && errors.manager_password)}
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => setShowPw((s) => !s)}
                    >
                      {showPw ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={!form.manager_password}
                      onClick={() => copy(form.manager_password, "Password")}
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                </div>
                <FieldError msg={touched.has("manager_password") ? errors.manager_password : undefined} />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Share these credentials with the clinic manager — they can
                  change the password after first login.
                </p>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Summary</p>
                <h3 className="mt-1 text-lg font-semibold">{form.name || "—"}</h3>
                <p className="text-xs text-muted-foreground">/{form.slug}</p>
                <Separator className="my-3" />
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <Row k="Phone" v={form.phone} />
                  <Row k="Email" v={form.email} />
                  <Row k="WhatsApp" v={form.whatsapp} />
                  <Row k="Website" v={form.website} />
                  <Row k="Address" v={form.address} />
                  <Row k="Map" v={form.google_map_url} />
                  <Row k="Active" v={form.is_active ? "Yes" : "No"} />
                  <Row k="Expires" v={expiresAt ? format(new Date(expiresAt), "PPP") : "Never"} />
                </dl>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Manager login
                </p>
                <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                  <Row k="Name" v={form.manager_full_name} />
                  <Row k="Email" v={form.manager_email} />
                </dl>
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs">
                    {"•".repeat(Math.min(form.manager_password.length, 16))}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => copy(form.manager_password, "Password")}
                  >
                    <Copy className="mr-1 size-3.5" /> Copy
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-dashed border-border p-4 text-xs">
                <p className="font-medium text-foreground">Generated URLs</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-muted-foreground shrink-0">Booking:</span>
                  <code className="flex-1 truncate text-foreground">{bookingUrl}</code>
                  <Button type="button" size="icon" variant="ghost" className="size-7" onClick={() => copy(bookingUrl, "Booking URL")}>
                    <Copy className="size-3.5" />
                  </Button>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-muted-foreground shrink-0">Manager:</span>
                  <code className="flex-1 truncate text-foreground">{managerUrl}</code>
                  <Button type="button" size="icon" variant="ghost" className="size-7" onClick={() => copy(managerUrl, "Manager URL")}>
                    <Copy className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border bg-gradient-to-br from-muted/30 to-muted/10 px-6 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1 || submitting}
          >
            <ChevronLeft className="size-4" /> Back
          </Button>
          <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
            {step} / {STEPS.length}
          </span>
          {step < STEPS.length ? (
            <Button size="sm" onClick={tryAdvance} disabled={!canNext} className="group">
              Next
              <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onSubmit}
              disabled={submitting || !canNext}
              className="bg-gradient-to-r from-primary to-primary/85 shadow-sm shadow-primary/20"
            >
              {submitting ? "Creating…" : (
                <>
                  <Check className="size-4" /> Create clinic
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-invalid={!!error}
      />
      <FieldError msg={error} />
    </div>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-destructive">{msg}</p>;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="truncate font-medium">{v || "—"}</dd>
    </div>
  );
}

function SlugBadge({ state }: { state: "idle" | "checking" | "ok" | "taken" | "invalid" }) {
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
