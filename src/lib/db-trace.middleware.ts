// Server function middleware that wraps each call in a DB trace scope.
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { runWithTrace } from "./db-trace";

function deriveLabel(): string {
  try {
    const req = getRequest();
    if (!req?.url) return "serverFn";
    const u = new URL(req.url);
    const fn = u.searchParams.get("_serverFn");
    if (fn) return fn;
    return u.pathname || "serverFn";
  } catch {
    return "serverFn";
  }
}

export const dbTraceMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const label = deriveLabel();
    return runWithTrace(label, () => next());
  },
);
