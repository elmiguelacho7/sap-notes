import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-slate-200/75 ring-1 ring-slate-200/70",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
