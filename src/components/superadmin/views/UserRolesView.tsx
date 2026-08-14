import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  ALL_FALSE,
  ALL_TRUE,
  PermissionGrid,
  type Perms,
} from "@/components/superadmin/PermissionGrid";
import {
  listRoleTemplates,
  saveRoleTemplate,
  deleteRoleTemplate,
  type RoleTemplate,
} from "@/lib/superadmin.functions";

type Editing = {
  id: string | null;
  name: string;
  description: string;
  permissions: Perms;
  is_system: boolean;
};

export function UserRolesView() {
  const qc = useQueryClient();
  const fetchRoles = useServerFn(listRoleTemplates);
  const save = useServerFn(saveRoleTemplate);
  const del = useServerFn(deleteRoleTemplate);

  const q = useQuery({ queryKey: ["sa-role-templates"], queryFn: () => fetchRoles() });

  const [editing, setEditing] = useState<Editing | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function openNew() {
    setEditing({
      id: null,
      name: "",
      description: "",
      permissions: { ...ALL_FALSE, can_dashboard: true },
      is_system: false,
    });
  }
  function openEdit(r: RoleTemplate) {
    setEditing({
      id: r.id,
      name: r.name,
      description: r.description ?? "",
      permissions: r.permissions,
      is_system: r.is_system,
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSubmitting(true);
    try {
      await save({
        data: {
          id: editing.id,
          name: editing.name.trim(),
          description: editing.description.trim(),
          permissions: editing.permissions,
        },
      });
      toast.success(editing.id ? "Role updated" : "Role created");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["sa-role-templates"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save role");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    if (
      !confirm(
        "Delete this role? Users currently assigned will keep their permissions but lose the role link.",
      )
    )
      return;
    try {
      await del({ data: { id } });
      toast.success("Role deleted");
      qc.invalidateQueries({ queryKey: ["sa-role-templates"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <SuperAdminLayout
      title="User Roles"
      subtitle="Reusable permission templates you can assign when adding users"
      actions={
        <Button onClick={openNew} className="gap-2">
          <Plus className="size-4" />
          New role
        </Button>
      }
    >
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : (q.data?.roles ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                    No roles yet.
                  </td>
                </tr>
              ) : (
                q.data!.roles.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.description || "—"}</td>
                    <td className="px-4 py-3">
                      {r.is_system ? (
                        <Badge variant="secondary">Built-in</Badge>
                      ) : (
                        <Badge variant="outline">Custom</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => openEdit(r)}
                        title={r.is_system ? "View" : "Edit"}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      {!r.is_system && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => remove(r.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit role" : "New role"}</DialogTitle>
            <DialogDescription>
              {editing?.is_system
                ? "Built-in role — name is locked, permissions can be changed."
                : "Select which menus this role grants access to."}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    disabled={editing.is_system}
                    required
                    minLength={2}
                    maxLength={60}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={editing.description}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                    maxLength={500}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Menu access</Label>
                <PermissionGrid
                  value={editing.permissions}
                  onChange={(p) => setEditing({ ...editing, permissions: p })}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                  Close
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving…" : "Save role"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </SuperAdminLayout>
  );
}
