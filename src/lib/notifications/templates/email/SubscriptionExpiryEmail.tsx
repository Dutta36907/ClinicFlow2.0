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

export interface SubscriptionExpiryEmailProps {
  managerName: string;
  clinicName: string;
  expiryDate: string;
  daysRemaining: number;
  renewalUrl: string;
}

export function SubscriptionExpiryEmail(p: SubscriptionExpiryEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`Your subscription expires in ${p.daysRemaining} days`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section
            style={{
              backgroundColor: colors.warnBg,
              padding: "16px 20px",
              borderRadius: "10px",
              borderLeft: `4px solid ${colors.warn}`,
            }}
          >
            <Heading as="h1" style={{ color: colors.warn, fontSize: "20px", margin: 0 }}>
              {`Your subscription expires in ${p.daysRemaining} days`}
            </Heading>
          </Section>
          <Text style={{ fontSize: "15px", margin: "16px 0" }}>
            Hi {p.managerName}, the ClinicFlow subscription for <strong>{p.clinicName}</strong> is
            approaching its end date.
          </Text>
          <Section
            style={{
              border: `1px solid ${colors.warn}`,
              borderRadius: "10px",
              padding: "20px",
              textAlign: "center",
              margin: "16px 0",
            }}
          >
            <Text
              style={{
                color: colors.muted,
                fontSize: "13px",
                margin: "0 0 6px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Expires on
            </Text>
            <Text style={{ color: colors.warn, fontSize: "22px", fontWeight: 700, margin: 0 }}>
              {p.expiryDate}
            </Text>
          </Section>
          <Text style={{ fontSize: "14px", color: colors.muted }}>
            After expiry, new bookings will be paused and your public clinic page will be hidden.
            Existing data is retained.
          </Text>
          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Button href={p.renewalUrl} style={button}>
              Renew Now
            </Button>
          </Section>
          <Hr style={{ borderColor: "#E2E8F0", margin: "24px 0" }} />
          <Text style={footer}>Questions? Contact ClinicFlow support.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default SubscriptionExpiryEmail;
