"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { slug: "overview", label: "Overview", adminOnly: false },
  { slug: "code", label: "Code", adminOnly: true },
  { slug: "invocations", label: "Invocations", adminOnly: false },
  { slug: "logs", label: "Logs", adminOnly: false },
];

export function FunctionTabs({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const base = `/admin/functions/${encodeURIComponent(name)}`;
  const tabs = TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <nav className="flex gap-1 border-b border-neutral-800">
      {tabs.map((t) => {
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
