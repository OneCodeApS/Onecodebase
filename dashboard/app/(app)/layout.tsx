import { getSession } from "@/lib/session";
import { Sidebar } from "./_components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Middleware already redirects unauthenticated users to /login, so a session
  // is guaranteed here. Fallback values keep TypeScript happy.
  const session = await getSession();
  return (
    <div className="flex min-h-screen">
      <Sidebar
        email={session.email ?? ""}
        role={session.role ?? "read_only"}
      />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
