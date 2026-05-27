import { Card } from "../../_components/Card";
import { getComponentVersions, type ComponentVersion } from "@/lib/versions";

// Versions are read live from the running services, so never cache this page.
export const dynamic = "force-dynamic";

function VersionRow({ c }: { c: ComponentVersion }) {
  return (
    <div className="border-t border-neutral-800 py-3 first:border-t-0">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium text-neutral-200">{c.name}</span>
        {c.version ? (
          <span className="shrink-0 font-mono text-sm text-neutral-100">{c.version}</span>
        ) : (
          <span className="shrink-0 text-sm text-neutral-500">unavailable</span>
        )}
      </div>
      <div className="mt-0.5 text-xs text-neutral-500">{c.source}</div>
      {c.detail && (
        <div className="mt-1 break-words font-mono text-[11px] text-neutral-600">{c.detail}</div>
      )}
    </div>
  );
}

export default async function SystemPage() {
  const components = await getComponentVersions();
  const application = components.filter((c) => c.category === "Application");
  const infrastructure = components.filter((c) => c.category === "Infrastructure");

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mt-4 text-2xl font-semibold">Component versions</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Read live from the running services at page load — this reflects what is
        actually deployed, not the image tags pinned in{" "}
        <span className="font-mono text-neutral-300">docker-compose.yml</span>.
        Detection is best-effort; components that don&apos;t expose their version
        at runtime show <span className="text-neutral-400">unavailable</span>.
      </p>

      <Card padded className="mt-6">
        <h2 className="text-lg font-medium">Application</h2>
        <p className="mt-1 text-xs text-neutral-500">The dashboard process and its runtime.</p>
        <div className="mt-3">
          {application.map((c) => (
            <VersionRow key={c.name} c={c} />
          ))}
        </div>
      </Card>

      <Card padded className="mt-6">
        <h2 className="text-lg font-medium">Infrastructure</h2>
        <p className="mt-1 text-xs text-neutral-500">Backing services in the stack.</p>
        <div className="mt-3">
          {infrastructure.map((c) => (
            <VersionRow key={c.name} c={c} />
          ))}
        </div>
      </Card>
    </main>
  );
}
