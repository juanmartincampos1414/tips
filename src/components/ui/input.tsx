import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-border bg-card px-4 text-sm text-dark outline-none transition-colors placeholder:text-muted/60 focus:border-pink focus:ring-2 focus:ring-pink/20",
        className,
      )}
      {...props}
    />
  );
}

type FieldProps = {
  label: string;
  name: string;
  error?: string;
  children: React.ReactNode;
};

export function Field({ label, name, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-dark">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-pink">{error}</p> : null}
    </div>
  );
}
