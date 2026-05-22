"use client";

import { useState, useTransition } from "react";
import { getShareLink } from "../../actions";

export function ShareButton({ bucket, name }: { bucket: string; name: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    url: string;
    visibility: "public" | "private";
    expiresAt: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  function handleClick() {
    setCopied(false);
    startTransition(async () => {
      try {
        const r = await getShareLink(bucket, name);
        setResult(r);
      } catch (e) {
        setResult({
          url: `Error: ${(e as Error).message}`,
          visibility: "private",
          expiresAt: null,
        });
      }
    });
  }

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write can fail in insecure contexts; fall back to selecting.
    }
  }

  if (!result) {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="text-xs text-neutral-400 underline hover:text-neutral-100 disabled:opacity-50"
      >
        {isPending ? "…" : "Share"}
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <input
        type="text"
        readOnly
        value={result.url}
        onFocus={(e) => e.currentTarget.select()}
        className="w-48 rounded border border-neutral-700 bg-neutral-950 px-2 py-0.5 font-mono text-xs"
      />
      <button
        type="button"
        onClick={handleCopy}
        className="text-xs text-neutral-300 underline hover:text-neutral-100"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <button
        type="button"
        onClick={() => setResult(null)}
        title="Close"
        className="text-xs text-neutral-500 hover:text-neutral-200"
      >
        ✕
      </button>
    </div>
  );
}
