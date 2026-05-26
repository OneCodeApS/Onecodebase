import { getSession } from "@/lib/session";
import { Sidebar } from "./_components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Middleware already redirects unauthenticated users to /login, so a session
  // is guaranteed here. Fallback values keep TypeScript happy.
  const session = await getSession();
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        email={session.email ?? ""}
        role={session.role ?? "read_only"}
      />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
