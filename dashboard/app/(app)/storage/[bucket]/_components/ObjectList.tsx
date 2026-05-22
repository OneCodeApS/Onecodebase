"use client";

import { useState } from "react";
import { FileDetailPanel, type FileEntry } from "./FileDetailPanel";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

// Client wrapper around the object table so a row click opens the detail
// panel. The actual table layout stays the same — selection is just local
// state, no URL change.
export function ObjectList({
  bucket,
  objects,
  canWrite,
}: {
  bucket: string;
  objects: FileEntry[];
  canWrite: boolean;
}) {
  const [selected, setSelected] = useState<FileEntry | null>(null);

  return (
    <>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-700 bg-neutral-800/60 text-left text-neutral-400">
            <th className="px-3 py-2 font-normal">Name</th>
            <th className="px-3 py-2 font-normal text-right">Size</th>
            <th className="px-3 py-2 font-normal">Modified</th>
          </tr>
        </thead>
        <tbody>
          {objects.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-3 py-6 text-center text-neutral-500">
                Empty bucket.
              </td>
            </tr>
          ) : (
            objects.map((o) => {
              const isSelected = selected?.name === o.name;
              const lm =
                o.lastModified instanceof Date
                  ? o.lastModified
                  : new Date(o.lastModified);
              return (
                <tr
                  key={o.name}
                  data-storage-row
                  onClick={() => setSelected(o)}
                  className={`cursor-pointer border-b border-neutral-800 last:border-b-0 ${
                    isSelected
                      ? "bg-neutral-800/70"
                      : "odd:bg-neutral-900 even:bg-neutral-950/40 hover:bg-neutral-800/50"
                  }`}
                >
                  <td className="px-3 py-2 font-mono text-neutral-200">{o.name}</td>
                  <td className="px-3 py-2 text-right font-mono text-neutral-400">
                    {formatSize(o.size)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-neutral-500">
                    {lm.toISOString().slice(0, 19).replace("T", " ")}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {selected && (
        <FileDetailPanel
          bucket={bucket}
          object={selected}
          canWrite={canWrite}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
