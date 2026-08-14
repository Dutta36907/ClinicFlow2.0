// React Query hooks for enquiry admin operations.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createEnquiry,
  deleteEnquiry,
  listEnquiries,
  updateEnquiryStatus,
} from "@/lib/enquiries.functions";
import type { EnquiryStatus, EnquiryType } from "@/types/enquiry.types";

export function useDeleteEnquiry() {
  const fn = useServerFn(deleteEnquiry);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string }) => fn({ data: vars }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["enquiries"] });
    },
  });
}

export function useEnquiries(page = 1, pageSize = 25) {
  const fn = useServerFn(listEnquiries);
  return useQuery({
    queryKey: ["enquiries", { page, pageSize }],
    queryFn: () => fn({ data: { page, pageSize } }),
  });
}

export function useUpdateEnquiryStatus() {
  const fn = useServerFn(updateEnquiryStatus);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; status: EnquiryStatus }) => fn({ data: vars }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["enquiries"] });
    },
  });
}

export interface CreateEnquiryInput {
  full_name: string;
  company_name?: string;
  email: string;
  phone: string;
  message?: string;
  enquiry_type: EnquiryType;
}

export function useCreateEnquiry() {
  const fn = useServerFn(createEnquiry);
  return useMutation({
    mutationFn: (vars: CreateEnquiryInput) => fn({ data: vars }),
  });
}
