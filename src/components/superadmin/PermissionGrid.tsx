import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { PermissionKey } from "@/hooks/useSuperAdminPermissions";

export const PERMISSION_LABELS: { key: PermissionKey; label: string }[] = [
  { key: "can_dashboard", label: "Dashboard" },
  { key: "can_clinics", label: "Clinic Manage" },
  { key: "can_doctors", label: "Doctors Manage" },
  { key: "can_appointments", label: "Appointments" },
  { key: "can_clinic_settings", label: "Clinic Settings" },
  { key: "can_enquiries", label: "Enquiry" },
  { key: "can_customers", label: "Customers" },
  { key: "can_subscriptions", label: "Subscriptions" },
  { key: "can_users", label: "System Users" },
  { key: "can_user_roles", label: "User Roles" },
  { key: "can_audit", label: "Audit log" },
  { key: "can_monitoring", label: "System Monitoring" },
];

export type Perms = Record<PermissionKey, boolean>;

export const ALL_FALSE: Perms = PERMISSION_LABELS.reduce(
  (acc, p) => ({ ...acc, [p.key]: false }),
  {} as Perms,
);
export const ALL_TRUE: Perms = PERMISSION_LABELS.reduce(
  (acc, p) => ({ ...acc, [p.key]: true }),
  {} as Perms,
);

export function PermissionGrid({
  value,
  onChange,
  disabled,
}: {
  value: Perms;
  onChange: (v: Perms) => void;
  disabled?: boolean;
}) {
  const selectedCount = PERMISSION_LABELS.reduce((n, p) => n + (value[p.key] ? 1 : 0), 0);
  const total = PERMISSION_LABELS.length;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span
          className={
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums " +
            (selectedCount === 0
              ? "border-border bg-muted text-muted-foreground"
              : selectedCount === total
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                : "border-primary/30 bg-primary/10 text-primary")
          }
        >
          <span className="size-1.5 rounded-full bg-current" />
          {selectedCount} / {total} granted
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => onChange(ALL_TRUE)}
          >
            Select all
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() => onChange(ALL_FALSE)}
          >
            Clear
          </Button>
        </div>
      </div>
      <div className="grid gap-1.5 rounded-xl border border-border bg-card p-3 sm:grid-cols-2">
        {PERMISSION_LABELS.map((p) => {
          const on = value[p.key];
          return (
            <label
              key={p.key}
              className={
                "flex cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-1.5 transition-colors " +
                (on
                  ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
                  : "border-transparent hover:border-border/60 hover:bg-muted/50")
              }
            >
              <Checkbox
                checked={on}
                disabled={disabled}
                onCheckedChange={(v) => onChange({ ...value, [p.key]: v === true })}
              />
              <span
                className={
                  "text-sm " + (on ? "font-medium text-foreground" : "text-muted-foreground")
                }
              >
                {p.label}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
