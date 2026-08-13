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
import { card, container, footer, heroTeal, main, rowLabel, rowValue } from "./shared";

export interface AppointmentBookedEmailProps {
  patientName: string;
  clinicName: string;
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
  clinicAddress: string;
  clinicPhone: string;
}

export function AppointmentBookedEmail(p: AppointmentBookedEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your appointment at {p.clinicName} is confirmed</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={{ color: "#64748B", fontSize: "13px", margin: 0 }}>{p.clinicName}</Text>
          <Heading as="h1" style={heroTeal}>Your appointment is confirmed ✓</Heading>
          <Text style={{ fontSize: "15px", margin: "0 0 16px" }}>
            Hi {p.patientName}, we look forward to seeing you.
          </Text>
          <Section style={card}>
            <Text style={rowLabel}>Doctor</Text>
            <Text style={rowValue}>{p.doctorName}</Text>
            <Text style={rowLabel}>Date</Text>
            <Text style={rowValue}>{p.appointmentDate}</Text>
            <Text style={rowLabel}>Time</Text>
            <Text style={rowValue}>{p.appointmentTime}</Text>
            <Text style={rowLabel}>Clinic</Text>
            <Text style={rowValue}>{p.clinicName}</Text>
            <Text style={rowLabel}>Address</Text>
            <Text style={{ ...rowValue, marginBottom: 0 }}>{p.clinicAddress}</Text>
          </Section>
          <Text style={{ fontSize: "14px", color: "#475569" }}>
            Please arrive 10 minutes early. Carry a valid ID.
          </Text>
          <Text style={{ fontSize: "14px", color: "#475569" }}>
            Need to reschedule? Call {p.clinicPhone}.
          </Text>
          <Hr style={{ borderColor: "#E2E8F0", margin: "24px 0" }} />
          <Text style={footer}>Powered by ClinicFlow</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default AppointmentBookedEmail;
