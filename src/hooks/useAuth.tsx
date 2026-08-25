import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getAuthContext, clearAuthContextCache } from "@/lib/auth-context";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [managedClinics, setManagedClinics] = useState<string[]>([]);
  const [userClinics, setUserClinics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedForUid = useRef<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => loadContext(s.user.id), 0);
      } else {
        loadedForUid.current = null;
        setIsSuperAdmin(false);
        setManagedClinics([]);
        setUserClinics([]);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) loadContext(data.session.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // onAuthStateChange's synthetic INITIAL_SESSION replay and getSession()
  // both resolve with the same session on mount — skip the second fetch.
  async function loadContext(uid: string) {
    if (loadedForUid.current === uid) return;
    loadedForUid.current = uid;
    const ctx = await getAuthContext(uid);
    setIsSuperAdmin(ctx.isSuper);
    setManagedClinics(ctx.managedClinicIds);
    setUserClinics(ctx.userClinicIds);
  }

  return { session, user, loading, isSuperAdmin, managedClinics, userClinics };
}

export async function signOut() {
  await supabase.auth.signOut();
  clearAuthContextCache();
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
