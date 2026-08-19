// URL-synced pagination state. Route-agnostic: reads `page` and `size`
// from whatever route the component is mounted under.
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export function useTablePagination() {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();

  const page = Math.max(1, Number(search.page ?? 1));
  const size = (PAGE_SIZE_OPTIONS as readonly number[]).includes(Number(search.size))
    ? (Number(search.size) as PageSize)
    : 25;

  const from = (page - 1) * size;
  const to = from + size - 1;

  const setPage = useCallback(
    (p: number) => {
      navigate({
        to: ".",
        search: (prev: Record<string, unknown>) => ({ ...prev, page: Math.max(1, p) }),
        replace: true,
      });
    },
    [navigate],
  );

  const setSize = useCallback(
    (s: PageSize) => {
      navigate({
        to: ".",
        search: (prev: Record<string, unknown>) => ({ ...prev, size: s, page: 1 }),
        replace: true,
      });
    },
    [navigate],
  );

  const resetPage = useCallback(() => {
    navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, page: 1 }),
      replace: true,
    });
  }, [navigate]);

  return useMemo(
    () => ({ page, size, from, to, setPage, setSize, resetPage }),
    [page, size, from, to, setPage, setSize, resetPage],
  );
}
