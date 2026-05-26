"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

type RefreshButtonProps = {
  // Custom action to run before refreshing. Lets callers re-fetch client-side
  // state (SWR, local caches) alongside the server refresh.
  onRefresh?: () => Promise<void> | void;
  label?: string;
  className?: string;
};

// Triggers a Next.js server-component re-render via router.refresh(). Spins
// while the refresh is in flight so the user gets feedback. Works on any page
// rendered by a React Server Component — drop it next to the page heading.
export function RefreshButton({
  onRefresh,
  label = "Refresh",
  className = "",
}: RefreshButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      if (onRefresh) await onRefresh();
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={label}
      className={`inline-flex items-center gap-2 rounded border border-neutral-700 bg-neutral-800 px-3 py-1 text-sm hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 ${className}`.trim()}
    >
      <RefreshIcon spinning={isPending} />
      <span>{isPending ? "Refreshing…" : label}</span>
    </button>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={spinning ? "animate-spin" : ""}
    >
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v6h-6" />
    </svg>
  );
}
