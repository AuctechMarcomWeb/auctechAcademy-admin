"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Lightweight client-side data table: search, custom filters, column sorting
 * and pagination. Designed for mock data; swap `rows` for server-paginated
 * results later without changing callers.
 */
export function DataTable({
  rows,
  columns,
  rowKey,
  searchable,
  searchPlaceholder = "Search…",
  toolbar,
  filter,
  pageSize = 10,
  emptyTitle = "Nothing to show",
  emptyDescription,
  loading,
  initialSort,
  onRowClick,
  footer,
}) {
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [sort, setSort] = React.useState(initialSort);

  // Reset to the first page whenever the inputs that change the result set change.
  const resetKey = `${query}|${rows.length}|${filter ? "f" : ""}`;
  const [lastKey, setLastKey] = React.useState(resetKey);
  if (lastKey !== resetKey) {
    setLastKey(resetKey);
    setPage(1);
  }

  const processed = React.useMemo(() => {
    let list = rows;
    if (query.trim() && searchable) {
      const q = query.trim().toLowerCase();
      list = list.filter((r) => searchable(r).toLowerCase().includes(q));
    }
    if (filter) list = list.filter(filter);
    if (sort) {
      const col = columns.find((c) => c.id === sort.id);
      if (col?.sortValue) {
        const sv = col.sortValue;
        list = [...list].sort((a, b) => {
          const av = sv(a);
          const bv = sv(b);
          const res = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
          return sort.dir === "asc" ? res : -res;
        });
      }
    }
    return list;
  }, [rows, query, searchable, filter, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(processed.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visible = processed.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (id) => setSort((s) => (s?.id === id ? (s.dir === "asc" ? { id, dir: "desc" } : undefined) : { id, dir: "asc" }));

  return (
    <div className="space-y-3">
      {(searchable || toolbar) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {searchable && (
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9"
                aria-label="Search table"
              />
            </div>
          )}
          {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : processed.length === 0 ? (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription ?? (query ? "Try a different search term." : undefined)}
            compact
            className="border-0 rounded-none"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {columns.map((col) => (
                  <TableHead key={col.id} className={col.headerClassName}>
                    {col.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.id)}
                        className="inline-flex items-center gap-1 hover:text-foreground cursor-pointer uppercase"
                      >
                        {col.header}
                        {sort?.id === col.id ? (
                          sort.dir === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  onClick={
                    onRowClick
                      ? (e) => {
                          const target = e.target;
                          // Ignore clicks from pop-ups rendered in portals (menus, dialogs) and from controls inside the row.
                          if (!e.currentTarget.contains(target) || target.closest("button, a, input, select, textarea, [role='menuitem']")) return;
                          onRowClick(row);
                        }
                      : undefined
                  }
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {columns.map((col) => (
                    <TableCell key={col.id} className={col.className}>
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
        <p>
          Showing {processed.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, processed.length)} of {processed.length}
        </p>
        <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
      </div>
      {footer}
    </div>
  );
}
