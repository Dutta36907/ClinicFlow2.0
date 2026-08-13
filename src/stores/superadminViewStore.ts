import { create } from "zustand";

export type SuperAdminView =
  | "dashboard"
  | "clinics"
  | "doctors"
  | "appointments"
  | "clinicSettings"
  | "enquiries"
  | "subscriptions"
  | "customers"
  | "systemUsers"
  | "userRoles"
  | "audit"
  | "monitoring"
  | "settings"
  | "profile";

interface SuperAdminViewState {
  view: SuperAdminView;
  setView: (view: SuperAdminView) => void;
}

export const useSuperAdminView = create<SuperAdminViewState>((set) => ({
  view: "dashboard",
  setView: (view) => set({ view }),
}));
