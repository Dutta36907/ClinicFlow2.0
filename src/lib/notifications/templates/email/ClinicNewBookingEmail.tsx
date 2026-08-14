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
import { button, card, container, footer, heroTeal, main, rowLabel, rowValue } from "./shared";

export interface ClinicNewBookingEmailProps {
  clinicName: string;
  patientName: string;
  /**
   * MUST be already masked by the caller (e.g. `maskPhone(rawPatientPhone)`
   * in the dispatcher). This component does NOT mask — it renders the value
   * as-is. Passing a raw phone here leaks PII into clinic-staff email.
   */
  patientPhone: string;
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
  managerPortalUrl: string;
}

export function ClinicNewBookingEmail(p: ClinicNewBookingEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        New booking — {p.patientName} with {p.doctorName}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={{ color: "#64748B", fontSize: "13px", margin: 0 }}>{p.clinicName}</Text>
          <Heading as="h1" style={heroTeal}>
            New booking received
          </Heading>
          <Section style={card}>
            <Text style={rowLabel}>Patient</Text>
            <Text style={rowValue}>
              {p.patientName} · {p.patientPhone}
            </Text>
            <Text style={rowLabel}>Doctor</Text>
            <Text style={rowValue}>{p.doctorName}</Text>
            <Text style={rowLabel}>When</Text>
            <Text style={{ ...rowValue, marginBottom: 0 }}>
              {p.appointmentDate} at {p.appointmentTime}
            </Text>
          </Section>
          <Section style={{ textAlign: "center", margin: "16px 0" }}>
            <Button href={`${p.managerPortalUrl.replace(/\/$/, "")}/appointments`} style={button}>
              View in portal
            </Button>
          </Section>
          <Hr style={{ borderColor: "#E2E8F0", margin: "24px 0" }} />
          <Text style={footer}>Powered by ClinicFlow</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ClinicNewBookingEmail;
