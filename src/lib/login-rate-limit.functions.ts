// Rate limiting for password sign-in/sign-up. These go straight from the
// client to Supabase Auth (supabase.auth.signInWithPassword/signUp), so
// there's no server function in the credential-check path to hang a limit
// off — the client calls this one first instead, same dual-key pattern
// (identifier + IP) used for OTP/booking in public.functions.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertRateLimit, getClientIp } from "@/lib/server/rate-limit";

const emailSchema = z.string().trim().toLowerCase().email().max(255);

export const assertLoginRateLimit = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string }) => ({ email: emailSchema.parse(d.email) }))
  .handler(async ({ data }) => {
    const clientIp = getClientIp();
    // Per-email: stops credential stuffing against one account.
    await assertRateLimit(`login:email:${data.email}`, {
      capacity: 5,
      refillSeconds: 600,
      label: "sign-in",
    });
    // Per-IP: stops scripted guessing spread across many accounts from one source.
    await assertRateLimit(`login:ip:${clientIp}`, {
      capacity: 20,
      refillSeconds: 600,
      label: "sign-in",
    });
  });

export const assertSignupRateLimit = createServerFn({ method: "POST" }).handler(async () => {
  await assertRateLimit(`signup:ip:${getClientIp()}`, {
    capacity: 5,
    refillSeconds: 3600,
    label: "sign-up",
  });
});
