// Clinic owners (managers) listed one per clinic with activation/expiry.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { listAllCustomers, type Customer } from "@/lib/superadmin.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Search } from "lucide-react";

type StatusFilter = "all" | "active" | "expired" | "inactive" | "expiring";

function statusFor(c: {
  is_active: boolean;
  expires_at: string | null;
}): "active" | "expired" | "inactive" {
  if (!c.is_active) return "inactive";
  if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) return "expired";
  return "active";
}

export function CustomersView() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const fetchCustomers = useServerFn(listAllCustomers);

  const q = useQuery({
    queryKey: ["sa-customers"],
    queryFn: () => fetchCustomers(),
  });

  const rows = useMemo<Customer[]>(() => {
    const list: Customer[] = q.data?.customers ?? [];
    return list.filter((c: Customer) => {
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
        c.full_name?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.clinic_name?.toLowerCase().includes(term);
      return matchStatus && matchSearch;
    });
  }, [q.data, status, search]);

  return (
    <SuperAdminLayout
      title="Customers"
      subtitle={`${rows.length} clinic owner${rows.length === 1 ? "" : "s"}`}
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:w-[280px]">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or clinic"
            className="h-9 w-full pl-8"
          />
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <span className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">Status</span>
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
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Clinic</th>
                <th className="px-4 py-3">Activated</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No customers match the current filters.
                  </td>
                </tr>
              ) : (
                rows.map((c: Customer) => {
                  const s = statusFor(c);
                  return (
                    <tr
                      key={`${c.clinic_id}-${c.user_id ?? "none"}`}
                      className="border-b border-border last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-medium">{c.full_name || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.email || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{c.clinic_name}</div>
                        <div className="text-xs text-muted-foreground">/{c.clinic_slug}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {format(new Date(c.activation_date), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.expires_at ? format(new Date(c.expires_at), "MMM d, yyyy") : "Never"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={s === "active" ? "default" : "secondary"}
                          className={
                            s === "active"
                              ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                              : s === "expired"
                                ? "bg-destructive/15 text-destructive hover:bg-destructive/20"
                                : ""
                          }
                        >
                          {s}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
