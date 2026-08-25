// Tenant management for super admins: list (server-paginated), search,
// filter, sort, edit, delete.
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  deleteClinic,
  listClinicPlans,
  listClinicsForSuperAdmin,
  setClinicActive,
} from "@/lib/superadmin.functions";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { FilterBar } from "@/components/clinicmanager/shared/FilterBar";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  KeyRound,
  Pencil,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { AddClinicWizard } from "@/components/superadmin/AddClinicWizard";
import { EditClinicDialog, type EditableClinic } from "@/components/superadmin/EditClinicDialog";

type StatusFilter = "all" | "active" | "inactive" | "expired";
type BillingFilter = "all" | "trial" | "paid";
type ExpiringWithin = 7 | 15 | 20 | 30 | undefined;
type SortKey = "name" | "expires_at" | "created_at";
type SortDir = "asc" | "desc";
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const EXPIRING_OPTIONS = [7, 15, 20, 30] as const;

type ClinicRow = EditableClinic & {
  phone?: string | null;
  email?: string | null;
  plan: string | null;
  trial_ends_at: string | null;
  created_at: string;
  user_count: number;
};

function deriveStatus(c: { is_active: boolean; expires_at: string | null }) {
  const expired = !!c.expires_at && new Date(c.expires_at).getTime() < Date.now();
  return expired ? "expired" : c.is_active ? "active" : "inactive";
}

function useDebouncedValue<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function ClinicsView() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<EditableClinic | null>(null);
  const [toDelete, setToDelete] = useState<ClinicRow | null>(null);
  const [toToggle, setToToggle] = useState<ClinicRow | null>(null);
  const [confirmSlug, setConfirmSlug] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [billing, setBilling] = useState<BillingFilter>("all");
  const [plan, setPlan] = useState<string>("");
  const [expiringWithinDays, setExpiringWithinDays] = useState<ExpiringWithin>(undefined);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  // Reset to page 1 when filters/sort/page size change.
  const filterSig = `${debouncedSearch}|${status}|${billing}|${plan}|${expiringWithinDays}|${sortKey}|${sortDir}|${pageSize}`;
  const [lastSig, setLastSig] = useState(filterSig);
  if (lastSig !== filterSig) {
    setLastSig(filterSig);
    setPage(1);
  }

  const listFn = useServerFn(listClinicsForSuperAdmin);
  const clinicsQ = useQuery({
    queryKey: [
      "all-clinics",
      {
        page,
        pageSize,
        search: debouncedSearch,
        status,
        billing,
        plan,
        expiringWithinDays,
        sortKey,
        sortDir,
      },
    ],
    queryFn: () =>
      listFn({
        data: {
          page,
          pageSize,
          search: debouncedSearch,
          status,
          billing,
          plan,
          expiringWithinDays,
          sortKey,
          sortDir,
        },
      }),
    placeholderData: keepPreviousData,
    staleTime: 5_000,
  });

  const plansFn = useServerFn(listClinicPlans);
  const plansQ = useQuery({
    queryKey: ["all-clinics-plans"],
    queryFn: () => plansFn(),
    staleTime: 60_000,
  });

  const hasActiveFilters =
    !!debouncedSearch || status !== "all" || billing !== "all" || !!plan || !!expiringWithinDays;

  const rows = clinicsQ.data?.rows ?? [];
  const total = clinicsQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;

  const deleteFn = useServerFn(deleteClinic);
  const deleteMut = useMutation({
    mutationFn: (vars: { clinicId: string; confirmSlug: string }) => deleteFn({ data: vars }),
    onSuccess: () => {
      toast.success("Clinic deleted");
      qc.invalidateQueries({ queryKey: ["all-clinics"] });
      setToDelete(null);
      setConfirmSlug("");
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Failed to delete clinic");
    },
  });

  const setActiveFn = useServerFn(setClinicActive);
  const toggleMut = useMutation({
    mutationFn: (vars: { clinicId: string; isActive: boolean }) => setActiveFn({ data: vars }),
    onSuccess: (_res, vars) => {
      toast.success(vars.isActive ? "Clinic activated" : "Clinic deactivated");
      qc.invalidateQueries({ queryKey: ["all-clinics"] });
      qc.invalidateQueries({ queryKey: ["sa-stats"] });
      qc.invalidateQueries({ queryKey: ["sa-recent-clinics"] });
      setToToggle(null);
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Failed to update status");
    },
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
    if (!active) return <ArrowUpDown className="size-3 opacity-50" />;
    return dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />;
  }

  function SortableTh({
    sortBy,
    children,
    className = "",
  }: {
    sortBy: SortKey;
    children: ReactNode;
    className?: string;
  }) {
    const active = sortKey === sortBy;
    return (
      <th className={`px-4 py-3 ${className}`}>
        <button
          type="button"
          onClick={() => toggleSort(sortBy)}
          className="inline-flex items-center gap-1.5 uppercase tracking-wide text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {children}
          <SortIcon active={active} dir={sortDir} />
        </button>
      </th>
    );
  }

  return (
    <SuperAdminLayout
      title="Clinics"
      subtitle="Onboard and manage all tenants"
      actions={<AddClinicWizard />}
    >
      <TooltipProvider delayDuration={150}>
        <div className="mb-4">
          <FilterBar
            right={
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {total} {total === 1 ? "clinic" : "clinics"}
              </span>
            }
          >
            <div className="relative w-full sm:max-w-[260px] sm:flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, phone, or email…"
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-muted/60 p-1.5">
              <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                <SelectTrigger className="h-8 w-full bg-card sm:w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              <Select value={plan || "all"} onValueChange={(v) => setPlan(v === "all" ? "" : v)}>
                <SelectTrigger className="h-8 w-full bg-card sm:w-[130px]">
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All plans</SelectItem>
                  {(plansQ.data?.plans ?? []).map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={billing} onValueChange={(v) => setBilling(v as BillingFilter)}>
                <SelectTrigger className="h-8 w-full bg-card sm:w-[130px]">
                  <SelectValue placeholder="Billing" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All billing</SelectItem>
                  <SelectItem value="trial">In trial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={expiringWithinDays ? String(expiringWithinDays) : "off"}
                onValueChange={(v) =>
                  setExpiringWithinDays(v === "off" ? undefined : (Number(v) as ExpiringWithin))
                }
              >
                <SelectTrigger className="h-8 w-full bg-card sm:w-[170px]">
                  <SelectValue placeholder="Expiring" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Expiring: off</SelectItem>
                  {EXPIRING_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      Expiring in {d} days
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </FilterBar>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-sm">
              <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <SortableTh sortBy="name">Name</SortableTh>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Plan</th>
                  <SortableTh sortBy="expires_at">Activate till</SortableTh>
                  <SortableTh sortBy="created_at">Created</SortableTh>
                  <th className="px-4 py-3">Users</th>
                  <th className="px-4 py-3 text-center">Booking URL</th>
                  <th className="px-4 py-3 text-center">Clinic Manager</th>
                  <th className="px-4 py-3 text-right">Edit</th>
                  <th className="px-4 py-3 text-right">Delete</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const s = deriveStatus(c);
                  const statusStyles: Record<typeof s, string> = {
                    active:
                      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                    inactive:
                      "border-slate-400/30 bg-slate-400/10 text-slate-600 dark:text-slate-300",
                    expired:
                      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
                  };
                  const statusDot: Record<typeof s, string> = {
                    active: "bg-emerald-500",
                    inactive: "bg-slate-400",
                    expired: "bg-amber-500",
                  };
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-border last:border-0 transition-colors hover:bg-muted/40"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/15">
                            <Building2 className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium">{c.name}</div>
                            <div className="truncate text-xs text-muted-foreground">/{c.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => setToToggle(c as ClinicRow)}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${statusStyles[s]}`}
                              aria-label={`${c.is_active ? "Deactivate" : "Activate"} ${c.name}`}
                            >
                              <span className={`size-1.5 rounded-full ${statusDot[s]}`} />
                              {s}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Click to {c.is_active ? "deactivate" : "activate"}
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="px-4 py-3">
                        {c.plan ? (
                          <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                            {c.plan}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm ${
                          s === "expired" ? "text-destructive" : "text-muted-foreground"
                        }`}
                      >
                        {c.expires_at ? format(new Date(c.expires_at), "MMM d, yyyy") : "Never"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {format(new Date(c.created_at), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                            c.user_count === 0 ? "text-destructive" : ""
                          }`}
                        >
                          <Users className="size-3.5 text-muted-foreground" />
                          {c.user_count}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 hover:bg-primary/10 hover:text-primary"
                                asChild
                              >
                                <a
                                  href={`/${c.slug}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  aria-label={`Open ${c.name} booking page`}
                                >
                                  <ExternalLink className="size-4" />
                                </a>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Open booking page</TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 hover:bg-primary/10 hover:text-primary"
                                asChild
                              >
                                <a
                                  href={`/${c.slug}/clinicmanager?via=superadmin`}
                                  target="_blank"
                                  rel="noreferrer"
                                  aria-label={`Open ${c.name} clinic manager`}
                                >
                                  <KeyRound className="size-4" />
                                </a>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Open clinic manager</TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 hover:bg-primary/10 hover:text-primary"
                                onClick={() => setEditing(c as EditableClinic)}
                                aria-label={`Edit ${c.name}`}
                              >
                                <Pencil className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit clinic</TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => {
                                  setToDelete(c as ClinicRow);
                                  setConfirmSlug("");
                                }}
                                aria-label={`Delete ${c.name}`}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete clinic</TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {clinicsQ.isLoading &&
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
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-5 w-14 rounded-md" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-10" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="mx-auto size-8">
                          <Skeleton className="size-8 rounded-md" />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="mx-auto size-8">
                          <Skeleton className="size-8 rounded-md" />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="ml-auto size-8 rounded-md" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="ml-auto size-8 rounded-md" />
                      </td>
                    </tr>
                  ))}
                {!clinicsQ.isLoading && total === 0 && (
                  <tr>
                    <td colSpan={10} className="p-0">
                      <EmptyState
                        icon={Building2}
                        title={hasActiveFilters ? "No matches" : "No clinics yet"}
                        description={
                          hasActiveFilters
                            ? "Try different search or filter values."
                            : "Onboard your first tenant to get started."
                        }
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {total > 0 && (
            <div className="flex flex-col items-stretch gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  Showing {pageStart + 1}–{Math.min(pageStart + pageSize, total)} of {total}
                </span>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="h-8 w-[88px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} / page
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="px-2 text-xs text-muted-foreground tabular-nums">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </TooltipProvider>

      {editing && (
        <EditClinicDialog
          clinic={editing}
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
        />
      )}

      <AlertDialog
        open={!!toDelete}
        onOpenChange={(v) => {
          if (!v) {
            setToDelete(null);
            setConfirmSlug("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the clinic and all of its appointments, doctors, schedules,
              media, testimonials, treatments, and manager assignments. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-slug" className="text-sm">
              Type <span className="font-mono font-medium">{toDelete?.slug}</span> to confirm
            </Label>
            <Input
              id="confirm-slug"
              value={confirmSlug}
              onChange={(e) => setConfirmSlug(e.target.value)}
              placeholder={toDelete?.slug ?? ""}
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!toDelete || confirmSlug !== toDelete.slug || deleteMut.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!toDelete) return;
                deleteMut.mutate({
                  clinicId: toDelete.id,
                  confirmSlug,
                });
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending ? "Deleting…" : "Delete clinic"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toToggle} onOpenChange={(v) => !v && setToToggle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toToggle?.is_active ? "Deactivate" : "Activate"} {toToggle?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toToggle?.is_active
                ? "The public booking page will show a closed message and patients won't be able to book."
                : "The clinic's public booking page will go live. If its subscription has expired or was never set, it will be extended by 1 year."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggleMut.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!toToggle || toggleMut.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!toToggle) return;
                toggleMut.mutate({
                  clinicId: toToggle.id,
                  isActive: !toToggle.is_active,
                });
              }}
            >
              {toggleMut.isPending ? "Saving…" : toToggle?.is_active ? "Deactivate" : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SuperAdminLayout>
  );
}
