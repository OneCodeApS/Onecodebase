"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "../logout/actions";
import type { UserRole } from "@/lib/session";

type NavItem = {
  href: string;
  label: string;
  // Match this path as the active route start (e.g. "/tables" matches "/tables/todos").
  match?: string;
  adminOnly?: boolean;
};

type NavGroup = {
  heading: string;
  items: NavItem[];
};

const GROUPS: NavGroup[] = [
  {
    heading: "Database",
    items: [
      { href: "/tables", label: "Tables", match: "/tables" },
      { href: "/sql", label: "SQL Editor", match: "/sql" },
    ],
  },
  {
    heading: "Storage",
    items: [{ href: "/storage", label: "Buckets", match: "/storage" }],
  },
  {
    heading: "Authentication",
    items: [
      { href: "/admin/users", label: "Users", match: "/admin/users", adminOnly: true },
    ],
  },
  {
    heading: "Settings",
    items: [
      { href: "/admin/audit", label: "Audit log", match: "/admin/audit", adminOnly: true },
      { href: "/admin/settings", label: "Audit settings", match: "/admin/settings", adminOnly: true },
    ],
  },
];

export function Sidebar({ email, role }: { email: string; role: UserRole }) {
  const pathname = usePathname();
  const isAdmin = role === "admin";

  function isActive(item: NavItem): boolean {
    const m = item.match ?? item.href;
    return pathname === m || pathname.startsWith(m + "/");
  }

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-neutral-800 bg-neutral-950">
      <div className="border-b border-neutral-800 px-4 py-4">
        <Link href="/" className="text-sm font-semibold text-neutral-100 hover:text-white">
          Onecodebase
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <Link
          href="/"
          className={`block rounded px-2 py-1.5 text-sm ${
            pathname === "/"
              ? "bg-neutral-800 text-neutral-100"
              : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
          }`}
        >
          Home
        </Link>

        {GROUPS.map((group) => {
          const visible = group.items.filter((i) => !i.adminOnly || isAdmin);
          if (visible.length === 0) return null;
          return (
            <div key={group.heading} className="mt-5">
              <div className="px-2 pb-1 text-xs font-medium uppercase tracking-wider text-neutral-500">
                {group.heading}
              </div>
              {visible.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded px-2 py-1.5 text-sm ${
                    isActive(item)
                      ? "bg-neutral-800 text-neutral-100"
                      : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-neutral-800 px-4 py-3 text-xs">
        <div className="truncate font-mono text-neutral-200" title={email}>
          {email}
        </div>
        <div className="mt-0.5 text-neutral-500">{role}</div>
        <form action={logout} className="mt-2">
          <button
            type="submit"
            className="w-full rounded border border-neutral-700 px-2 py-1 text-neutral-300 hover:bg-neutral-800"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
