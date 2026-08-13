/**
 * ProfileSection — edits the patient-facing clinic profile
 * (name, contact, address, description, logo).
 *
 * URL slug, active flag, and expiry date are read-only here: only super
 * admins can change those via the super-admin dashboard.
 */

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { Lock, Trash2, ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { updateClinicProfile } from "@/lib/clinicmanager.functions";
import {
  LIMITS,
  formatServerError,
  validateClinicProfile,
} from "@/lib/validation/clinic-forms";

import { Card, SectionShell } from "../shared/SectionShell";
import { Field, Grid, Sub, TextAreaField } from "../shared/FormPrimitives";
import { MediaLibraryDialog } from "../shared/MediaLibraryDialog";
import type { DashboardClinic } from "../types";

export function ProfileSection({ clinic }: { clinic: DashboardClinic }) {
  const qc = useQueryClient();
  const update = useServerFn(updateClinicProfile);

  // --- Local form state ---------------------------------------------------
  const [form, setForm] = useState({
    name: clinic.name,
    phone: clinic.phone ?? "",
    email: clinic.email ?? "",
    whatsapp: clinic.whatsapp ?? "",
    website: clinic.website ?? "",
    address: clinic.address ?? "",
    google_map_url: clinic.google_map_url ?? "",
    description: clinic.description ?? "",
    tagline: clinic.tagline ?? "",
    logo_url: clinic.logo_url ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as string]) {
      setErrors((e) => {
        const { [key as string]: _drop, ...rest } = e;
        return rest;
      });
    }
  }

  // --- Save handler -------------------------------------------------------
  async function onSave() {
    const v = validateClinicProfile(form);
    if (!v.ok) {
      setErrors(v.errors);
      toast.error("Please fix the highlighted fields");
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await update({ data: { id: clinic.id, ...form } });
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["manager-dashboard", clinic.slug] });
    } catch (e) {
      toast.error(formatServerError(e, "Failed to update"));
    } finally {
      setSaving(false);
    }
  }

  // --- Render -------------------------------------------------------------
  return (
    <SectionShell
      title="Clinic profile"
      description="Information shown to patients on your booking page."
      actions={
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      }
    >
      <Card className="space-y-5">
        <Sub>Basics</Sub>
        <Field
          label="Clinic name"
          required
          maxLength={LIMITS.name.max}
          value={form.name}
          onChange={(v) => setField("name", v)}
          error={errors.name}
        />

        <div className="space-y-2">
          <label className="text-sm font-medium">Logo</label>
          <div className="flex items-start gap-4">
            <div className="group flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-gradient-to-br from-muted/40 to-muted/10 ring-1 ring-border/60 transition-all hover:shadow-md hover:shadow-primary/5">
              {form.logo_url ? (
                <img
                  src={form.logo_url}
                  alt="Logo"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/15">
                  <ImageIcon className="size-5" />
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <MediaLibraryDialog
                  bucket="clinic-logos"
                  clinicId={clinic.id}
                  label={form.logo_url ? "Replace logo" : "Choose logo"}
                  recommendedHint="Square 512×512 works best"
                  onSelect={(url) => setField("logo_url", url)}
                />
                {form.logo_url && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setField("logo_url", "")}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remove logo"
                  >
                    <Trash2 className="size-4" /> Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Recommended size: 512 × 512 px (square, PNG or WebP).
              </p>
              {errors.logo_url && (
                <p className="text-xs text-destructive">{errors.logo_url}</p>
              )}
            </div>
          </div>
        </div>

        <Separator />
        <Sub>Contact</Sub>
        <Grid>
          <Field
            label="Phone"
            inputMode="tel"
            maxLength={LIMITS.phone.max}
            value={form.phone}
            onChange={(v) => setField("phone", v)}
            error={errors.phone}
          />
          <Field
            label="Email"
            type="email"
            inputMode="email"
            maxLength={LIMITS.email.max}
            value={form.email}
            onChange={(v) => setField("email", v)}
            error={errors.email}
          />
          <Field
            label="WhatsApp"
            inputMode="tel"
            maxLength={LIMITS.phone.max}
            value={form.whatsapp}
            onChange={(v) => setField("whatsapp", v)}
            error={errors.whatsapp}
          />
          <Field
            label="Website"
            type="url"
            placeholder="https://…"
            maxLength={LIMITS.url.max}
            value={form.website}
            onChange={(v) => setField("website", v)}
            error={errors.website}
          />
        </Grid>

        <Separator />
        <Sub>Location</Sub>
        <TextAreaField
          label="Address"
          rows={3}
          maxLength={LIMITS.address.max}
          value={form.address}
          onChange={(v) => setField("address", v)}
          error={errors.address}
        />
        <Field
          label="Google Maps URL"
          type="url"
          placeholder="https://maps.google.com/…"
          maxLength={LIMITS.url.max}
          value={form.google_map_url}
          onChange={(v) => setField("google_map_url", v)}
          error={errors.google_map_url}
        />

        <Separator />
        <Sub>About</Sub>
        <Field
          label="Tagline"
          maxLength={LIMITS.tagline.max}
          placeholder="e.g. Premium Multi-Specialty Hospital • Bangalore"
          value={form.tagline}
          onChange={(v) => setField("tagline", v)}
          error={errors.tagline}
        />
        <TextAreaField
          label="Description"
          rows={4}
          maxLength={LIMITS.description.max}
          placeholder="Short description shown on the booking page"
          value={form.description}
          onChange={(v) => setField("description", v)}
          error={errors.description}
        />
      </Card>

      {/* Read-only metadata — controlled by super-admin only. */}
      <Card>
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-muted to-muted/40 text-muted-foreground ring-1 ring-border/60">
            <Lock className="size-4" />
          </div>
          <div className="text-sm">
            <p className="font-medium">Super-admin controlled</p>
            <p className="mt-1 text-muted-foreground">
              URL slug{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                /{clinic.slug}
              </code>
              , active status (
              <strong className={clinic.is_active ? "text-emerald-700" : "text-muted-foreground"}>
                {clinic.is_active ? "Active" : "Inactive"}
              </strong>
              ) and expiry (
              <strong>
                {clinic.expires_at
                  ? format(new Date(clinic.expires_at), "PPP")
                  : "Never"}
              </strong>
              ) can only be changed by a super admin.
            </p>
          </div>
        </div>
      </Card>
    </SectionShell>
  );
}
