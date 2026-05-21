import { pool } from "@/lib/db";
import { TablesSidebar, type TableEntry } from "./_components/TablesSidebar";

// Loads tables across every non-system schema in one shot. The sidebar
// filters them client-side by the active `?schema=` param, so navigating
// between schemas doesn't refetch.
async function loadTables(): Promise<TableEntry[]> {
  const { rows } = await pool().query<TableEntry>(
    `SELECT n.nspname              AS schema,
            c.relname              AS table_name,
            c.reltuples::bigint    AS approx_rows
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r'
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND n.nspname NOT LIKE 'pg_toast%'
        AND n.nspname NOT LIKE 'pg_temp%'
      ORDER BY n.nspname, c.relname`,
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
