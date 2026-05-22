import { redirect } from "next/navigation";

// Default tab — keeps /admin/functions/<name> a usable URL.
export default async function FunctionRoot({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  redirect(`/admin/functions/${encodeURIComponent(name)}/overview`);
}
