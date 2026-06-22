import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)]",
        className,
      )}
      {...props}
    />
  );
}
