"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { slug: "overview", label: "Overview" },
  { slug: "code", label: "Code" },
  { slug: "invocations", label: "Invocations" },
  { slug: "logs", label: "Logs" },
];

export function FunctionTabs({ name }: { name: string }) {
  const pathname = usePathname();
  const base = `/admin/functions/${encodeURIComponent(name)}`;

  return (
    <nav className="flex gap-1 border-b border-neutral-800">
      {TABS.map((t) => {
        const href = `${base}/${t.slug}`;
        const active = pathname === href;
        return (
          <Link
            key={t.slug}
            href={href}
            className={`relative px-3 py-2 text-sm ${
              active
                ? "text-neutral-100"
                : "text-neutral-400 hover:text-neutral-100"
            }`}
          >
            {t.label}
            {active && (
              <span className="absolute inset-x-2 -bottom-px h-px bg-neutral-100" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
