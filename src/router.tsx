import { QueryClient } from "@tanstack/react-query";
import { createRouter, Link } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { rehydrateSessionAuth, startSessionOnlySync } from "@/lib/rememberMe";

// Run before the Supabase client is touched so a session-only token stashed
// in sessionStorage is restored into localStorage in time for client init.
rehydrateSessionAuth();
startSessionOnlySync();

export const getRouter = () => {
  // Per-request QueryClient with production-grade defaults:
  // - 60s staleTime avoids "refetch on every mount/focus" thrash
  // - 5min gcTime keeps inactive queries warm during navigation
  // - single retry on transient errors instead of the default 3
  // - disable refetch-on-focus (we already invalidate on auth changes)
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 0 },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: ({ error, reset }) => (
      <div className="min-h-[60vh] grid place-items-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground break-words">
            {error instanceof Error ? error.message : "Unexpected error"}
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => {
                reset();
                router.invalidate();
              }}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm"
            >
              Try again
            </button>
            <Link to="/" className="px-4 py-2 rounded-md border text-sm">
              Go home
            </Link>
          </div>
        </div>
      </div>
    ),
    defaultNotFoundComponent: () => (
      <div className="min-h-[60vh] grid place-items-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-semibold">Page not found</h1>
          <p className="text-sm text-muted-foreground">
            The page you're looking for doesn't exist.
          </p>
          <Link
            to="/"
            className="inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm"
          >
            Go home
          </Link>
        </div>
      </div>
    ),
  });

  return router;
};
