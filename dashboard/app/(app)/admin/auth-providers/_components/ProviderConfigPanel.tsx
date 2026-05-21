"use client";

import { useEffect, useRef } from "react";
import { updateProvider } from "../actions";

export type ProviderRow = {
  name: string;
  label: string;
  description: string;
  enabled: boolean;
  config: Record<string, unknown>;
};

export function ProviderConfigPanel({
  provider,
  onClose,
}: {
  provider: ProviderRow;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Click outside the panel closes it. We exclude clicks on table rows so
  // selecting a different row doesn't immediately re-close the new panel.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const t = e.target as HTMLElement;
        if (t.closest("[data-provider-row]")) return;
        onClose();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const cfg = provider.config ?? {};
  const hasSecret = Boolean((cfg as { client_secret?: string }).client_secret);

  return (
    <aside
      ref={panelRef}
      className="fixed right-0 top-0 z-40 flex h-screen w-[460px] flex-col border-l border-neutral-800 bg-neutral-950 shadow-2xl shadow-black/40"
    >
      <div className="flex items-start justify-between gap-3 border-b border-neutral-800 px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold text-neutral-100">{provider.label}</div>
          <div className="mt-0.5 font-mono text-xs text-neutral-500">{provider.name}</div>
          <p className="mt-2 text-xs text-neutral-400">{provider.description}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded px-2 py-0.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
        >
          ✕
        </button>
      </div>

      <form action={updateProvider} className="flex flex-1 flex-col">
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <input type="hidden" name="name" value={provider.name} />

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={provider.enabled}
              className="mt-1 h-4 w-4 accent-emerald-500"
            />
            <span>
              <span className="block text-sm font-medium text-neutral-200">
                Enabled
              </span>
              <span className="block text-xs text-neutral-500">
                When off, this provider's /auth/v1/* endpoints return 403.
              </span>
            </span>
          </label>

          {provider.name === "microsoft" && (
            <div className="mt-5 space-y-4 border-t border-neutral-800 pt-5">
              <div>
                <label
                  htmlFor="ms-client-id"
                  className="block text-xs uppercase tracking-wider text-neutral-500"
                >
                  Client ID
                </label>
                <input
                  id="ms-client-id"
                  type="text"
                  name="client_id"
                  defaultValue={String(cfg.client_id ?? "")}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  className="mt-1 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 font-mono text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="ms-client-secret"
                  className="block text-xs uppercase tracking-wider text-neutral-500"
                >
                  Client Secret
                </label>
                <input
                  id="ms-client-secret"
                  type="password"
                  name="client_secret"
                  autoComplete="new-password"
                  placeholder={hasSecret ? "•••••• (saved, leave blank to keep)" : "Paste secret"}
                  className="mt-1 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 font-mono text-sm"
                />
                <p className="mt-1 text-xs text-neutral-500">
                  Stored in <span className="font-mono">auth.providers</span>.
                  Leave blank to keep the current value.
                </p>
              </div>
              <div>
                <label
                  htmlFor="ms-tenant"
                  className="block text-xs uppercase tracking-wider text-neutral-500"
                >
                  Tenant
                </label>
                <input
                  id="ms-tenant"
                  type="text"
                  name="tenant"
                  defaultValue={String(cfg.tenant ?? "common")}
                  placeholder="common / consumers / organizations / <tenant-id>"
                  className="mt-1 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 font-mono text-sm"
                />
              </div>
            </div>
          )}

          {provider.name === "email" && (
            <p className="mt-5 border-t border-neutral-800 pt-5 text-xs text-neutral-500">
              Email / password has no extra configuration — toggle it on or off
              and that's it.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-800 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded border border-neutral-700 bg-neutral-800 px-4 py-1.5 text-sm hover:bg-neutral-700"
          >
            Save
          </button>
        </div>
      </form>
    </aside>
  );
}
