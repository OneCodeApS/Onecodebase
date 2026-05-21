"use client";

import { useActionState, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import { keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { runQuery, type QueryResult } from "../actions";
import type { UserRole } from "@/lib/session";
import { Card } from "../../_components/Card";

type Snippet = {
  label: string;
  description?: string;
  // True if this snippet is read-only safe (visible to read_only role).
  readOnly: boolean;
  sql: string;
};

type SnippetGroup = {
  heading: string;
  snippets: Snippet[];
};

// Snippets the user can click to load into the editor. Keep these short,
// runnable as-is, and useful for poking at the system.
const SNIPPETS: SnippetGroup[] = [
  {
    heading: "Schema",
    snippets: [
      {
        label: "List tables",
        description: "All base tables, excluding system schemas",
        readOnly: true,
        sql:
          "SELECT table_schema, table_name\n" +
          "FROM information_schema.tables\n" +
          "WHERE table_schema NOT IN ('pg_catalog', 'information_schema')\n" +
          "  AND table_type = 'BASE TABLE'\n" +
          "ORDER BY table_schema, table_name;",
      },
      {
        label: "Columns for a table",
        readOnly: true,
        sql:
          "SELECT column_name, data_type, is_nullable, column_default\n" +
          "FROM information_schema.columns\n" +
          "WHERE table_schema = 'public' AND table_name = 'todos'\n" +
          "ORDER BY ordinal_position;",
      },
      {
        label: "Database size",
        readOnly: true,
        sql:
          "SELECT pg_size_pretty(pg_database_size(current_database())) AS size;",
      },
      {
        label: "Largest tables",
        readOnly: true,
        sql:
          "SELECT schemaname, tablename,\n" +
          "       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size\n" +
          "FROM pg_tables\n" +
          "WHERE schemaname NOT IN ('pg_catalog','information_schema')\n" +
          "ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC\n" +
          "LIMIT 10;",
      },
    ],
  },
  {
    heading: "Sample data",
    snippets: [
      {
        label: "Show todos",
        readOnly: true,
        sql: "SELECT * FROM public.todos ORDER BY id;",
      },
      {
        label: "Insert a todo",
        readOnly: false,
        sql:
          "INSERT INTO public.todos (title)\n" +
          "VALUES ('Try the SQL editor')\n" +
          "RETURNING *;",
      },
      {
        label: "Mark all done",
        readOnly: false,
        sql: "UPDATE public.todos SET done = true RETURNING id, title, done;",
      },
      {
        label: "Delete completed",
        description: "Removes every row where done = true",
        readOnly: false,
        sql:
          "DELETE FROM public.todos\n" +
          "WHERE done = true\n" +
          "RETURNING id, title;",
      },
    ],
  },
  {
    heading: "Schema management",
    snippets: [
      {
        label: "Create a table",
        description: "Example notes table with common column types",
        readOnly: false,
        sql:
          "CREATE TABLE public.notes (\n" +
          "  id         bigserial PRIMARY KEY,\n" +
          "  title      text NOT NULL,\n" +
          "  body       text,\n" +
          "  created_at timestamptz NOT NULL DEFAULT now()\n" +
          ");",
      },
      {
        label: "Add a column",
        readOnly: false,
        sql: "ALTER TABLE public.notes ADD COLUMN tag text;",
      },
      {
        label: "Rename a column",
        readOnly: false,
        sql: "ALTER TABLE public.notes RENAME COLUMN tag TO label;",
      },
      {
        label: "Drop a table",
        description: "Permanently removes the table and all its data",
        readOnly: false,
        sql: "DROP TABLE IF EXISTS public.notes;",
      },
    ],
  },
  {
    heading: "System",
    snippets: [
      {
        label: "Postgres version",
        readOnly: true,
        sql: "SELECT version();",
      },
      {
        label: "Current user / role",
        readOnly: true,
        sql: "SELECT current_user, current_role, session_user;",
      },
      {
        label: "Active connections",
        readOnly: true,
        sql:
          "SELECT pid, usename, application_name, state, query_start\n" +
          "FROM pg_stat_activity\n" +
          "WHERE state IS NOT NULL\n" +
          "ORDER BY query_start DESC NULLS LAST;",
      },
    ],
  },
  {
    heading: "Audit",
    snippets: [
      {
        label: "Recent audit entries",
        readOnly: true,
        sql:
          "SELECT created_at, actor, role, action, target, success\n" +
          "FROM _dashboard.audit_log\n" +
          "ORDER BY id DESC\n" +
          "LIMIT 50;",
      },
      {
        label: "Audit by action type",
        readOnly: true,
        sql:
          "SELECT action, count(*) AS n\n" +
          "FROM _dashboard.audit_log\n" +
          "GROUP BY action\n" +
          "ORDER BY n DESC;",
      },
    ],
  },
];

function renderCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function Result({ result }: { result: QueryResult }) {
  if (!result.ok) {
    return (
      <div className="mt-4 rounded border border-red-900/50 bg-red-950/30 px-3 py-2">
        <div className="text-sm font-medium text-red-300">Query failed</div>
        <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs text-red-200">
          {result.error}
        </pre>
        {result.code && (
          <div className="mt-1 text-xs text-red-400">
            Postgres error code: {result.code}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400">
        <span className="rounded border border-neutral-700 px-2 py-0.5 font-mono text-neutral-200">
          {result.command ?? "OK"}
        </span>
        {result.rowCount !== null && (
          <span>
            {result.rowCount.toLocaleString()} {result.rowCount === 1 ? "row" : "rows"}
          </span>
        )}
        <span>{result.durationMs} ms</span>
        {result.truncated && (
          <span className="text-amber-400">
            Showing first {result.rows.length} rows
          </span>
        )}
      </div>

      {result.fields.length > 0 && result.rows.length > 0 ? (
        <Card className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-700 bg-neutral-800/60 text-left text-neutral-400">
                {result.fields.map((f) => (
                  <th key={f} className="px-3 py-2 font-mono font-normal text-neutral-100">
                    {f}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-neutral-800 last:border-b-0 odd:bg-neutral-900 even:bg-neutral-950/40 hover:bg-neutral-800/50"
                >
                  {result.fields.map((f) => {
                    const text = renderCell(row[f]);
                    return (
                      <td
                        key={f}
                        className="max-w-xs truncate px-3 py-2 font-mono text-neutral-300"
                        title={text}
                      >
                        {text}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <p className="mt-3 text-sm text-neutral-500">
          {result.rowCount === null
            ? "No result set."
            : `Affected ${result.rowCount} row${result.rowCount === 1 ? "" : "s"}.`}
        </p>
      )}
    </div>
  );
}

function Snippets({
  readOnly,
  onPick,
}: {
  readOnly: boolean;
  onPick: (sql: string) => void;
}) {
  return (
    <aside className="w-60 shrink-0 border-r border-neutral-800 pr-4">
      <h2 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        Snippets
      </h2>
      <div className="mt-2 space-y-4">
        {SNIPPETS.map((group) => {
          const visible = group.snippets.filter((s) => !readOnly || s.readOnly);
          if (visible.length === 0) return null;
          return (
            <div key={group.heading}>
              <div className="text-xs font-medium text-neutral-400">{group.heading}</div>
              <div className="mt-1 space-y-0.5">
                {visible.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => onPick(s.sql)}
                    title={s.description ?? s.label}
                    className="block w-full truncate rounded px-2 py-1 text-left text-sm text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export function SqlEditor({ role }: { role: UserRole }) {
  const [result, formAction, isPending] = useActionState<QueryResult | null, FormData>(
    runQuery,
    null,
  );
  const formRef = useRef<HTMLFormElement | null>(null);
  // Controlled state so React 19 doesn't reset the editor after the server
  // action completes — the user wants to see / edit / re-run their last query.
  const [sqlText, setSqlText] = useState("");

  // Ctrl/Cmd+Enter submits the form from inside CodeMirror.
  const submitKeymap = Prec.highest(
    keymap.of([
      {
        key: "Mod-Enter",
        run: () => {
          formRef.current?.requestSubmit();
          return true;
        },
      },
    ]),
  );

  const readOnly = role === "read_only";

  return (
    <div className="flex gap-4">
      <Snippets readOnly={readOnly} onPick={setSqlText} />

      <form ref={formRef} action={formAction} className="flex-1 min-w-0">
        {/* CodeMirror isn't a native form input, so we mirror its value into a
            hidden input so the server action's FormData picks it up. */}
        <input type="hidden" name="sql" value={sqlText} />
        <div className="overflow-hidden rounded border border-neutral-700">
          <CodeMirror
            value={sqlText}
            onChange={setSqlText}
            theme="dark"
            extensions={[sql({ dialect: PostgreSQL, upperCaseKeywords: true }), submitKeymap]}
            basicSetup={{
              lineNumbers: true,
              foldGutter: false,
              highlightActiveLine: true,
              highlightActiveLineGutter: true,
              autocompletion: false,
            }}
            placeholder={
              readOnly
                ? "SELECT * FROM public.todos;\n\n(Ctrl+Enter to run — read-only users can run SELECT only)"
                : "SELECT * FROM public.todos;\n\n(Ctrl+Enter to run)"
            }
            height="240px"
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="text-xs text-neutral-500">
            {readOnly
              ? "You can run SELECT / WITH / EXPLAIN / SHOW."
              : "Statements run as dashboard_admin."}
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded border border-neutral-700 bg-neutral-800 px-4 py-1.5 text-sm font-medium hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Running…" : "Run"}
          </button>
        </div>

        {result && <Result result={result} />}
      </form>
    </div>
  );
}
