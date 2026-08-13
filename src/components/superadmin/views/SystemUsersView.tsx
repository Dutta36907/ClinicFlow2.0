// System users with full menu-wise RBAC: list, add, edit, enable/disable.
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, UserPlus } from "lucide-react";
import {
  listSystemUsers,
  addSystemUser,
  updateSystemUserPermissions,
  setSystemUserDisabled,
  listRoleTemplates,
  resetSystemUserPassword,
  type SystemUser,
} from "@/lib/superadmin.functions";
import { useAuth } from "@/hooks/useAuth";
import {
  ALL_TRUE,
  PERMISSION_LABELS,
  PermissionGrid,
  type Perms,
} from "@/components/superadmin/PermissionGrid";

const CUSTOM = "__custom__";

export function SystemUsersView() {
  const qc = useQueryClient();
  const fetchUsers = useServerFn(listSystemUsers);
  const fetchRoles = useServerFn(listRoleTemplates);
  const add = useServerFn(addSystemUser);
  const updatePerms = useServerFn(updateSystemUserPermissions);
  const setDisabled = useServerFn(setSystemUserDisabled);
  const resetPassword = useServerFn(resetSystemUserPassword);
  const { user: currentUser } = useAuth();

  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const q = useQuery({ queryKey: ["sa-system-users"], queryFn: () => fetchUsers() });
  const rolesQ = useQuery({ queryKey: ["sa-role-templates"], queryFn: () => fetchRoles() });

  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addRoleId, setAddRoleId] = useState<string>(CUSTOM);
  const [addPerms, setAddPerms] = useState<Perms>(ALL_TRUE);
  const [submitting, setSubmitting] = useState(false);

  // When a role is selected, prefill perms from it
  useEffect(() => {
    if (addRoleId === CUSTOM) return;
    const role = rolesQ.data?.roles.find((r) => r.id === addRoleId);
    if (role) setAddPerms(role.permissions);
  }, [addRoleId, rolesQ.data]);

  const [editing, setEditing] = useState<{
    user_id: string;
    email: string;
    full_name: string | null;
    role_id: string;
    perms: Perms;
  } | null>(null);

  useEffect(() => {
    if (!editing) return;
    if (editing.role_id === CUSTOM) return;
    const role = rolesQ.data?.roles.find((r) => r.id === editing.role_id);
    if (role) setEditing({ ...editing, perms: role.permissions });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.role_id]);

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await add({
        data: {
          email: addEmail.trim().toLowerCase(),
          full_name: addName.trim(),
          phone: addPhone.trim(),
          password: addPassword,
          role_template_id: addRoleId === CUSTOM ? null : addRoleId,
          permissions: addPerms,
        },
      });
      toast.success("User added (disabled by default — enable from the list to grant access)");
      setAddOpen(false);
      setAddEmail("");
      setAddName("");
      setAddPhone("");
      setAddPassword("");
      setAddRoleId(CUSTOM);
      setAddPerms(ALL_TRUE);
      qc.invalidateQueries({ queryKey: ["sa-system-users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add user");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setSubmitting(true);
    try {
      await updatePerms({
        data: {
          user_id: editing.user_id,
          role_template_id: editing.role_id === CUSTOM ? null : editing.role_id,
          permissions: editing.perms,
        },
      });
      toast.success("Permissions updated");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["sa-system-users"] });
      qc.invalidateQueries({ queryKey: ["sa-permissions"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleDisabled(u: SystemUser) {
    try {
      await setDisabled({ data: { user_id: u.user_id, disabled: !u.is_disabled } });
      qc.invalidateQueries({ queryKey: ["sa-system-users"] });
      toast.success(!u.is_disabled ? "User disabled" : "User enabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <SuperAdminLayout
      title="System Users"
      subtitle="Super admins with menu-wise access control"
      actions={
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="size-4" />
              Add user
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add a system user</DialogTitle>
              <DialogDescription>
                Creates a super_admin account. New users start <strong>disabled</strong> — enable them from the list to grant access.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitAdd} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input
                    required
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    required
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={addPhone} onChange={(e) => setAddPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="text"
                    required
                    minLength={8}
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={addRoleId} onValueChange={setAddRoleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CUSTOM}>Custom (no role)</SelectItem>
                    {(rolesQ.data?.roles ?? []).map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} {r.is_system ? "· built-in" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Picking a role prefills permissions. You can still tweak them below.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Menu access</Label>
                <PermissionGrid value={addPerms} onChange={setAddPerms} />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Creating…" : "Add user"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Menus</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : (q.data?.users ?? []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No system users yet.
                  </td>
                </tr>
              ) : (

                q.data!.users.map((u: SystemUser) => {
                  const enabled = PERMISSION_LABELS.filter((p) => u.permissions[p.key]).length;
                  return (
                    <tr key={u.user_id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium">{u.full_name || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.phone || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {enabled} / {PERMISSION_LABELS.length}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const role = rolesQ.data?.roles.find((r) => r.id === u.role_template_id);
                          return role ? (
                            <Badge variant="secondary">{role.name}</Badge>
                          ) : (
                            <span className="text-muted-foreground">Custom</span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        {u.is_disabled ? (
                          <Badge variant="destructive">Disabled</Badge>
                        ) : (
                          <Badge>Active</Badge>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Switch
                            checked={!u.is_disabled}
                            onCheckedChange={() => toggleDisabled(u)}
                            aria-label="Enable / disable user"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() =>
                              setEditing({
                                user_id: u.user_id,
                                email: u.email ?? "",
                                full_name: u.full_name,
                                role_id: u.role_template_id ?? CUSTOM,
                                perms: u.permissions,
                              })
                            }
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit permissions</DialogTitle>
            <DialogDescription>{editing?.full_name || editing?.email}</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={editing.role_id}
                  onValueChange={(v) => setEditing({ ...editing, role_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CUSTOM}>Custom (no role)</SelectItem>
                    {(rolesQ.data?.roles ?? []).map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} {r.is_system ? "· built-in" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <PermissionGrid
                value={editing.perms}
                onChange={(p) => setEditing({ ...editing, perms: p })}
              />

              <div className="border-t border-border pt-4 space-y-2">
                <Label>Reset password</Label>
                {editing.user_id === currentUser?.id ? (
                  <p className="text-xs text-muted-foreground">
                    Use your profile page to change your own password.
                  </p>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        minLength={8}
                        placeholder="New password (min 8 characters)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={resetting || newPassword.length < 8}
                        onClick={async () => {
                          if (!editing) return;
                          setResetting(true);
                          try {
                            await resetPassword({
                              data: { user_id: editing.user_id, password: newPassword },
                            });
                            toast.success("Password reset");
                            setNewPassword("");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Failed");
                          } finally {
                            setResetting(false);
                          }
                        }}
                      >
                        {resetting ? "Resetting…" : "Reset"}
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Share the new password with the user out-of-band. It is not emailed.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={submitting}>
              {submitting ? "Saving…" : "Save permissions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperAdminLayout>
  );
}
