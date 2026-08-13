/**
 * In-memory server-fn metrics ring buffer.
 *
 * Lives at module scope inside a single Worker isolate. On Cloudflare Workers
 * each isolate is short-lived and may be replaced between requests, so these
 * numbers are accurate for the *current* isolate's recent traffic only —
 * not a global cluster-wide average. That's acceptable for an at-a-glance
 * monitoring card; if we ever need fleet-wide aggregates we'll flush samples
 * into a `server_fn_metrics` table on a sampled basis.
 *
 * We intentionally do NOT persist on every request — that would double DB
 * writes on the hot path and dominate the very latency we're trying to
 * measure.
 */

type Sample = {
  /** epoch ms */
  at: number;
  /** milliseconds */
  durationMs: number;
  /** true → handler returned without throwing */
  ok: boolean;
  /** server-fn name or label, e.g. "getSuperAdminDashboard" */
  label: string;
};

const RING_CAP = 500;
const ring: Sample[] = [];
let writeIdx = 0;

export function recordSample(s: Sample) {
  if (ring.length < RING_CAP) {
    ring.push(s);
  } else {
    ring[writeIdx] = s;
    writeIdx = (writeIdx + 1) % RING_CAP;
  }
}

function snapshot(): Sample[] {
  return ring.slice();
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

export type MetricsSummary = {
  windowSeconds: number;
  sampleCount: number;
  p50Ms: number;
  p95Ms: number;
  errorRate: number; // 0..1
};

export function summarize(windowSeconds: number): MetricsSummary {
  const cutoff = Date.now() - windowSeconds * 1000;
  const window = snapshot().filter((s) => s.at >= cutoff);
  const durations = window.map((s) => s.durationMs).sort((a, b) => a - b);
  const errors = window.filter((s) => !s.ok).length;
  return {
    windowSeconds,
    sampleCount: window.length,
    p50Ms: Math.round(percentile(durations, 50)),
    p95Ms: Math.round(percentile(durations, 95)),
    errorRate: window.length === 0 ? 0 : errors / window.length,
  };
}

/**
 * Tiny helper: wrap any async work and record one sample.
 * Used by dashboard server fns to self-report timing.
 */
export async function withSample<T>(label: string, work: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try {
    const out = await work();
    recordSample({ at: Date.now(), durationMs: Date.now() - t0, ok: true, label });
    return out;
  } catch (e) {
    recordSample({ at: Date.now(), durationMs: Date.now() - t0, ok: false, label });
    throw e;
  }
}
