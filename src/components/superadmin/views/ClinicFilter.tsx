// Reusable clinic filter dropdown for super-admin views.
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ClinicOption = { id: string; name: string };

export function ClinicFilter({
  value,
  onChange,
  clinics,
  label = "Clinic",
}: {
  value: string;
  onChange: (v: string) => void;
  clinics: ClinicOption[];
  label?: string;
}) {
  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <span className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-full sm:w-[220px]">
          <SelectValue placeholder="All clinics" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All clinics</SelectItem>
          {clinics.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
