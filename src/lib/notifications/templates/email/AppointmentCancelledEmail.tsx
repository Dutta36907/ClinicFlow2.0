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
import { card, colors, container, footer, main, rowLabel, rowValue } from "./shared";

export interface AppointmentCancelledEmailProps {
  patientName: string;
  clinicName: string;
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
  clinicPhone: string;
  reason?: string;
}

export function AppointmentCancelledEmail(p: AppointmentCancelledEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your appointment at {p.clinicName} has been cancelled</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={{ color: "#64748B", fontSize: "13px", margin: 0 }}>{p.clinicName}</Text>
          <Heading as="h1" style={{ color: "#B91C1C", fontSize: "22px", margin: "8px 0 16px" }}>
            Your appointment has been cancelled
          </Heading>
          <Text style={{ fontSize: "15px", margin: "0 0 16px" }}>
            Hi {p.patientName}, the following appointment has been cancelled.
          </Text>
          <Section style={card}>
            <Text style={rowLabel}>Doctor</Text>
            <Text style={rowValue}>{p.doctorName}</Text>
            <Text style={rowLabel}>Date</Text>
            <Text style={rowValue}>{p.appointmentDate}</Text>
            <Text style={rowLabel}>Time</Text>
            <Text style={{ ...rowValue, marginBottom: 0 }}>{p.appointmentTime}</Text>
          </Section>
          {p.reason ? (
            <Text style={{ fontSize: "14px", color: colors.muted }}>
              <strong>Reason:</strong> {p.reason}
            </Text>
          ) : null}
          <Text style={{ fontSize: "14px", color: colors.muted }}>
            To rebook, please call {p.clinicPhone} or visit our booking page.
          </Text>
          <Hr style={{ borderColor: "#E2E8F0", margin: "24px 0" }} />
          <Text style={footer}>Powered by ClinicFlow</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default AppointmentCancelledEmail;
