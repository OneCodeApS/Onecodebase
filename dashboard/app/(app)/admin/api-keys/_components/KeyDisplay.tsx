"use client";

import { useState } from "react";

// Renders a long JWT in a copyable code block. The `sensitive` variant masks
// the value behind a Reveal button so the service-role key isn't visible to
// anyone glancing at the screen.
export function KeyDisplay({
  value,
  sensitive = false,
}: {
  value: string;
  sensitive?: boolean;
}) {
  const [revealed, setRevealed] = useState(!sensitive);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write can fail in insecure contexts; silently no-op.
    }
  }

  return (
    <div className="mt-3">
      <div className="overflow-x-auto rounded border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-xs text-neutral-300">
        {revealed ? value : "•".repeat(64)}
      </div>
      <div className="mt-2 flex gap-2">
        {sensitive && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="rounded border border-neutral-700 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-800"
          >
            {revealed ? "Hide" : "Reveal"}
          </button>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1 text-xs hover:bg-neutral-700"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
