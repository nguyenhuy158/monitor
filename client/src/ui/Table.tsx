import type { ReactNode } from "react";
import { cn } from "./cn";

export type Column<TRow> = {
  key: string;
  header: ReactNode;
  /** Lay noi dung o tu mot dong du lieu. */
  cell: (row: TRow) => ReactNode;
  align?: "left" | "right";
  /** So lieu: canh phai + font thang cot. */
  numeric?: boolean;
  /** An cot nay tren mobile, chi hien tu sm tro len. */
  hideOnMobile?: boolean;
};

export type TableProps<TRow> = {
  columns: Column<TRow>[];
  rows: TRow[];
  rowKey: (row: TRow) => string;
  onRowClick?: (row: TRow) => void;
  /** Hien khi rows rong. Thuong truyen <EmptyState />. */
  empty?: ReactNode;
  className?: string;
};

/**
 * Bang du lieu. Cuon ngang khi khong du cho thay vi ep chu xuong dong.
 * Muon dep tren mobile that su thi nen doi sang danh sach the (card list) o
 * breakpoint nho, bang chi hop khi so cot it hoac man hinh rong.
 */
export function Table<TRow>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  className,
}: TableProps<TRow>) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className={cn("overflow-x-auto rounded-ui border border-border", className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-muted">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-fg-muted",
                  column.numeric || column.align === "right" ? "text-right" : "text-left",
                  column.hideOnMobile && "hidden sm:table-cell",
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "bg-surface",
                onRowClick && "cursor-pointer transition hover:bg-surface-muted",
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "px-3 py-3 text-fg",
                    column.numeric && "tabular",
                    column.numeric || column.align === "right" ? "text-right" : "text-left",
                    column.hideOnMobile && "hidden sm:table-cell",
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
