import { Skeleton } from "@/components/ui/Skeleton";

/** Skeleton for a table: header row + N data rows with given cell widths. */
export function TableSkeleton({
  rows = 5,
  colCount = 5,
  className = "",
}: {
  rows?: number;
  colCount?: number;
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto ${className}`.trim()}>
      <table className="w-full text-left text-sm min-w-[600px]">
        <thead>
          <tr className="border-b border-slate-700/60 bg-slate-800/50">
            {Array.from({ length: colCount }).map((_, i) => (
              <th key={i} className="px-5 py-3.5">
                <Skeleton className="h-3 w-20 rounded" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="border-b border-slate-700/40">
              {Array.from({ length: colCount }).map((_, colIndex) => (
                <td key={colIndex} className="px-5 py-3.5">
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
