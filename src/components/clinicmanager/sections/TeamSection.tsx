/**
 * TeamSection — RBAC: list/add/remove clinic users.
 *
 * Two roles exist for a clinic:
 *  - `clinic_manager` (full edit access, assigned by super-admin only)
 *  - `clinic_user`    (read-only + work with appointments; managed here)
 *
 * Adding a user creates an auth account + assigns the clinic_user role.
 * Managers cannot remove other managers from this UI.
 */

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { TablePagination } from "@/components/superadmin/views/shared/TablePagination";
import { useTablePagination } from "@/components/superadmin/views/shared/useTablePagination";

import { toast } from "sonner";
import { Plus, ShieldCheck, Trash2, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  addClinicUser,
  listClinicMembers,
  removeClinicUser,
} from "@/lib/clinicmanager.functions";

import { Card, SectionShell } from "../shared/SectionShell";
import { Field } from "../shared/FormPrimitives";
import {
  LIMITS,
  formatServerError,
  validateTeamMember,
} from "@/lib/validation/clinic-forms";
import type { DashboardClinic } from "../types";

export function TeamSection({ clinic }: { clinic: DashboardClinic }) {
  const qc = useQueryClient();
  const fetchMembers = useServerFn(listClinicMembers);
  const removeFn = useServerFn(removeClinicUser);
  const { page, size } = useTablePagination();

  const membersQ = useQuery({
    queryKey: ["mgr-members", clinic.id, { page, size }],
    queryFn: () => fetchMembers({ data: { clinic_id: clinic.id, page, pageSize: size } }),
    placeholderData: keepPreviousData,
  });

  const rows = membersQ.data?.rows ?? [];
  const total = membersQ.data?.total ?? 0;

  const [addOpen, setAddOpen] = useState(false);

  async function onRemove(userId: string) {
    try {
      await removeFn({ data: { clinic_id: clinic.id, user_id: userId } });
      toast.success("User removed");
      qc.invalidateQueries({ queryKey: ["mgr-members", clinic.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove");
    }
  }


  return (
    <SectionShell
      title="Team & access"
      description="Manage who can view and work in this clinic."
      actions={
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> Add user
            </Button>
          </DialogTrigger>
          <AddUserDialog clinicId={clinic.id} onDone={() => setAddOpen(false)} />
        </Dialog>
      }
    >
      <Card className="p-0">
        <div className="-mx-4 sm:mx-0 overflow-x-auto">
        <Table className="min-w-[680px]">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="w-24 text-right">Remove</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {membersQ.isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="size-9 rounded-lg" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="ml-auto size-9 rounded-md" />
                  </TableCell>
                </TableRow>
              ))}
            {!membersQ.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="p-0">
                  <EmptyState
                    icon={Users}
                    title="No team members yet"
                    description="Invite a clinic user to share access to appointments and the dashboard."
                  />
                </TableCell>
              </TableRow>
            )}
            {rows.map((m) => {
              const initials = (m.full_name ?? m.email ?? "?")
                .split(/[\s@]+/)
                .map((p) => p[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase();
              return (
                <TableRow key={m.role_id} className="transition-colors hover:bg-muted/30">
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div
                        className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 text-xs font-semibold text-primary ring-1 ring-primary/15"
                        aria-hidden
                      >
                        {initials || "?"}
                      </div>
                      <span className="truncate font-medium">{m.full_name ?? "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.email ?? "—"}
                  </TableCell>
                  <TableCell>
                    {m.role === "clinic_manager" ? (
                      <Badge className="gap-1">
                        <ShieldCheck className="size-3" /> Manager
                      </Badge>
                    ) : (
                      <Badge variant="secondary">User</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {/* Only `clinic_user` rows are removable here. */}
                    {m.role === "clinic_user" ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10"
                            aria-label={`Remove ${m.full_name ?? m.email ?? "user"}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove access?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {m.email ?? "This user"} will no longer be able to
                              view this clinic. Their login account is preserved.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onRemove(m.user_id)}>
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <span className="text-xs text-muted-foreground">Locked</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
        <TablePagination total={total} />
      </Card>


      <Card>
        <div className="flex items-start gap-3 text-sm">
          <ShieldCheck className="mt-0.5 size-4 text-primary" />
          <div>
            <p className="font-medium">Managers vs users</p>
            <p className="mt-1 text-muted-foreground">
              <strong>Managers</strong> can edit this clinic profile and team.
              <strong className="ml-1">Users</strong> can view appointments and
              doctors but cannot change clinic settings. Manager assignments are
              controlled by a super admin.
            </p>
          </div>
        </div>
      </Card>
    </SectionShell>
  );
}

function AddUserDialog({
  clinicId,
  onDone,
}: {
  clinicId: string;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const add = useServerFn(addClinicUser);
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
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

  async function onSubmit() {
    const v = validateTeamMember(form);
    if (!v.ok) {
      setErrors(v.errors);
      toast.error("Please fix the highlighted fields");
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await add({ data: { clinic_id: clinicId, ...form } });
      toast.success("User added");
      qc.invalidateQueries({ queryKey: ["mgr-members", clinicId] });
      onDone();
    } catch (e) {
      toast.error(formatServerError(e, "Failed to add user"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add clinic user</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <Field
          label="Full name"
          required
          maxLength={LIMITS.fullName.max}
          value={form.full_name}
          onChange={(v) => setField("full_name", v)}
          error={errors.full_name}
        />
        <Field
          label="Email"
          required
          type="email"
          inputMode="email"
          maxLength={LIMITS.email.max}
          value={form.email}
          onChange={(v) => setField("email", v)}
          error={errors.email}
        />
        <Field
          label="Temporary password"
          required
          type="password"
          maxLength={LIMITS.password.max}
          value={form.password}
          onChange={(v) => setField("password", v)}
          error={errors.password}
          help={`At least ${LIMITS.password.min} characters.`}
        />
        <p className="text-xs text-muted-foreground">
          The user can sign in at{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">/clinicmanager</code>{" "}
          with these credentials. Share the password securely.
        </p>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={onSubmit} disabled={saving}>
          {saving ? "Adding…" : "Add user"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
