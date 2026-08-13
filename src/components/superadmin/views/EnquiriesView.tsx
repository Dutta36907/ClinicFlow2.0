// Super-admin "Enquiry" tab: list, filter, and update demo/sign-up enquiries.
import { useMemo, useState } from "react";
import {
  Loader2,
  Inbox,
  Search,
  Mail,
  Phone,
  Building2,
  RefreshCw,
  MessageSquare,
  Sparkles,
} from "lucide-react";

import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

import { useDeleteEnquiry, useEnquiries, useUpdateEnquiryStatus } from "@/hooks/useEnquiries";
import { Trash2 } from "lucide-react";
import { EnquiryStatusBadge } from "@/components/superadmin/EnquiryStatusBadge";
import {
  ENQUIRY_STATUSES,
  ENQUIRY_STATUS_LABEL,
  ENQUIRY_TYPE_LABEL,
  type Enquiry,
  type EnquiryStatus,
  type EnquiryType,
} from "@/types/enquiry.types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const TYPE_META: Record<
  EnquiryType,
  { icon: typeof Sparkles; tone: string }
> = {
  request_demo: {
    icon: Sparkles,
    tone: "bg-violet-500/10 text-violet-700 ring-violet-500/20",
  },
  sign_up: {
    icon: Building2,
    tone: "bg-primary/10 text-primary ring-primary/20",
  },
};

function TypePill({ type }: { type: EnquiryType }) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${meta.tone}`}
    >
      <Icon className="size-3" />
      {ENQUIRY_TYPE_LABEL[type]}
    </span>
  );
}


export function EnquiriesView() {
  const { data, isLoading, error, refetch, isFetching } = useEnquiries();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | EnquiryType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | EnquiryStatus>("all");
  const [active, setActive] = useState<Enquiry | null>(null);

  const rows: Enquiry[] = Array.isArray(data) ? data : (data?.rows ?? []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((e: Enquiry) => {
      if (typeFilter !== "all" && e.enquiry_type !== typeFilter) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (!q) return true;
      return (
        e.full_name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.phone.toLowerCase().includes(q) ||
        (e.company_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, typeFilter, statusFilter]);

  return (
    <SuperAdminLayout
      title="Enquiry"
      subtitle="Demo and sign-up requests from the landing page"
    >
      <div className="space-y-5">
        {/* Filters */}
        <Card className="border-border/70">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, phone or company"
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="request_demo">Request Demo</SelectItem>
                <SelectItem value="sign_up">Sign Up</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ENQUIRY_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {ENQUIRY_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="gap-1.5"
            >
              {isFetching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Refresh
            </Button>
          </CardContent>
        </Card>

        {/* States */}
        {isLoading ? (
          <Card className="border-border/70">
            <CardContent className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-9 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-destructive/40">
            <CardContent className="flex flex-col items-center gap-3 py-16 text-sm text-muted-foreground">
              <p>Couldn't load enquiries.</p>
              <Button size="sm" onClick={() => void refetch()}>Retry</Button>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No enquiries yet"
            description="When visitors submit a demo or sign-up request from the landing page, they'll appear here."
          />
        ) : (
          <>
            {/* Desktop table */}
            <Card className="hidden border-border/70 md:block">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contact</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((e) => (
                      <TableRow
                        key={e.id}
                        className="transition-colors hover:bg-muted/40"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/15">
                              <MessageSquare className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium">{e.full_name}</p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {e.company_name ?? "Individual"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {e.company_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{e.email}</TableCell>
                        <TableCell className="text-muted-foreground">{e.phone}</TableCell>
                        <TableCell>
                          <TypePill type={e.enquiry_type} />
                        </TableCell>
                        <TableCell><EnquiryStatusBadge status={e.status} /></TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDate(e.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => setActive(e)}>
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Mobile cards */}
            <div className="grid gap-3 md:hidden">
              {filtered.map((e) => (
                <Card key={e.id} className="border-border/70">
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/15">
                          <MessageSquare className="size-4" />
                        </div>
                        <div>
                          <p className="font-medium">{e.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(e.created_at)}
                          </p>
                        </div>
                      </div>
                      <EnquiryStatusBadge status={e.status} />
                    </div>
                    {e.company_name && (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Building2 className="size-3" /> {e.company_name}
                      </p>
                    )}
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mail className="size-3" /> {e.email}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="size-3" /> {e.phone}
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <TypePill type={e.enquiry_type} />
                      <Button size="sm" variant="outline" onClick={() => setActive(e)}>
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      <EnquiryDetailsDialog
        enquiry={active}
        onClose={() => setActive(null)}
      />
    </SuperAdminLayout>
  );
}

function EnquiryDetailsDialog({
  enquiry,
  onClose,
}: {
  enquiry: Enquiry | null;
  onClose: () => void;
}) {
  const mutation = useUpdateEnquiryStatus();
  const deleteMutation = useDeleteEnquiry();
  const open = enquiry !== null;

  const updateTo = (status: EnquiryStatus) => {
    if (!enquiry) return;
    mutation.mutate(
      { id: enquiry.id, status },
      {
        onSuccess: () => {
          toast.success(`Marked as ${ENQUIRY_STATUS_LABEL[status]}`);
          onClose();
        },
        onError: (err: unknown) => {
          toast.error(err instanceof Error ? err.message : "Couldn't update status");
        },
      },
    );
  };

  const handleDelete = () => {
    if (!enquiry) return;
    if (!confirm("Permanently delete this enquiry? This cannot be undone.")) return;
    deleteMutation.mutate(
      { id: enquiry.id },
      {
        onSuccess: () => {
          toast.success("Enquiry deleted");
          onClose();
        },
        onError: (err: unknown) => {
          toast.error(err instanceof Error ? err.message : "Couldn't delete");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{enquiry?.full_name}</DialogTitle>
          <DialogDescription>
            Submitted {enquiry ? formatDate(enquiry.created_at) : ""}
          </DialogDescription>
        </DialogHeader>

        {enquiry && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-2">
              <span className="text-muted-foreground">Type</span>
              <span className="col-span-2">{ENQUIRY_TYPE_LABEL[enquiry.enquiry_type]}</span>

              <span className="text-muted-foreground">Status</span>
              <span className="col-span-2"><EnquiryStatusBadge status={enquiry.status} /></span>

              <span className="text-muted-foreground">Company</span>
              <span className="col-span-2">{enquiry.company_name ?? "—"}</span>

              <span className="text-muted-foreground">Email</span>
              <a href={`mailto:${enquiry.email}`} className="col-span-2 text-primary hover:underline">
                {enquiry.email}
              </a>

              <span className="text-muted-foreground">Phone</span>
              <a href={`tel:${enquiry.phone}`} className="col-span-2 text-primary hover:underline">
                {enquiry.phone}
              </a>
            </div>

            {enquiry.message && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Message
                </p>
                <p className="whitespace-pre-wrap rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
                  {enquiry.message}
                </p>
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Change status
              </p>
              <Select
                value={enquiry.status}
                onValueChange={(v) => updateTo(v as EnquiryStatus)}
                disabled={mutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENQUIRY_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{ENQUIRY_STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => updateTo("contacted")}
            >
              Mark contacted
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => updateTo("converted")}
            >
              Mark converted
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => updateTo("closed")}
            >
              Close
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={handleDelete}
              className="gap-1.5"
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
