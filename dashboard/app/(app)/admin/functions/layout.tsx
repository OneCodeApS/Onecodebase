import { FunctionsSubSidebar } from "./_components/FunctionsSubSidebar";
import { getSession } from "@/lib/session";

export default async function FunctionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const isAdmin = session.role === "admin";

  return (
    <div className="flex min-h-screen">
      <FunctionsSubSidebar isAdmin={isAdmin} />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
