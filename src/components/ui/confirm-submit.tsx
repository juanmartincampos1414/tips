"use client";

/**
 * A submit button that asks for confirmation before letting the form submit.
 * Use for destructive / irreversible / outward-facing actions (send a campaign,
 * claim a reward, archive, mark a band lost…). Cancelling stops the submission.
 */
export function ConfirmSubmit({
  message,
  children,
  className,
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
