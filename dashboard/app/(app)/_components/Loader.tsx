type LoaderProps = {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
};

const SIZES: Record<NonNullable<LoaderProps["size"]>, string> = {
  sm: "h-3 w-3 border-2",
  md: "h-4 w-4 border-2",
  lg: "h-6 w-6 border-[3px]",
};

// Spinner + optional label. Inline-flex by default so it sits naturally inside
// buttons, headers, and table cells. Wrap it in a centering container when you
// want a "card is loading" block.
export function Loader({ size = "md", label, className = "" }: LoaderProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 text-neutral-400 ${className}`.trim()}
    >
      <span
        aria-hidden="true"
        className={`${SIZES[size]} animate-spin rounded-full border-neutral-600 border-t-neutral-200`}
      />
      {label && <span className="text-sm">{label}</span>}
      {!label && <span className="sr-only">Loading</span>}
    </span>
  );
}

// Convenience wrapper for the "centered in a card" case.
export function LoaderBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center px-6 py-10">
      <Loader size="lg" label={label} />
    </div>
  );
}
