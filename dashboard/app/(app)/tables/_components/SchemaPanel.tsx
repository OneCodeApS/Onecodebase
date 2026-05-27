import { quoteIdent } from "@/lib/db-introspect";
import { Card } from "../../_components/Card";
import { CopyableSql } from "./CopyableSql";

export type SchemaColumn = {
  name: string;
  type: string;
  not_null: boolean;
  default_expr: string | null;
  is_primary_key: boolean;
};

export type SchemaIndex = {
  name: string;
  definition: string;
  is_unique: boolean;
  is_primary: boolean;
};

export type SchemaConstraint = {
  name: string;
  type: string;
  definition: string;
};

// Reconstruct a CREATE TABLE statement for the columns. Identifiers go through
// quoteIdent (the codebase rule for any catalog name reused in generated SQL);
// types and default expressions come straight from pg_catalog and are already
// valid SQL. The primary key is emitted as a table constraint since we have it
// per-column anyway.
function buildColumnsDdl(schema: string, table: string, columns: SchemaColumn[]): string {
  const pad = Math.max(0, ...columns.map((c) => quoteIdent(c.name).length));
  const lines = columns.map((c) => {
    let line = `    ${quoteIdent(c.name).padEnd(pad)} ${c.type}`;
    if (c.not_null) line += " NOT NULL";
    if (c.default_expr) line += ` DEFAULT ${c.default_expr}`;
    return line;
  });

  const pk = columns.filter((c) => c.is_primary_key).map((c) => quoteIdent(c.name));
  if (pk.length > 0) lines.push(`    PRIMARY KEY (${pk.join(", ")})`);

  return `CREATE TABLE ${quoteIdent(schema)}.${quoteIdent(table)} (\n${lines.join(",\n")}\n);`;
}

function Badge({ tone, children }: { tone: "amber" | "sky" | "neutral"; children: React.ReactNode }) {
  const tones = {
    amber: "bg-amber-900/40 text-amber-300",
    sky: "bg-sky-900/40 text-sky-300",
    neutral: "bg-neutral-800 text-neutral-400",
  } as const;
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

function HeadRow({ cells }: { cells: string[] }) {
  return (
    <thead>
      <tr className="border-b border-neutral-700 bg-neutral-800/60 text-left text-neutral-400">
        {cells.map((c) => (
          <th key={c} className="px-3 py-2 font-normal">
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function Empty({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-6 text-center text-neutral-500">
        {label}
      </td>
    </tr>
  );
}

const ROW = "border-b border-neutral-800 last:border-b-0 odd:bg-neutral-900 even:bg-neutral-950/40";

function SubSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-400">
        {title} <span className="ml-1 text-neutral-600">{count}</span>
      </h2>
      <Card className="mt-2 overflow-x-auto">{children}</Card>
    </div>
  );
}

function IndexesTable({ indexes }: { indexes: SchemaIndex[] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <HeadRow cells={["Index", "Definition"]} />
      <tbody>
        {indexes.length === 0 ? (
          <Empty colSpan={2} label="No indexes." />
        ) : (
          indexes.map((ix) => (
            <tr key={ix.name} className={ROW}>
              <td className="px-3 py-2 align-top">
                <div className="font-mono text-neutral-200">{ix.name}</div>
                <div className="mt-1 flex gap-1">
                  {ix.is_primary && <Badge tone="amber">primary</Badge>}
                  {ix.is_unique && !ix.is_primary && <Badge tone="sky">unique</Badge>}
                </div>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-neutral-400 break-all">{ix.definition}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function ConstraintsTable({ constraints }: { constraints: SchemaConstraint[] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <HeadRow cells={["Constraint", "Type", "Definition"]} />
      <tbody>
        {constraints.length === 0 ? (
          <Empty colSpan={3} label="No constraints." />
        ) : (
          constraints.map((con) => (
            <tr key={con.name} className={ROW}>
              <td className="px-3 py-2 align-top font-mono text-neutral-200">{con.name}</td>
              <td className="px-3 py-2 align-top">
                <Badge tone="neutral">{con.type}</Badge>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-neutral-400 break-all">{con.definition}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

// Server-rendered schema view shown when the table page's `?view=schema` tab is
// active. Columns are rendered as copyable CREATE TABLE SQL; indexes and
// constraints as listings.
export function SchemaPanel({
  schema,
  name,
  columns,
  indexes,
  constraints,
}: {
  schema: string;
  name: string;
  columns: SchemaColumn[];
  indexes: SchemaIndex[];
  constraints: SchemaConstraint[];
}) {
  return (
    <div className="mt-6 flex flex-col gap-8">
      <SubSection title="Columns" count={columns.length}>
        <CopyableSql sql={buildColumnsDdl(schema, name, columns)} />
      </SubSection>
      <SubSection title="Indexes" count={indexes.length}>
        <IndexesTable indexes={indexes} />
      </SubSection>
      <SubSection title="Constraints" count={constraints.length}>
        <ConstraintsTable constraints={constraints} />
      </SubSection>
    </div>
  );
}
