import {
  Body,
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
import { card, colors, container, footer, heroTeal, main, rowLabel } from "./shared";

export interface AppointmentRescheduledEmailProps {
  patientName: string;
  clinicName: string;
  doctorName: string;
  oldDate: string;
  oldTime: string;
  appointmentDate: string;
  appointmentTime: string;
  clinicAddress: string;
  clinicPhone: string;
}

export function AppointmentRescheduledEmail(p: AppointmentRescheduledEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your appointment has been rescheduled</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={{ color: "#64748B", fontSize: "13px", margin: 0 }}>{p.clinicName}</Text>
          <Heading as="h1" style={heroTeal}>
            Your appointment has been rescheduled
          </Heading>
          <Text style={{ fontSize: "15px", margin: "0 0 16px" }}>
            Hi {p.patientName}, your appointment with {p.doctorName} has been moved.
          </Text>
          <Section style={card}>
            <Text style={rowLabel}>Previous</Text>
            <Text
              style={{
                fontSize: "15px",
                textDecoration: "line-through",
                color: colors.muted,
                margin: "0 0 12px",
              }}
            >
              {p.oldDate} at {p.oldTime}
            </Text>
            <Text style={rowLabel}>New</Text>
            <Text
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: colors.primary,
                margin: "0 0 12px",
              }}
            >
              {p.appointmentDate} at {p.appointmentTime}
            </Text>
            <Text style={rowLabel}>Doctor</Text>
            <Text style={{ fontSize: "15px", fontWeight: 600, margin: "0 0 12px" }}>
              {p.doctorName}
            </Text>
            <Text style={rowLabel}>Address</Text>
            <Text style={{ fontSize: "15px", margin: 0 }}>{p.clinicAddress}</Text>
          </Section>
          <Text style={{ fontSize: "14px", color: colors.muted }}>
            Questions? Call {p.clinicPhone}.
          </Text>
          <Hr style={{ borderColor: "#E2E8F0", margin: "24px 0" }} />
          <Text style={footer}>Powered by ClinicFlow</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default AppointmentRescheduledEmail;
