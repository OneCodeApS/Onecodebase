import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { login } from "./actions";

type SearchParams = Promise<{ next?: string; error?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (session.adminId) {
    redirect("/");
  }

  const { next, error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-neutral-400">Admin dashboard</p>

      <form action={login} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={next ?? "/"} />

        <label className="block">
          <span className="text-sm text-neutral-300">Email</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="username"
            className="mt-1 w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-400"
          />
        </label>

        <label className="block">
          <span className="text-sm text-neutral-300">Password</span>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-400"
          />
        </label>

        {error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : null}

        <button
          type="submit"
          className="w-full rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-white"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
