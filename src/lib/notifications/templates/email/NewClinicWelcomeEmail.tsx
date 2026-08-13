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
import { button, card, colors, container, footer, heroTeal, main, rowLabel, rowValue } from "./shared";

export interface NewClinicWelcomeEmailProps {
  managerName: string;
  clinicName: string;
  clinicSlug: string;
  loginUrl: string;
  tempPassword?: string;
}

export function NewClinicWelcomeEmail(p: NewClinicWelcomeEmailProps) {
  const liveUrl = `${p.loginUrl.replace(/\/$/, "")}/${p.clinicSlug}`;
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Welcome to ClinicFlow, {p.clinicName}!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading as="h1" style={heroTeal}>Welcome to ClinicFlow, {p.clinicName}!</Heading>
          <Text style={{ fontSize: "15px", margin: "0 0 16px" }}>
            Hi {p.managerName}, your clinic is live and ready to take bookings.
          </Text>
          <Section style={{ textAlign: "center", margin: "16px 0" }}>
            <Button href={liveUrl} style={button}>View your live clinic page</Button>
          </Section>
          <Section style={card}>
            <Text style={rowLabel}>Login URL</Text>
            <Text style={rowValue}>{p.loginUrl}</Text>
            {p.tempPassword ? (
              <>
                <Text style={rowLabel}>Temporary Password</Text>
                <Text style={{ ...rowValue, fontFamily: "monospace", marginBottom: 0 }}>{p.tempPassword}</Text>
              </>
            ) : (
              <Text style={{ fontSize: "13px", color: colors.muted, margin: 0 }}>
                Use the password set by your administrator. Reset it any time from the login page.
              </Text>
            )}
          </Section>
          <Heading as="h2" style={{ fontSize: "16px", marginTop: "24px" }}>Get started</Heading>
          <Text style={{ fontSize: "14px", margin: "4px 0" }}>1. Add your doctors and their schedules.</Text>
          <Text style={{ fontSize: "14px", margin: "4px 0" }}>2. Upload clinic photos and treatments.</Text>
          <Text style={{ fontSize: "14px", margin: "4px 0" }}>3. Share your booking link with patients.</Text>
          <Text style={{ fontSize: "14px", margin: "4px 0" }}>4. Configure notification preferences.</Text>
          <Hr style={{ borderColor: "#E2E8F0", margin: "24px 0" }} />
          <Text style={footer}>Need help? Reply to this email anytime.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default NewClinicWelcomeEmail;
