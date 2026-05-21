"use client";

import { useState, useTransition } from "react";
import { verifyChain, type VerifyResult } from "../actions";

export function VerifyButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<VerifyResult | null>(null);

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      const r = await verifyChain();
      setResult(r);
    });
  }

  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1 text-sm hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Verifying…" : "Verify chain"}
      </button>

      {result && <Outcome result={result} />}
    </div>
  );
}

function Outcome({ result }: { result: VerifyResult }) {
  if (result.ok) {
    return (
      <span className="rounded border border-emerald-900/50 bg-emerald-950/30 px-3 py-1 text-sm text-emerald-300">
        ✓ Chain valid — {result.verified.toLocaleString()}{" "}
        {result.verified === 1 ? "row" : "rows"} verified in {result.durationMs} ms
      </span>
    );
  }
  return (
    <div className="rounded border border-red-900/50 bg-red-950/30 px-3 py-1 text-sm text-red-300">
      <div>
        ✗ Chain broken at row #{result.failedRowId} ({result.reason}).{" "}
        {result.verifiedBefore.toLocaleString()} rows verified before the failure.
      </div>
      {result.expected !== null && result.actual !== null && (
        <div className="mt-1 font-mono text-xs text-red-400">
          expected: {result.expected.slice(0, 16)}… / actual:{" "}
          {result.actual.slice(0, 16)}…
        </div>
      )}
    </div>
  );
}
