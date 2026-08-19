import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { UiV2Bootstrap } from "@/components/ui/ui-v2-toggle";
import { supabase } from "@/integrations/supabase/client";
import { setNotFoundStatus } from "@/lib/set-not-found-status";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  // M1: set HTTP 404 during SSR so crawlers see a proper not-found, not 200.
  setNotFoundStatus();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ClinicFlow V2" },
      {
        name: "description",
        content:
          "ClinicFlow Suite is a multi-tenant SaaS platform for managing clinic appointments and patient bookings.",
      },
      { property: "og:title", content: "ClinicFlow V2" },
      {
        property: "og:description",
        content:
          "ClinicFlow Suite is a multi-tenant SaaS platform for managing clinic appointments and patient bookings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "ClinicFlow V2" },
      {
        name: "twitter:description",
        content:
          "ClinicFlow Suite is a multi-tenant SaaS platform for managing clinic appointments and patient bookings.",
      },
      // og:image / twitter:image are intentionally NOT set at the root.
      // TanStack concatenates root meta into every match, so a global image
      // would override every leaf route's share preview.
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=Sora:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <UiV2Bootstrap />
      <AuthEventBridge />
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}

// Bridges Supabase auth lifecycle events into the router + query cache so the
// super admin session stays alive (and consistent) during navigation.
//
// - TOKEN_REFRESHED: silent rotation; do nothing visible, but log so refresh
//   issues are debuggable. The Supabase client already persisted the new
//   token; the session-only mirror in rememberMe.ts keeps sessionStorage in
//   sync for "remember me = off" sessions.
// - SIGNED_IN / USER_UPDATED: invalidate router loaders + queries so any
//   user-scoped data re-fetches under the new identity.
// - SIGNED_OUT: clear all queries and let route guards redirect on next nav.
function AuthEventBridge() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      switch (event) {
        case "TOKEN_REFRESHED": {
          // Token rotated successfully — keep the session alive without
          // tearing down in-flight queries. Logged for observability.
          if (session?.expires_at) {
            const inSec = session.expires_at - Math.floor(Date.now() / 1000);
            console.debug(`[auth] token refreshed; next expiry in ${inSec}s`);
          }
          break;
        }
        case "SIGNED_IN":
        case "USER_UPDATED": {
          router.invalidate();
          queryClient.invalidateQueries();
          break;
        }
        case "SIGNED_OUT": {
          queryClient.clear();
          // Belt-and-braces: clear the session-only mirror token and the
          // remember-me flag. supabase.auth.signOut() handles its own
          // localStorage key, but the sessionStorage mirror (used when
          // "Remember me" is off) is ours to clean up.
          if (typeof window !== "undefined") {
            try {
              const PROJECT_REF = "xvcjkvjopmpnxuddlikb";
              const AUTH_KEY = `sb-${PROJECT_REF}-auth-token`;
              sessionStorage.removeItem(AUTH_KEY);
              sessionStorage.removeItem(`${AUTH_KEY}-session-only`);
            } catch {
              /* storage unavailable; ignore */
            }
          }
          break;
        }
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return null;
}
