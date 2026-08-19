import { ReactNode } from "react";
import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Building2,
  Stethoscope,
  CalendarDays,
  SlidersHorizontal,
  Inbox,
  Users,
  UserCog,
  ShieldCheck,
  ScrollText,
  Activity,
  LogOut,
  UserCircle,
  BadgeCheck,
} from "lucide-react";
import { signOutSuperAdmin } from "@/lib/superadminAuth";
import { markInactivityLogout } from "@/lib/logout-reason";
import { useInactivityLogout, SUPER_ADMIN_IDLE_MS } from "@/hooks/useInactivityLogout";
import { InactivityWarningDialog } from "@/components/InactivityWarningDialog";
import { toast } from "sonner";
import { useSuperAdminView, type SuperAdminView } from "@/stores/superadminViewStore";
import {
  useSuperAdminPermissions,
  VIEW_PERMISSION,
  type Permissions,
} from "@/hooks/useSuperAdminPermissions";

type NavItem = {
  key: SuperAdminView;
  label: string;
  icon: typeof LayoutDashboard;
};

type NavGroup = {
  label: string | null;
  items: NavItem[];
};

const groups: NavGroup[] = [
  {
    label: null,
    items: [
      { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { key: "profile", label: "My Profile", icon: UserCircle },
    ],
  },
  {
    label: "Clinic",
    items: [
      { key: "clinics", label: "Clinic Manage", icon: Building2 },
      { key: "doctors", label: "Doctors Manage", icon: Stethoscope },
      { key: "appointments", label: "Appointments", icon: CalendarDays },
      { key: "clinicSettings", label: "Clinic Settings", icon: SlidersHorizontal },
    ],
  },
  {
    label: null,
    items: [{ key: "enquiries", label: "Enquiry", icon: Inbox }],
  },
  {
    label: "Customer Management",
    items: [
      { key: "customers", label: "Customers", icon: Users },
      { key: "subscriptions", label: "Subscriptions", icon: BadgeCheck },
    ],
  },
  {
    label: "System",
    items: [
      { key: "systemUsers", label: "System Users", icon: UserCog },
      { key: "userRoles", label: "User Roles", icon: ShieldCheck },
      { key: "audit", label: "Audit log", icon: ScrollText },
      { key: "monitoring", label: "System Monitoring", icon: Activity },
    ],
  },
];

function filterByPerms(g: NavGroup, perms: Permissions | undefined): NavGroup {
  if (!perms) return g; // optimistic while loading
  return {
    ...g,
    items: g.items.filter((i) => {
      const k = VIEW_PERMISSION[i.key];
      return !k || perms[k];
    }),
  };
}

function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const view = useSuperAdminView((s) => s.view);
  const setView = useSuperAdminView((s) => s.setView);
  const { data: perms } = useSuperAdminPermissions();

  const visibleGroups = groups
    .map((g) => filterByPerms(g, perms))
    .filter((g) => g.items.length > 0);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border bg-gradient-to-br from-primary/5 via-transparent to-transparent">
        <button
          type="button"
          onClick={() => setView("dashboard")}
          className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent/50"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20 ring-1 ring-primary/30 transition-transform group-hover:scale-105">
            <Stethoscope className="size-4" />
          </span>
          {!collapsed && (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-semibold tracking-tight">ClinicFlow</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-primary/80">
                <ShieldCheck className="size-2.5" /> Super Admin
              </span>
            </div>
          )}
        </button>
      </SidebarHeader>

      <SidebarContent>
        {visibleGroups.map((g, idx) => (
          <SidebarGroup key={g.label ?? `g-${idx}`}>
            {g.label && !collapsed && <SidebarGroupLabel>{g.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      isActive={view === item.key}
                      tooltip={item.label}
                      onClick={() => setView(item.key)}
                    >
                      <item.icon className="size-4" />
                      {!collapsed && <span>{item.label}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={() => {
            void signOutSuperAdmin();
          }}
        >
          <LogOut className="size-4" />
          {!collapsed && <span>Sign out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

export function SuperAdminLayout({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { warningOpen, secondsLeft, stayActive } = useInactivityLogout({
    enabled: true,
    idleMs: SUPER_ADMIN_IDLE_MS,
    onTimeout: () => {
      markInactivityLogout();
      void signOutSuperAdmin();
    },
  });

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background/75 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 sm:px-6">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="h-6 w-px bg-border/60" aria-hidden />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
                {title}
              </h1>
              {subtitle && (
                <p className="hidden truncate text-xs text-muted-foreground sm:block">{subtitle}</p>
              )}
            </div>
            {actions}
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </div>
      </div>
      <InactivityWarningDialog
        open={warningOpen}
        secondsLeft={secondsLeft}
        onStayActive={stayActive}
      />
    </SidebarProvider>
  );
}

// Cache super-admin verification per user-id for the lifetime of the tab so
// sidebar navigation never re-hits the DB and never flickers back to /login
// during transient auth reads.
const superAdminCache = new Map<string, boolean>();

export function clearSuperAdminCache() {
  superAdminCache.clear();
}

// One-shot promise that resolves once Supabase has emitted its first
// auth event (INITIAL_SESSION). Route guards await this so the very first
// navigation can't race the session-from-storage hydration and bounce a
// logged-in super admin to /superadmin/login.
let authReadyResolve: (() => void) | null = null;
const authReady: Promise<void> = new Promise((res) => {
  authReadyResolve = res;
});
if (typeof window !== "undefined") {
  setTimeout(() => authReadyResolve?.(), 1500);
}

supabase.auth.onAuthStateChange((event) => {
  authReadyResolve?.();
  authReadyResolve = null;
  if (event === "SIGNED_OUT" || event === "USER_UPDATED") {
    superAdminCache.clear();
  }
});

let lastToastAt = 0;
function notifyRoleIssue(message: string, description?: string) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastToastAt < 4000) return;
  lastToastAt = now;
  toast.error(message, description ? { description } : undefined);
}

let pendingLoginRedirect: Promise<void> | null = null;

function redirectToLoginOnce(): never {
  if (typeof window !== "undefined" && window.location.pathname === "/superadmin/login") {
    throw redirect({ to: "/superadmin/login", replace: true });
  }
  if (!pendingLoginRedirect) {
    pendingLoginRedirect = Promise.resolve().then(() => {
      pendingLoginRedirect = null;
    });
    throw redirect({ to: "/superadmin/login", replace: true });
  }
  const abort = new Error("ensureSuperAdmin: redirect deduped");
  (abort as Error & { __dedup: true }).__dedup = true;
  throw abort;
}

export async function ensureSuperAdmin({ cause }: { cause?: string } = {}) {
  if (cause === "preload") return;

  let {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    await authReady;
    ({
      data: { session },
    } = await supabase.auth.getSession());
  }

  if (!session?.user) redirectToLoginOnce();

  const uid = session.user.id;
  if (superAdminCache.get(uid)) return;

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", uid)
    .eq("role", "super_admin");

  if (error) {
    notifyRoleIssue(
      "Couldn't verify your super admin access",
      error.message ?? "Please retry in a moment.",
    );
    return;
  }

  if (!roles || roles.length === 0) {
    notifyRoleIssue(
      "You don't have super admin access",
      "Ask a platform owner to grant your account the super_admin role.",
    );
    return;
  }

  // Block disabled accounts
  const { data: perm } = await supabase
    .from("super_admin_permissions")
    .select("is_disabled")
    .eq("user_id", uid)
    .maybeSingle();
  if (perm && (perm as { is_disabled?: boolean }).is_disabled) {
    notifyRoleIssue(
      "Your account is disabled",
      "Another super admin has disabled your access. Contact them to re-enable.",
    );
    await supabase.auth.signOut({ scope: "local" });
    redirectToLoginOnce();
  }

  superAdminCache.set(uid, true);
}
