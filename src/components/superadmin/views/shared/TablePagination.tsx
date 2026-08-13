// Footer pagination bar: "Showing X–Y of N", prev/next, size selector.
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PAGE_SIZE_OPTIONS,
  useTablePagination,
  type PageSize,
} from "./useTablePagination";

type Props = {
  total: number;
  /** When true, render compact (no count copy). */
  compact?: boolean;
};

export function TablePagination({ total, compact }: Props) {
  const { page, size, setPage, setSize } = useTablePagination();
  const totalPages = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * size + 1;
  const end = Math.min(total, safePage * size);

  return (
    <div className="flex flex-col items-stretch gap-2 border-t border-border bg-muted/20 px-4 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
      <div className="text-muted-foreground tabular-nums">
        {compact
          ? `${start}–${end} / ${total}`
          : total === 0
            ? "No results"
            : `Showing ${start}–${end} of ${total}`}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Rows</span>
          <Select
            value={String(size)}
            onValueChange={(v) => setSize(Number(v) as PageSize)}
          >
            <SelectTrigger className="h-7 w-[68px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={String(opt)}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="outline"
            className="size-7"
            disabled={safePage <= 1}
            onClick={() => setPage(safePage - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="px-1 text-muted-foreground tabular-nums">
            {safePage} / {totalPages}
          </span>
          <Button
            size="icon"
            variant="outline"
            className="size-7"
            disabled={safePage >= totalPages}
            onClick={() => setPage(safePage + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
