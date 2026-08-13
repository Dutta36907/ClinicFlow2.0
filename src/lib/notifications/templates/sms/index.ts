// MSG91 DLT SMS templates. Template IDs come from platform_settings.sms.msg91_template_ids.
// `buildVariables` returns the placeholder map sent to MSG91 Flow API.
// Variable keys (VAR1, VAR2, …) must match the DLT-approved template registered on MSG91.
//
// Privacy: any patient phone variable below MUST be passed through maskPhone()
// so the rendered SMS shows XXXXX{last5} only. DLT-registered template text for
// clinic_new_booking:
//   "New booking at {#var#}: {#var#} with Dr. {#var#} on {#var#} at {#var#}.
//    Patient: {#var#}. Login to manage. -ClinicFlow"
// where the patient variable is always XXXXX{last5}.

import { maskPhone } from "../../mask";

// Per-event SMS template builders. Each function is independently typed.



export const SMS_TEMPLATES = {
  appointment_booked: {
    buildVariables: (p: {
      patientName: string;
      doctorName: string;
      clinicName: string;
      date: string;
      time: string;
      appointmentId: string;
      clinicPhone: string;
    }) => ({
      VAR1: p.patientName,
      VAR2: p.doctorName,
      VAR3: p.clinicName,
      VAR4: p.date,
      VAR5: p.time,
      VAR6: p.appointmentId.slice(-6).toUpperCase(),
      VAR7: p.clinicPhone,
    }),
  },
  appointment_rescheduled: {
    buildVariables: (p: {
      patientName: string;
      clinicName: string;
      newDate: string;
      newTime: string;
      doctorName: string;
      clinicPhone: string;
    }) => ({
      VAR1: p.patientName,
      VAR2: p.clinicName,
      VAR3: p.newDate,
      VAR4: p.newTime,
      VAR5: p.doctorName,
      VAR6: p.clinicPhone,
    }),
  },
  clinic_new_booking: {
    buildVariables: (p: {
      clinicName: string;
      patientName: string;
      doctorName: string;
      date: string;
      time: string;
      patientPhone: string;
    }) => ({
      VAR1: p.clinicName,
      VAR2: p.patientName,
      VAR3: p.doctorName,
      VAR4: p.date,
      VAR5: p.time,
      VAR6: maskPhone(p.patientPhone),
    }),
  },
  subscription_expiry: {
    buildVariables: (p: {
      managerName: string;
      clinicName: string;
      expiryDate: string;
      supportPhone: string;
    }) => ({
      VAR1: p.managerName,
      VAR2: p.clinicName,
      VAR3: p.expiryDate,
      VAR4: p.supportPhone,
    }),
  },
  new_clinic_welcome: {
    buildVariables: (p: { managerName: string; clinicName: string; loginUrl: string }) => ({
      VAR1: p.managerName,
      VAR2: p.clinicName,
      VAR3: p.loginUrl,
    }),
  },
} as const;
