import { LoaderBlock } from "../../_components/Loader";

// Rendered by Next.js as a Suspense fallback while the server component
// re-runs — covers initial navigation, pagination, schema switches, and
// router.refresh() from <RefreshButton />.
export default function Loading() {
  return (
    <main className="px-6 py-10">
      <LoaderBlock label="Loading table…" />
    </main>
  );
}
