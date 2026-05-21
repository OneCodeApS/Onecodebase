"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { createBucket } from "../actions";

export type BucketEntry = { name: string; creationDate: Date };

export function BucketsSidebar({
  buckets,
  isAdmin,
}: {
  buckets: BucketEntry[];
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const [showNew, setShowNew] = useState(false);

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-neutral-800 bg-neutral-950">
      <div className="border-b border-neutral-800 px-3 py-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Buckets
          </div>
          {isAdmin && !showNew && (
            <button
              type="button"
              onClick={() => setShowNew(true)}
              title="New bucket"
              className="rounded border border-neutral-700 px-1.5 py-0.5 text-xs text-neutral-300 hover:bg-neutral-800"
            >
              +
            </button>
          )}
        </div>
        {isAdmin && showNew && (
          <form action={createBucket} className="mt-2 space-y-2">
            <input
              type="text"
              name="name"
              autoFocus
              required
              placeholder="bucket-name"
              pattern="[a-z0-9][a-z0-9-]{1,61}[a-z0-9]"
              title="3-63 chars, lowercase letters/digits/hyphens"
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 font-mono text-xs"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-800"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {buckets.length === 0 ? (
          <p className="px-2 py-2 text-xs text-neutral-500">No buckets yet.</p>
        ) : (
          buckets.map((b) => {
            const href = `/storage/${encodeURIComponent(b.name)}`;
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={b.name}
                href={href}
                className={`block rounded px-2 py-1.5 text-sm ${
                  isActive
                    ? "bg-neutral-800 text-neutral-100"
                    : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
                }`}
              >
                <span className="truncate font-mono">{b.name}</span>
              </Link>
            );
          })
        )}
      </nav>
    </aside>
  );
}
