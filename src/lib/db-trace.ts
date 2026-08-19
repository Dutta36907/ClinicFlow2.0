// Server-only DB query tracing. Patches globalThis.fetch once to record
// Supabase round-trips made within an AsyncLocalStorage trace scope, then
// emits a single aggregated log line per server function call.
import { AsyncLocalStorage } from "node:async_hooks";

type QueryRecord = {
  method: string;
  pathKey: string;
  durationMs: number;
  status: number;
};

type TraceStore = {
  calls: QueryRecord[];
  startedAt: number;
  label: string;
};

const storage = new AsyncLocalStorage<TraceStore>();

function isDisabled(): boolean {
  return process.env.DB_TRACE_DISABLED === "1";
}

function getSupabaseHost(): string | null {
  const url = process.env.SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

// Map a Supabase URL to a stable bucket so we can count round-trips per
// logical resource regardless of query params or row IDs.
function pathKeyFor(method: string, urlStr: string): string {
  let u: URL;
  try {
    u = new URL(urlStr);
  } catch {
    return `unknown:${method}`;
  }
  const segs = u.pathname.split("/").filter(Boolean);
  // /rest/v1/<table>            → rest:<table>:<METHOD>
  // /rest/v1/rpc/<fn>           → rpc:<fn>
  if (segs[0] === "rest" && segs[1] === "v1") {
    if (segs[2] === "rpc" && segs[3]) return `rpc:${segs[3]}`;
    if (segs[2]) return `rest:${segs[2]}:${method}`;
  }
  // /auth/v1/admin/users[/<id>] → auth-admin:users:<METHOD>
  if (segs[0] === "auth" && segs[1] === "v1") {
    if (segs[2] === "admin" && segs[3]) return `auth-admin:${segs[3]}:${method}`;
    return `auth:${segs.slice(2, 4).join("/") || "root"}:${method}`;
  }
  // /storage/v1/object/<bucket>/... → storage:<bucket>:<METHOD>
  if (segs[0] === "storage" && segs[1] === "v1") {
    const bucket = segs[3] ?? segs[2] ?? "root";
    return `storage:${bucket}:${method}`;
  }
  return `other:${segs.slice(0, 3).join("/") || "root"}:${method}`;
}

let patched = false;
export function installFetchPatch(): void {
  if (patched) return;
  patched = true;
  const orig = globalThis.fetch;
  if (typeof orig !== "function") return;
  globalThis.fetch = async function tracedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const store = storage.getStore();
    const host = getSupabaseHost();
    if (!store || !host) return orig(input, init);

    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;

    let targetHost = "";
    try {
      targetHost = new URL(urlStr).host;
    } catch {
      return orig(input, init);
    }
    if (targetHost !== host) return orig(input, init);

    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const startedAt = Date.now();
    try {
      const res = await orig(input, init);
      store.calls.push({
        method,
        pathKey: pathKeyFor(method, urlStr),
        durationMs: Date.now() - startedAt,
        status: res.status,
      });
      return res;
    } catch (err) {
      store.calls.push({
        method,
        pathKey: pathKeyFor(method, urlStr),
        durationMs: Date.now() - startedAt,
        status: 0,
      });
      throw err;
    }
  } as typeof fetch;
}

function threshold(): number {
  const raw = process.env.DB_TRACE_NPLUS1_THRESHOLD;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 5;
}

function emit(store: TraceStore): void {
  const byKey: Record<string, number> = {};
  let totalMs = 0;
  for (const c of store.calls) {
    byKey[c.pathKey] = (byKey[c.pathKey] ?? 0) + 1;
    totalMs += c.durationMs;
  }
  const limit = threshold();
  const warnings: string[] = [];
  for (const [k, n] of Object.entries(byKey)) {
    if (n >= limit) warnings.push(`n_plus_one: ${k} ×${n}`);
  }
  // One structured line per server function call.
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: warnings.length ? "warn" : "info",
      action: "db_trace",
      label: store.label,
      totalQueries: store.calls.length,
      totalMs,
      durationMs: Date.now() - store.startedAt,
      byKey,
      ...(warnings.length ? { warnings } : {}),
    }),
  );
}

export async function runWithTrace<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (isDisabled()) return fn();
  installFetchPatch();
  const store: TraceStore = { calls: [], startedAt: Date.now(), label };
  try {
    return await storage.run(store, fn);
  } finally {
    try {
      emit(store);
    } catch {
      // tracing must never break the request
    }
  }
}
