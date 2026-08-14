// Subscriptions: every clinic's activation status with quick Active/Inactive toggle.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { listAllCustomers, setClinicActive, type Customer } from "@/lib/superadmin.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { Flag, Search, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EditSubscriptionDialog } from "@/components/superadmin/EditSubscriptionDialog";
import { Button } from "@/components/ui/button";

type StatusKind = "active" | "inactive" | "expired";
type StatusFilter = "all" | StatusKind | "expiring";

function statusFor(c: { is_active: boolean; expires_at: string | null }): StatusKind {
  if (!c.is_active) return "inactive";
  if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) return "expired";
  return "active";
}

function StatusPill({ status }: { status: StatusKind }) {
  const styles: Record<StatusKind, string> = {
    active: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
    inactive: "bg-muted text-muted-foreground ring-border",
    expired: "bg-destructive/10 text-destructive ring-destructive/25",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset",
        styles[status],
      )}
    >
      {status === "expired" ? (
        <Flag className="size-3" />
      ) : (
        <span className="size-1.5 rounded-full bg-current opacity-70" />
      )}
      {status}
    </span>
  );
}

export function SubscriptionsView() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const fetchCustomers = useServerFn(listAllCustomers);
  const toggleActive = useServerFn(setClinicActive);

  const q = useQuery({
    queryKey: ["sa-customers"],
    queryFn: () => fetchCustomers(),
  });

  const mutation = useMutation({
    mutationFn: (vars: { clinicId: string; isActive: boolean }) => toggleActive({ data: vars }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["sa-customers"] });
      const prev = qc.getQueryData<{ customers: Customer[] }>(["sa-customers"]);
      if (prev) {
        qc.setQueryData(["sa-customers"], {
          customers: prev.customers.map((c) =>
            c.clinic_id === vars.clinicId ? { ...c, is_active: vars.isActive } : c,
          ),
        });
      }
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["sa-customers"], ctx.prev);
      toast.error(err instanceof Error ? err.message : "Failed to update");
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.isActive ? "Clinic activated" : "Clinic deactivated");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["sa-customers"] }),
  });

  const rows = useMemo<Customer[]>(() => {
    const list: Customer[] = q.data?.customers ?? [];
    return list.filter((c) => {
      const s = statusFor(c);
      const matchStatus =
        status === "all" ||
        (status === "expiring"
          ? c.expires_at &&
            new Date(c.expires_at).getTime() > Date.now() &&
            new Date(c.expires_at).getTime() < Date.now() + 30 * 24 * 60 * 60 * 1000
          : s === status);
      const term = search.trim().toLowerCase();
      const matchSearch =
        !term ||
        c.clinic_name?.toLowerCase().includes(term) ||
        c.full_name?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.toLowerCase().includes(term);
      return matchStatus && matchSearch;
    });
  }, [q.data, status, search]);

  return (
    <SuperAdminLayout
      title="Subscriptions"
      subtitle={`${rows.length} clinic${rows.length === 1 ? "" : "s"}`}
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:w-[320px]">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by clinic, customer, email, or phone"
            className="h-9 w-full pl-8"
          />
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <span className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
            Status
          </span>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="h-9 w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expiring">Expiring (30d)</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="-mx-4 sm:mx-0 rounded-none sm:rounded-2xl border-y sm:border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Clinic Name</th>
                <th className="px-4 py-3">DOA</th>
                <th className="px-4 py-3">DOE</th>
                <th className="px-4 py-3">Customer Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Active</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    No clinics match the current filters.
                  </td>
                </tr>
              ) : (
                rows.map((c) => {
                  const s = statusFor(c);
                  const pending =
                    mutation.isPending && mutation.variables?.clinicId === c.clinic_id;
                  return (
                    <tr
                      key={c.clinic_id}
                      className="border-b border-border last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{c.clinic_name}</div>
                        <div className="text-xs text-muted-foreground">/{c.clinic_slug}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {format(new Date(c.activation_date), "MMM d, yyyy")}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3",
                          s === "expired"
                            ? "text-destructive font-medium"
                            : "text-muted-foreground",
                        )}
                      >
                        {c.expires_at ? format(new Date(c.expires_at), "MMM d, yyyy") : "Never"}
                      </td>
                      <td className="px-4 py-3">{c.full_name || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.phone || "—"}</td>
                      <td className="px-4 py-3">
                        <StatusPill status={s} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <Switch
                            checked={c.is_active}
                            disabled={pending}
                            onCheckedChange={(v) =>
                              mutation.mutate({ clinicId: c.clinic_id, isActive: v })
                            }
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => setEditing(c)}
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {editing && (
        <EditSubscriptionDialog
          clinic={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
    </SuperAdminLayout>
  );
}
