// Shared types for landing-page enquiries (Request Demo / Sign Up).
export const ENQUIRY_TYPES = ["request_demo", "sign_up"] as const;
export type EnquiryType = (typeof ENQUIRY_TYPES)[number];

export const ENQUIRY_STATUSES = [
  "new",
  "contacted",
  "in_progress",
  "converted",
  "closed",
] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export interface Enquiry {
  id: string;
  full_name: string;
  company_name: string | null;
  email: string;
  phone: string;
  message: string | null;
  enquiry_type: EnquiryType;
  status: EnquiryStatus;
  created_at: string;
  updated_at: string;
}

export const ENQUIRY_TYPE_LABEL: Record<EnquiryType, string> = {
  request_demo: "Request Demo",
  sign_up: "Sign Up",
};

export const ENQUIRY_STATUS_LABEL: Record<EnquiryStatus, string> = {
  new: "New",
  contacted: "Contacted",
  in_progress: "In Progress",
  converted: "Converted",
  closed: "Closed",
};
