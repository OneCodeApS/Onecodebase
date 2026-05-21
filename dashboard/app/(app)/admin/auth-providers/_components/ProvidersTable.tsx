"use client";

import { useState } from "react";
import { ProviderConfigPanel, type ProviderRow } from "./ProviderConfigPanel";

export function ProvidersTable({ providers }: { providers: ProviderRow[] }) {
  const [selected, setSelected] = useState<ProviderRow | null>(null);

  return (
    <>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-700 bg-neutral-800/60 text-left text-neutral-400">
            <th className="px-3 py-2 font-normal">Provider</th>
            <th className="px-3 py-2 font-normal">Description</th>
            <th className="px-3 py-2 font-normal text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {providers.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-3 py-6 text-center text-neutral-500">
                No providers.
              </td>
            </tr>
          ) : (
            providers.map((p) => {
              const isSelected = selected?.name === p.name;
              return (
                <tr
                  key={p.name}
                  data-provider-row
                  onClick={() => setSelected(p)}
                  className={`cursor-pointer border-b border-neutral-800 last:border-b-0 ${
                    isSelected
                      ? "bg-neutral-800/70"
                      : "odd:bg-neutral-900 even:bg-neutral-950/40 hover:bg-neutral-800/50"
                  }`}
                >
                  <td className="px-3 py-2">
                    <div className="text-sm font-medium text-neutral-100">{p.label}</div>
                    <div className="font-mono text-xs text-neutral-500">{p.name}</div>
                  </td>
                  <td className="px-3 py-2 text-neutral-400">{p.description}</td>
                  <td className="px-3 py-2 text-right">
                    {p.enabled ? (
                      <span className="rounded border border-emerald-900/50 bg-emerald-950/30 px-2 py-0.5 text-xs text-emerald-300">
                        enabled
                      </span>
                    ) : (
                      <span className="rounded border border-neutral-700 bg-neutral-800/40 px-2 py-0.5 text-xs text-neutral-400">
                        disabled
                      </span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {selected && (
        <ProviderConfigPanel
          provider={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
