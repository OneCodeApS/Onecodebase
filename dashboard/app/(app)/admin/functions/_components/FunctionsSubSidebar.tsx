"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin/functions", label: "Edge functions", matchExact: false, exclude: ["/admin/functions/env"], adminOnly: false },
  { href: "/admin/functions/env", label: "Environment variables", matchExact: false, exclude: [], adminOnly: true },
];

export function FunctionsSubSidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => !i.adminOnly || isAdmin);

  function isActive(item: (typeof ITEMS)[number]): boolean {
    for (const ex of item.exclude) {
      if (pathname === ex || pathname.startsWith(ex + "/")) return false;
    }
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-neutral-800 bg-neutral-950">
      <div className="border-b border-neutral-800 px-3 py-3">
        <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Functions
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {items.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded px-2 py-1.5 text-sm ${
                active
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
