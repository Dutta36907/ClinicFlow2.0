// Appointments flat list with clinic / status / date filters.
// Server-paginated (25 default) via .range().
import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { ClinicFilter } from "./ClinicFilter";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TablePagination } from "./shared/TablePagination";
import { useTablePagination } from "./shared/useTablePagination";

type Appt = {
  id: string;
  patient_name: string;
  patient_phone: string;
  status: string;
  scheduled_at: string;
  clinic_id: string;
  doctor_id: string;
};

type Clinic = { id: string; name: string };
type Doctor = { id: string; name: string };

type DateRange = "today" | "7d" | "30d" | "all";

function rangeStart(r: DateRange): string | null {
  if (r === "all") return null;
  const d = new Date();
  if (r === "today") d.setHours(0, 0, 0, 0);
  else if (r === "7d") d.setDate(d.getDate() - 7);
  else if (r === "30d") d.setDate(d.getDate() - 30);
  return d.toISOString();
}

export function AppointmentsView() {
  const [clinicFilter, setClinicFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [range, setRange] = useState<DateRange>("30d");
  const { page, size, from, to, resetPage } = useTablePagination();

  // Reset to page 1 whenever filters change.
  useEffect(() => {
    resetPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicFilter, statusFilter, range]);

  // Lookup tables are bounded to keep filter dropdowns light.
  const clinicsQ = useQuery({
    queryKey: ["sa-clinics-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("clinics").select("id, name").order("name").limit(200);
      return (data ?? []) as Clinic[];
    },
  });

  const doctorsQ = useQuery({
    queryKey: ["sa-doctors-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("doctors").select("id, name").limit(500);
      return (data ?? []) as Doctor[];
    },
  });

  const apptsQ = useQuery({
    queryKey: ["sa-appts", { page, size, clinicFilter, statusFilter, range }],
    queryFn: async () => {
      let q = supabase
        .from("appointments")
        .select("id, patient_name, patient_phone, status, scheduled_at, clinic_id, doctor_id", {
          count: "exact",
        })
        .order("scheduled_at", { ascending: false });
      if (clinicFilter !== "all") q = q.eq("clinic_id", clinicFilter);
      if (statusFilter !== "all")
        q = q.eq(
          "status",
          statusFilter as "pending" | "confirmed" | "completed" | "cancelled" | "rescheduled",
        );
      const start = rangeStart(range);
      if (start) q = q.gte("scheduled_at", start);
      q = q.range(from, to);
      const { data, count } = await q;
      return { rows: (data ?? []) as Appt[], total: count ?? 0 };
    },
    placeholderData: keepPreviousData,
  });

  const total = apptsQ.data?.total ?? 0;
  const rows = apptsQ.data?.rows ?? [];

  const clinicMap = useMemo(() => {
    const m = new Map<string, string>();
    (clinicsQ.data ?? []).forEach((c) => m.set(c.id, c.name));
    return m;
  }, [clinicsQ.data]);

  const doctorMap = useMemo(() => {
    const m = new Map<string, string>();
    (doctorsQ.data ?? []).forEach((d) => m.set(d.id, d.name));
    return m;
  }, [doctorsQ.data]);

  return (
    <SuperAdminLayout
      title="Appointments"
      subtitle={`${total} appointment${total === 1 ? "" : "s"}`}
    >
      <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-border bg-card/60 p-3 shadow-sm backdrop-blur sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <div className="flex shrink-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Filter className="size-3.5" /> Filters
        </div>
        <ClinicFilter
          value={clinicFilter}
          onChange={setClinicFilter}
          clinics={clinicsQ.data ?? []}
        />

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <span className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
            Status
          </span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-full sm:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="rescheduled">Rescheduled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <span className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
            Range
          </span>
          <Select value={range} onValueChange={(v) => setRange(v as DateRange)}>
            <SelectTrigger className="h-9 w-full sm:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {apptsQ.isLoading ? (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <EmptyState
            icon={CalendarDays}
            title="No appointments match"
            description="Adjust your filters to widen the search range."
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Patient</th>
                  <th className="px-4 py-2.5">Phone</th>
                  <th className="px-4 py-2.5">Clinic</th>
                  <th className="px-4 py-2.5">Doctor</th>
                  <th className="px-4 py-2.5">When</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-border last:border-0 transition-colors hover:bg-muted/40"
                  >
                    <td className="px-4 py-3 font-medium">{a.patient_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {a.patient_phone}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {clinicMap.get(a.clinic_id) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {doctorMap.get(a.doctor_id) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                      {new Date(a.scheduled_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={a.status as Parameters<typeof StatusBadge>[0]["status"]}
                      />
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
