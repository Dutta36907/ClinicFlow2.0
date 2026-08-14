/**
 * Masks a phone number showing only the last 5 digits.
 * Input: any Indian mobile format (10 digits, or with +91/91 prefix).
 * Output: XXXXX{last5}
 *
 * Examples:
 *   9876543210     → XXXXX43210
 *   919876543210   → XXXXX43210
 *   +919876543210  → XXXXX43210
 *   undefined/null → XXXXXXXXXX  (safe fallback, no crash)
 */
export function maskPhone(phone: string | undefined | null): string {
  if (!phone) return "XXXXXXXXXX";
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
  if (local.length < 5) return "XXXXXXXXXX";
  return "XXXXX" + local.slice(-5);
}

/**
 * Masks an email showing first 2 chars + *** + @domain.
 *
 * Examples:
 *   priya@gmail.com → pr***@gmail.com
 *   a@gmail.com     → a****@gmail.com
 *   undefined/null  → ***@***.***
 */
export function maskEmail(email: string | undefined | null): string {
  if (!email) return "***@***.***";
  const [local, domain] = email.split("@");
  if (!domain || !local) return "***@***.***";
  const visible = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
  const stars = local.length > 2 ? "***" : "****";
  return `${visible}${stars}@${domain}`;
}
