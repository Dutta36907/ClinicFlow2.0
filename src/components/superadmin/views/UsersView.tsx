// All registered profiles plus their assigned roles, server-paginated.
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserCircle, ShieldCheck, Stethoscope, CalendarCheck2 } from "lucide-react";
import { TablePagination } from "./shared/TablePagination";
import { useTablePagination } from "./shared/useTablePagination";

const ROLE_META: Record<string, { label: string; icon: typeof Users; tone: string }> = {
  admin: { label: "Admin", icon: ShieldCheck, tone: "bg-primary/10 text-primary ring-primary/20" },
  doctor: {
    label: "Doctor",
    icon: Stethoscope,
    tone: "bg-chart-1/10 text-[color:var(--chart-1)] ring-[color:var(--chart-1)]/20",
  },
  receptionist: {
    label: "Receptionist",
    icon: CalendarCheck2,
    tone: "bg-chart-2/10 text-[color:var(--chart-2)] ring-[color:var(--chart-2)]/20",
  },
  user: { label: "User", icon: UserCircle, tone: "bg-muted text-muted-foreground ring-border" },
};

function RoleBadge({ role }: { role: string }) {
  const meta = ROLE_META[role] ?? {
    label: role,
    icon: UserCircle,
    tone: "bg-muted text-muted-foreground ring-border",
  };
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${meta.tone}`}
    >
      <Icon className="size-3" />
      {meta.label}
    </span>
  );
}

export function UsersView() {
  const { page, size, from, to } = useTablePagination();
  const q = useQuery({
    queryKey: ["sa-users", { page, size }],
    queryFn: async () => {
      const { data: profiles, count } = await supabase
        .from("profiles")
        .select("id, full_name, phone, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      const ids = (profiles ?? []).map((p) => p.id);
      const byUser = new Map<string, string[]>();
      if (ids.length > 0) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", ids);
        (roles ?? []).forEach((r) => {
          const arr = byUser.get(r.user_id) ?? [];
          arr.push(r.role);
          byUser.set(r.user_id, arr);
        });
      }
      const rows = (profiles ?? []).map((p) => ({ ...p, roles: byUser.get(p.id) ?? [] }));
      return { rows, total: count ?? 0 };
    },
    placeholderData: keepPreviousData,
  });
  const rows = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;

  return (
    <SuperAdminLayout title="Users" subtitle="All registered accounts">
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Roles</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-9 rounded-lg" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-3.5 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-3.5 w-24" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-3.5 w-20" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-0">
                    <EmptyState
                      icon={Users}
                      title="No users yet"
                      description="Registered accounts will appear here."
                    />
                  </td>
                </tr>
              ) : (
                rows.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-border last:border-0 transition-colors hover:bg-muted/40"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/15">
                          <UserCircle className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{u.full_name || "—"}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {u.id.slice(0, 8)}…
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.phone || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {u.roles.length === 0 ? (
                          <span className="text-xs text-muted-foreground">none</span>
                        ) : (
                          u.roles.map((r: string) => <RoleBadge key={r} role={r} />)
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination total={total} />
      </div>
    </SuperAdminLayout>
  );
}
