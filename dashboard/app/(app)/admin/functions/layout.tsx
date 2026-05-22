import { FunctionsSubSidebar } from "./_components/FunctionsSubSidebar";

export default function FunctionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <FunctionsSubSidebar />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
