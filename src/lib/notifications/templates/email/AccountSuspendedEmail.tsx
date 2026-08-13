import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";
import { button, colors, container, footer, main } from "./shared";

export interface AccountSuspendedEmailProps {
  managerName: string;
  clinicName: string;
  reason?: string;
  contactUrl: string;
}

export function AccountSuspendedEmail(p: AccountSuspendedEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`Your ${p.clinicName} account has been suspended`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section
            style={{
              backgroundColor: "#FEE2E2",
              padding: "16px 20px",
              borderRadius: "10px",
              borderLeft: "4px solid #B91C1C",
            }}
          >
            <Heading as="h1" style={{ color: "#B91C1C", fontSize: "20px", margin: 0 }}>
              Your account has been suspended
            </Heading>
          </Section>
          <Text style={{ fontSize: "15px", margin: "16px 0" }}>
            Hi {p.managerName}, the ClinicFlow account for <strong>{p.clinicName}</strong> has been
            suspended and is no longer accepting new bookings. Your public clinic page is hidden,
            but your data is retained.
          </Text>
          {p.reason ? (
            <Section
              style={{
                backgroundColor: colors.panel,
                padding: "16px",
                borderRadius: "10px",
                margin: "16px 0",
              }}
            >
              <Text style={{ fontSize: "13px", color: colors.muted, margin: "0 0 4px" }}>
                Reason
              </Text>
              <Text style={{ fontSize: "15px", margin: 0 }}>{p.reason}</Text>
            </Section>
          ) : null}
          <Text style={{ fontSize: "14px", color: colors.muted }}>
            If you believe this is a mistake or want to reactivate your account, please get in
            touch.
          </Text>
          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Button href={p.contactUrl} style={button}>
              Contact support
            </Button>
          </Section>
          <Hr style={{ borderColor: "#E2E8F0", margin: "24px 0" }} />
          <Text style={footer}>ClinicFlow</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default AccountSuspendedEmail;
