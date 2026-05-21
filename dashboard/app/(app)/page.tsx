import { getSession } from "@/lib/session";

export default async function Home() {
  const session = await getSession();
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Welcome</h1>
      <p className="mt-2 text-neutral-400">
        Signed in as <span className="font-mono text-neutral-100">{session.email}</span>.
      </p>
      <p className="mt-6 text-sm text-neutral-500">
        Use the sidebar to browse tables, manage users, or open settings.
      </p>
    </main>
  );
}
