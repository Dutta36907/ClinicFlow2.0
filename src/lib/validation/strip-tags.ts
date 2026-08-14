// Tiny server-safe HTML/script stripper for free-text fields that should
// never carry markup. Removes any tag-like sequence and decodes a few
// common entities. Not a full sanitizer — we never RENDER these fields as
// HTML; this is a defense-in-depth scrub before they hit the database.
export function stripTags(input: string | null | undefined): string {
  if (!input) return "";
  return (
    String(input)
      // Strip <script>…</script> and <style>…</style> blocks entirely
      .replace(/<(script|style)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, "")
      // Strip every other tag
      .replace(/<\/?[^>]+>/g, "")
      // Decode the handful of entities a stripped-tag string might still carry
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .trim()
  );
}
