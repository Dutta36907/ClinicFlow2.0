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

export interface ClinicManagerInviteEmailProps {
  managerName: string;
  clinicName: string;
  loginUrl: string;
  loginEmail: string;
  tempPassword?: string;
}

export function ClinicManagerInviteEmail(p: ClinicManagerInviteEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`You've been invited to manage ${p.clinicName} on ClinicFlow`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading as="h1" style={heroTeal}>
            You're invited to manage {p.clinicName}
          </Heading>
          <Text style={{ fontSize: "15px", margin: "0 0 16px" }}>
            Hi {p.managerName}, your ClinicFlow manager account is ready. Use the credentials
            below to sign in and complete setup.
          </Text>
          <Section style={card}>
            <Text style={rowLabel}>Sign-in URL</Text>
            <Text style={rowValue}>{p.loginUrl}</Text>
            <Text style={rowLabel}>Email</Text>
            <Text style={rowValue}>{p.loginEmail}</Text>
            {p.tempPassword ? (
              <>
                <Text style={rowLabel}>Temporary password</Text>
                <Text
                  style={{
                    ...rowValue,
                    fontFamily: "monospace",
                    marginBottom: 0,
                  }}
                >
                  {p.tempPassword}
                </Text>
              </>
            ) : (
              <Text style={{ fontSize: "13px", color: colors.muted, margin: 0 }}>
                Use the password set by your administrator. You can reset it from the sign-in page.
              </Text>
            )}
          </Section>
          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Button href={p.loginUrl} style={button}>
              Sign in to your dashboard
            </Button>
          </Section>
          <Text style={{ fontSize: "13px", color: colors.muted }}>
            For your security, please change your password after your first sign-in.
          </Text>
          <Hr style={{ borderColor: "#E2E8F0", margin: "24px 0" }} />
          <Text style={footer}>ClinicFlow</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ClinicManagerInviteEmail;
