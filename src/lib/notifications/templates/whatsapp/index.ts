// Interakt WhatsApp templates. The `templateName` must match an
// approved template in your Interakt dashboard. `buildBodyValues` returns
// the ordered list of body variables.
//
// Privacy: any patient phone variable in a template body MUST be wrapped in
// maskPhone() so the rendered WhatsApp message shows XXXXX{last5} only.
// Currently no template here includes a patient phone (audited).
// The import is retained so future templates inherit the rule by default.

import { maskPhone } from "../../mask";

export const WHATSAPP_TEMPLATES = {
  appointment_booked: {
    templateName: "clinicflow_appointment_booked",
    buildBodyValues: (p: {
      patientName: string;
      date: string;
      time: string;
      doctorName: string;
      clinicName: string;
      clinicAddress: string;
      clinicPhone: string;
    }) => [
      p.patientName,
      p.date,
      p.time,
      p.doctorName,
      p.clinicName,
      p.clinicAddress,
      p.clinicPhone,
    ],
  },
  appointment_rescheduled: {
    templateName: "clinicflow_appointment_rescheduled",
    buildBodyValues: (p: {
      patientName: string;
      newDate: string;
      newTime: string;
      doctorName: string;
      clinicName: string;
      clinicPhone: string;
    }) => [p.patientName, p.newDate, p.newTime, p.doctorName, p.clinicName, p.clinicPhone],
  },
  subscription_expiry: {
    templateName: "clinicflow_subscription_expiry",
    buildBodyValues: (p: {
      managerName: string;
      clinicName: string;
      expiryDate: string;
      daysRemaining: number | string;
      supportPhone: string;
    }) => [p.managerName, p.clinicName, p.expiryDate, String(p.daysRemaining), p.supportPhone],
  },
} as const;
