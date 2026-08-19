// Audit log table with server-side pagination.
import { useQuery } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { TablePagination } from "./shared/TablePagination";
import { useTablePagination } from "./shared/useTablePagination";

export function AuditView() {
  const { from, to, size, page } = useTablePagination();
  const q = useQuery({
    queryKey: ["sa-audit", { page, size }],
    queryFn: async () => {
      const { data, count } = await supabase
        .from("audit_log")
        .select("id, action, target_type, target_id, created_at, actor_user_id", {
          count: "exact",
        })
        .order("created_at", { ascending: false })
        .range(from, to);
      return { rows: data ?? [], total: count ?? 0 };
    },
    placeholderData: keepPreviousData,
  });

  const rows = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;

  return (
    <SuperAdminLayout
      title="Audit log"
      subtitle={`${total} platform event${total === 1 ? "" : "s"}`}
    >
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Actor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium">{e.action}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {e.target_type || "—"} {e.target_id ? `· ${e.target_id.slice(0, 8)}…` : ""}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {e.actor_user_id?.slice(0, 8) ?? "system"}…
                  </td>
                </tr>
              ))}
              {!q.isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No audit events yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination total={total} />
      </div>
    </SuperAdminLayout>
  );
}
