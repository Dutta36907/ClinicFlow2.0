// All doctors in a single flat table with clinic column, server-paginated.
import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Stethoscope } from "lucide-react";
import { ClinicFilter } from "./ClinicFilter";
import { TablePagination } from "./shared/TablePagination";
import { useTablePagination } from "./shared/useTablePagination";

type Doctor = {
  id: string;
  name: string;
  specialization: string | null;
  is_active: boolean;
  clinic_id: string;
};

type Clinic = { id: string; name: string };

export function DoctorsView() {
  const [clinicFilter, setClinicFilter] = useState<string>("all");
  const { page, size, from, to, resetPage } = useTablePagination();

  // Reset page when filter changes.
  useEffect(() => {
    resetPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicFilter]);

  const clinicsQ = useQuery({
    queryKey: ["sa-clinics-lookup"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clinics")
        .select("id, name")
        .order("name");
      return (data ?? []) as Clinic[];
    },
  });

  const doctorsQ = useQuery({
    queryKey: ["sa-doctors", { page, size, clinicFilter }],
    queryFn: async () => {
      let q = supabase
        .from("doctors")
        .select("id, name, specialization, is_active, clinic_id", { count: "exact" })
        .order("name")
        .range(from, to);
      if (clinicFilter !== "all") q = q.eq("clinic_id", clinicFilter);
      const { data, count } = await q;
      return { rows: (data ?? []) as Doctor[], total: count ?? 0 };
    },
    placeholderData: keepPreviousData,
  });

  const clinicMap = useMemo(() => {
    const m = new Map<string, string>();
    (clinicsQ.data ?? []).forEach((c) => m.set(c.id, c.name));
    return m;
  }, [clinicsQ.data]);

  const rows = useMemo(() => {
    const all = doctorsQ.data?.rows ?? [];
    return all
      .map((d) => ({ ...d, clinicName: clinicMap.get(d.clinic_id) ?? "Unknown clinic" }))
      .sort((a, b) =>
        a.clinicName.localeCompare(b.clinicName) || a.name.localeCompare(b.name),
      );
  }, [doctorsQ.data, clinicMap]);

  const total = doctorsQ.data?.total ?? 0;
  const active = rows.filter((d) => d.is_active).length;

  return (
    <SuperAdminLayout
      title="Doctors"
      subtitle={`${total} doctor${total === 1 ? "" : "s"} • ${active} active`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <ClinicFilter
          value={clinicFilter}
          onChange={setClinicFilter}
          clinics={clinicsQ.data ?? []}
        />
      </div>

      {doctorsQ.isLoading ? (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <EmptyState
            icon={Stethoscope}
            title="No doctors found"
            description="Try adjusting the clinic filter to see more results."
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Clinic</th>
                  <th className="px-4 py-2.5">Specialization</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-border last:border-0 transition-colors hover:bg-muted/40"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-xs font-semibold text-primary ring-1 ring-primary/15">
                          {d.name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="font-medium">{d.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{d.clinicName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {d.specialization || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          d.is_active
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "border-border bg-muted text-muted-foreground"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${d.is_active ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                        />
                        {d.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination total={total} />
        </div>
      )}
    </SuperAdminLayout>
  );
}
