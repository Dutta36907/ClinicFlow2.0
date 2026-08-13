import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { dbTraceMiddleware } from "./lib/db-trace.middleware";

// Surface otherwise-silent worker failures to the Cloudflare log tail so
// catastrophic errors are debuggable. We deliberately do not rethrow — the
// runtime would log a less-structured stack trace.
if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("unhandledrejection", (event) => {
    const reason = (event as PromiseRejectionEvent).reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        action: "unhandled_rejection",
        message,
        stack,
      }),
    );
  });
  globalThis.addEventListener("error", (event) => {
    const error = (event as ErrorEvent).error ?? event;
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        action: "uncaught_error",
        message,
        stack,
      }),
    );
  });
}

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    // Log the raw Error so Cloudflare's log tail keeps the stack trace.
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  functionMiddleware: [attachSupabaseAuth, dbTraceMiddleware],
}));
