import {
  ENQUIRY_STATUS_LABEL,
  type EnquiryStatus,
} from "@/types/enquiry.types";

const STYLES: Record<EnquiryStatus, { wrap: string; dot: string }> = {
  new: {
    wrap: "border-primary/30 bg-primary/10 text-primary",
    dot: "bg-primary",
  },
  contacted: {
    wrap: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  in_progress: {
    wrap: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  converted: {
    wrap: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  closed: {
    wrap: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/60",
  },
};

export function EnquiryStatusBadge({ status }: { status: EnquiryStatus }) {
  const s = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${s.wrap}`}
    >
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {ENQUIRY_STATUS_LABEL[status]}
    </span>
  );
}
