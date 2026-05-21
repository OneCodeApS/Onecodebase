export default function StorageIndex({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main className="px-6 py-16 text-center">
      <h1 className="text-xl font-semibold">No bucket selected</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Pick a bucket from the sidebar, or create one if you're an admin.
      </p>
      <ErrorBanner searchParams={searchParams} />
    </main>
  );
}

async function ErrorBanner({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  if (!sp.error) return null;
  return (
    <p className="mx-auto mt-4 max-w-lg rounded border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
      {sp.error}
    </p>
  );
}
