// Shared inline styles for all transactional email templates.
// Teal primary (#0F6E56), Inter, white background, mobile-responsive container.

export const colors = {
  primary: "#0F6E56",
  primaryDark: "#0b5443",
  text: "#0F172A",
  muted: "#475569",
  border: "#E2E8F0",
  bg: "#FFFFFF",
  panel: "#F8FAFC",
  warn: "#BA7517",
  warnBg: "#FEF3C7",
};

export const main = {
  backgroundColor: colors.bg,
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  color: colors.text,
  padding: "0",
  margin: "0",
};

export const container = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "32px 24px",
};

export const heroTeal = {
  color: colors.primary,
  fontSize: "24px",
  fontWeight: 700,
  margin: "0 0 16px",
  lineHeight: "1.3",
};

export const card = {
  backgroundColor: colors.panel,
  border: `1px solid ${colors.border}`,
  borderRadius: "12px",
  padding: "20px",
  margin: "16px 0",
};

export const rowLabel = {
  color: colors.muted,
  fontSize: "13px",
  margin: "0 0 2px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
};

export const rowValue = {
  color: colors.text,
  fontSize: "15px",
  fontWeight: 600,
  margin: "0 0 12px",
};

export const button = {
  backgroundColor: colors.primary,
  color: "#FFFFFF",
  padding: "12px 24px",
  borderRadius: "8px",
  textDecoration: "none",
  fontWeight: 600,
  fontSize: "15px",
  display: "inline-block",
};

export const footer = {
  color: colors.muted,
  fontSize: "12px",
  textAlign: "center" as const,
  marginTop: "32px",
};
