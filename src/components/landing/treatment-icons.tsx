/**
 * Curated set of icons usable for treatments. Keeping the list small so
 * the picker stays scannable and the public page stays on-brand.
 */
import {
  Stethoscope, HeartPulse, Brain, Baby, Smile, Eye, Ear, Bone,
  Pill, Syringe, Microscope, Activity, Sparkles, ShieldCheck, Bandage,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";

export const TREATMENT_ICON_MAP: Record<string, LucideIcon> = {
  stethoscope: Stethoscope,
  heartpulse: HeartPulse,
  brain: Brain,
  baby: Baby,
  smile: Smile,
  eye: Eye,
  ear: Ear,
  bone: Bone,
  pill: Pill,
  syringe: Syringe,
  microscope: Microscope,
  activity: Activity,
  sparkles: Sparkles,
  shield: ShieldCheck,
  bandage: Bandage,
};

export const TREATMENT_ICONS: { name: string; label: string }[] = [
  { name: "stethoscope", label: "General medicine" },
  { name: "heartpulse", label: "Cardiology" },
  { name: "brain", label: "Neurology" },
  { name: "baby", label: "Pediatrics" },
  { name: "smile", label: "Dental" },
  { name: "eye", label: "Ophthalmology" },
  { name: "ear", label: "ENT" },
  { name: "bone", label: "Orthopedics" },
  { name: "pill", label: "Pharmacy" },
  { name: "syringe", label: "Vaccination" },
  { name: "microscope", label: "Lab / Diagnostics" },
  { name: "activity", label: "Physiotherapy" },
  { name: "sparkles", label: "Dermatology" },
  { name: "shield", label: "Preventive care" },
  { name: "bandage", label: "Wound care" },
];

export function TreatmentIcon({
  name,
  ...rest
}: Omit<ComponentProps<LucideIcon>, "name"> & { name: string | null | undefined }) {
  const Icon = (name && TREATMENT_ICON_MAP[name]) || Stethoscope;
  return <Icon {...rest} />;
}
