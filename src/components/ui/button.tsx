import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-pink text-pink-foreground hover:opacity-90 disabled:opacity-60",
  secondary:
    "border border-border bg-card text-dark hover:bg-background disabled:opacity-60",
  ghost: "text-muted hover:text-dark hover:bg-background",
  danger: "text-pink hover:bg-pink/5",
} as const;

export type ButtonVariant = keyof typeof variants;

/** Shared button styling — also used to make a <Link> look like a button. */
export function buttonClass(variant: ButtonVariant = "primary", className?: string) {
  return cn(
    "inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-semibold transition-all",
    variants[variant],
    className,
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return <button className={buttonClass(variant, className)} {...props} />;
}
