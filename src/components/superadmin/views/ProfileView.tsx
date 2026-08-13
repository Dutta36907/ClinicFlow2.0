import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, updateMyProfile } from "@/lib/superadmin.functions";

export function ProfileView() {
  const fetchProfile = useServerFn(getMyProfile);
  const updateProfile = useServerFn(updateMyProfile);

  const q = useQuery({ queryKey: ["sa-my-profile"], queryFn: () => fetchProfile() });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (q.data) {
      setFullName(q.data.full_name ?? "");
      setPhone(q.data.phone ?? "");
    }
  }, [q.data]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfile({ data: { full_name: fullName.trim(), phone: phone.trim() } });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  }

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw.length < 8) return toast.error("New password must be at least 8 characters");
    if (newPw !== confirmPw) return toast.error("Passwords do not match");
    setSavingPw(true);
    try {
      const email = q.data?.email;
      if (!email) throw new Error("Could not load your email");
      // Re-auth check
      const { error: reAuthErr } = await supabase.auth.signInWithPassword({
        email,
        password: currentPw,
      });
      if (reAuthErr) throw new Error("Current password is incorrect");
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      toast.success("Password updated");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <SuperAdminLayout title="My Profile" subtitle="Manage your account details">
      <div className="mx-auto max-w-2xl space-y-6">
        <form
          onSubmit={saveProfile}
          className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <div>
            <h2 className="text-base font-semibold">Account</h2>
            <p className="text-xs text-muted-foreground">
              Update your name and phone number.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={q.data?.email ?? ""} disabled readOnly />
            <p className="text-[11px] text-muted-foreground">
              Email is locked. Ask another super admin to change it.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>

        <form
          onSubmit={savePassword}
          className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <div>
            <h2 className="text-base font-semibold">Change password</h2>
            <p className="text-xs text-muted-foreground">
              Enter your current password to confirm, then set a new one.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Current password</Label>
            <Input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>New password</Label>
              <Input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm new password</Label>
              <Input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                minLength={8}
                required
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={savingPw}>
              {savingPw ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>
      </div>
    </SuperAdminLayout>
  );
}
