import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  Stethoscope,
  ClipboardList,
  Settings,
  ArrowLeft,
  LayoutDashboard,
  Image as ImageIcon,
  BarChart3,
  Sparkles,
  MessageSquareQuote,
  Images,
  FolderOpen,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
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
  useSidebar,
} from "@/components/ui/sidebar";

export type ManagerSection =
  | "dashboard"
  | "appointments"
  | "doctors"
  | "details"
  | "cover"
  | "stats"
  | "treatments"
  | "testimonials"
  | "gallery"
  | "media"
  | "settings";

type GroupKey = "overview" | "clinic" | "page" | "media";

const GROUP_LABELS: Record<GroupKey, string> = {
  overview: "Overview",
  clinic: "Clinic",
  page: "Public page",
  media: "Media",
};

const items: {
  id: ManagerSection;
  label: string;
  icon: typeof CalendarDays;
  group: GroupKey;
}[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "overview" },
  { id: "appointments", label: "Appointments", icon: CalendarDays, group: "overview" },

  { id: "doctors", label: "Doctors", icon: Stethoscope, group: "clinic" },
  { id: "details", label: "Clinic details", icon: ClipboardList, group: "clinic" },
  { id: "settings", label: "Settings", icon: Settings, group: "clinic" },

  { id: "cover", label: "Cover photo", icon: ImageIcon, group: "page" },
  { id: "stats", label: "Performance stats", icon: BarChart3, group: "page" },
  { id: "treatments", label: "Treatments", icon: Sparkles, group: "page" },
  { id: "testimonials", label: "Reviews", icon: MessageSquareQuote, group: "page" },
  { id: "gallery", label: "Gallery", icon: Images, group: "page" },

  { id: "media", label: "Media library", icon: FolderOpen, group: "media" },
];

const GROUP_ORDER: GroupKey[] = ["overview", "clinic", "page", "media"];

export function ManagerSidebar({
  slug,
  clinicName,
  logoUrl,
  active,
  onSelect,
  appointmentCount = 0,
}: {
  slug: string;
  clinicName: string;
  logoUrl: string | null;
  active: ManagerSection;
  onSelect: (s: ManagerSection) => void;
  appointmentCount?: number;
}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleLogout() {
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;

      // Wipe any persisted Supabase auth tokens + impersonation hints from
      // both localStorage and sessionStorage (covers the rememberMe mirror).
      try {
        const isAuthKey = (k: string) =>
          (k.startsWith("sb-") &&
            (k.endsWith("-auth-token") ||
              k.endsWith("-auth-token-session-only") ||
              k.endsWith("-auth-token-code-verifier"))) ||
          k === "supabase.auth.token";
        for (const storage of [window.localStorage, window.sessionStorage]) {
          Object.keys(storage)
            .filter(isAuthKey)
            .forEach((k) => storage.removeItem(k));
        }
      } catch {
        // storage unavailable; ignore
      }

      // Clear non-HttpOnly cookies that auth or impersonation flows may have
      // dropped on this origin (HttpOnly cookies are unreachable from JS and
      // must be cleared server-side).
      try {
        const cookies = document.cookie ? document.cookie.split("; ") : [];
        const expire = "expires=Thu, 01 Jan 1970 00:00:00 GMT";
        for (const c of cookies) {
          const name = c.split("=")[0];
          if (!name) continue;
          if (
            name.startsWith("sb-") ||
            name.startsWith("supabase") ||
            name.includes("impersonat")
          ) {
            document.cookie = `${name}=; ${expire}; path=/`;
            document.cookie = `${name}=; ${expire}; path=/; domain=${window.location.hostname}`;
          }
        }
      } catch {
        // cookie access blocked; ignore
      }

      queryClient.clear();
      toast.success("Signed out");
      await navigate({
        to: "/$slug/clinicmanager",
        params: { slug },
        search: {},
        replace: true,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign out failed");
    }
  }


  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-1 py-2">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="size-9 shrink-0 rounded-lg object-cover ring-1 ring-border"
            />
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
              <Stethoscope className="size-4" />
            </span>
          )}
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{clinicName}</div>
              <div className="truncate text-xs text-muted-foreground">/{slug}</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {GROUP_ORDER.map((gk) => {
          const groupItems = items.filter((i) => i.group === gk);
          if (groupItems.length === 0) return null;
          return (
            <SidebarGroup key={gk}>
              <SidebarGroupLabel>{GROUP_LABELS[gk]}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {groupItems.map((it) => {
                    const showBadge =
                      it.id === "appointments" && appointmentCount > 0;
                    return (
                      <SidebarMenuItem key={it.id}>
                        <SidebarMenuButton
                          isActive={active === it.id}
                          onClick={() => onSelect(it.id)}
                          tooltip={
                            showBadge
                              ? `${it.label} (${appointmentCount})`
                              : it.label
                          }
                        >
                          <it.icon className="size-4" />
                          {!collapsed && (
                            <>
                              <span className="flex-1">{it.label}</span>
                              {showBadge && (
                                <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-none text-primary-foreground">
                                  {appointmentCount > 99 ? "99+" : appointmentCount}
                                </span>
                              )}
                            </>
                          )}
                          {collapsed && showBadge && (
                            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
                              {appointmentCount > 9 ? "9+" : appointmentCount}
                            </span>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

        <SidebarGroup>
          <SidebarGroupLabel>Public</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Booking page">
                  <Link
                    to="/$slug"
                    params={{ slug }}
                    className={pathname === `/${slug}` ? "font-medium" : ""}
                  >
                    <ArrowLeft className="size-4" />
                    {!collapsed && <span>Booking page</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout} tooltip="Log out">
                  <LogOut className="size-4" />
                  {!collapsed && <span>Log out</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
