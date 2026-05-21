import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  // Adds internal padding. Off by default because tables / editors that own
  // their own padding don't want it.
  padded?: boolean;
};

// Shared panel surface — slightly lighter than the page background with a
// soft shadow, so content cards visually separate from the layout chrome.
export function Card({ padded = false, className = "", children, ...rest }: CardProps) {
  const base =
    "rounded-lg border border-neutral-700 bg-neutral-900 shadow-lg shadow-black/30";
  const padding = padded ? " px-5 py-4" : "";
  return (
    <div className={`${base}${padding} ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}
