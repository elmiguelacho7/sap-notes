import { Skeleton } from "@/components/ui/Skeleton";

/** Skeleton for a table: header row + N data rows with given cell widths. */
const cellDefault = "px-5 py-3.5";
const cellFlushLeft = "pl-0 pr-4 py-3.5";

export function TableSkeleton({
  rows = 5,
  colCount = 5,
  className = "",
  /** When true, first column uses pl-0 to align with module header text (same as flush-left tables). */
  flushFirstColumn = false,
}: {
  rows?: number;
  colCount?: number;
  className?: string;
  flushFirstColumn?: boolean;
}) {
  return (
    <div className={`overflow-x-auto ${className}`.trim()}>
      <table className="w-full text-left text-sm min-w-[600px]">
        <thead>
          <tr className="border-b border-slate-200/90 bg-slate-50/85">
            {Array.from({ length: colCount }).map((_, i) => (
              <th key={i} className={flushFirstColumn && i === 0 ? cellFlushLeft : cellDefault}>
                <Skeleton className="h-3 w-20 rounded" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="border-b border-slate-100">
              {Array.from({ length: colCount }).map((_, colIndex) => (
                <td key={colIndex} className={flushFirstColumn && colIndex === 0 ? cellFlushLeft : cellDefault}>
                  <Skeleton className="h-4 w-full max-w-[12rem] rounded" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
