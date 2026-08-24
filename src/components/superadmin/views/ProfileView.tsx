import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, updateMyProfile } from "@/lib/superadmin.functions";
import { AvatarPickerDialog } from "@/components/superadmin/AvatarPickerDialog";
import { Copy, Eye, EyeOff, Wand2 } from "lucide-react";

function passwordStrength(pw: string) {
  if (!pw) return { score: 0, label: "", barClass: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const clamped = Math.min(4, score);
  const labels = ["Very weak", "Weak", "Fair", "Good", "Strong"];
  const barClasses = [
    "bg-destructive",
    "bg-destructive",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-emerald-600",
  ];
  return { score: clamped, label: labels[clamped], barClass: barClasses[clamped] };
}

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const arr = new Uint32Array(14);
  crypto.getRandomValues(arr);
  let p = "";
  for (let i = 0; i < arr.length; i++) p += chars[arr[i] % chars.length];
  return p;
}

export function ProfileView() {
  const fetchProfile = useServerFn(getMyProfile);
  const updateProfile = useServerFn(updateMyProfile);

  const q = useQuery({ queryKey: ["sa-my-profile"], queryFn: () => fetchProfile() });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);

  useEffect(() => {
    if (q.data) {
      setFullName(q.data.full_name ?? "");
      setPhone(q.data.phone ?? "");
      setAvatarUrl(q.data.avatar_url ?? "");
    }
  }, [q.data]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfile({
        data: { full_name: fullName.trim(), phone: phone.trim(), avatar_url: avatarUrl },
      });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveAvatar(url: string) {
    setSavingAvatar(true);
    try {
      await updateProfile({
        data: { full_name: fullName.trim(), phone: phone.trim(), avatar_url: url },
      });
      setAvatarUrl(url);
      toast.success("Avatar updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update avatar");
    } finally {
      setSavingAvatar(false);
    }
  }

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const strength = passwordStrength(newPw);

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

  const initials = (fullName || q.data?.email || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <SuperAdminLayout title="My Profile" subtitle="Manage your account details">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <Avatar className="size-16">
            <AvatarImage src={avatarUrl || undefined} alt={fullName} />
            <AvatarFallback className="text-lg font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Profile picture</p>
            <p className="text-xs text-muted-foreground">
              JPEG, PNG, or WebP. Auto-cropped to a square.
            </p>
          </div>
          <AvatarPickerDialog
            trigger={
              <Button type="button" variant="outline" size="sm" disabled={savingAvatar}>
                {savingAvatar ? "Saving…" : "Change avatar"}
              </Button>
            }
            onSelect={saveAvatar}
          />
        </div>

        <form
          onSubmit={saveProfile}
          className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <div>
            <h2 className="text-base font-semibold">Account</h2>
            <p className="text-xs text-muted-foreground">Update your name and phone number.</p>
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
              <div className="relative">
                <Input
                  type={showNewPw ? "text" : "password"}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  minLength={8}
                  required
                  className="pr-[4.5rem] font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    const p = generatePassword();
                    setNewPw(p);
                    setConfirmPw(p);
                    setShowNewPw(true);
                  }}
                  className="absolute inset-y-0 right-[4.5rem] flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label="Generate password"
                  title="Generate a strong password"
                >
                  <Wand2 className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!newPw) return;
                    await navigator.clipboard.writeText(newPw);
                    toast.success("Password copied to clipboard");
                  }}
                  disabled={!newPw}
                  className="absolute inset-y-0 right-9 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label="Copy password"
                >
                  <Copy className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewPw((s) => !s)}
                  className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label={showNewPw ? "Hide password" : "Show password"}
                >
                  {showNewPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {newPw && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <span
                        key={i}
                        className={`h-1 flex-1 rounded-full ${
                          i < strength.score ? strength.barClass : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{strength.label}</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Confirm new password</Label>
              <Input
                type={showNewPw ? "text" : "password"}
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
