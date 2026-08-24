import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "clinic_manager" | "clinic_user";

export interface UserRole {
  role: AppRole;
  clinic_id: string | null;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => loadRoles(s.user.id), 0);
      } else {
        setRoles([]);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) loadRoles(data.session.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadRoles(uid: string) {
    const { data } = await supabase.from("user_roles").select("role, clinic_id").eq("user_id", uid);
    setRoles((data ?? []) as UserRole[]);
  }

  const isSuperAdmin = roles.some((r) => r.role === "super_admin");
  const managedClinics = roles.filter((r) => r.role === "clinic_manager").map((r) => r.clinic_id!);
  const userClinics = roles.filter((r) => r.role === "clinic_user").map((r) => r.clinic_id!);

  return { session, user, roles, loading, isSuperAdmin, managedClinics, userClinics };
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "/login";
}

/**
 * Shares one useAuth() subscription/fetch across a route subtree instead of
 * each route re-mounting its own onAuthStateChange listener and re-firing
 * the user_roles query. _authenticated.tsx provides the value it already
 * computed; child routes read it via useAuthContext() instead of calling
 * useAuth() again.
 */
const AuthContext = createContext<ReturnType<typeof useAuth> | null>(null);

export function AuthContextProvider({
  value,
  children,
}: {
  value: ReturnType<typeof useAuth>;
  children: ReactNode;
}) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within an AuthContextProvider");
  return ctx;
}
