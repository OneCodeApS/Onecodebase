import { pool } from "@/lib/db";
import { TablesSidebar, type TableEntry } from "./_components/TablesSidebar";

async function loadTables(): Promise<TableEntry[]> {
  const { rows } = await pool().query<TableEntry>(
    `SELECT c.relname              AS table_name,
            c.reltuples::bigint    AS approx_rows
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r'
        AND n.nspname = 'public'
      ORDER BY c.relname`,
  );
  return rows;
}

export default async function TablesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tables = await loadTables();
  return (
    <div className="flex min-h-screen">
      <TablesSidebar tables={tables} />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
