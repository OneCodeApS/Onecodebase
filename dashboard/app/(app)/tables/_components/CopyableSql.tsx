"use client";

import { useState } from "react";

const KEYWORDS = new Set([
  "create", "table", "not", "null", "default", "primary", "key", "unique",
  "references", "foreign", "constraint", "check", "on", "delete", "update",
  "cascade", "and", "true", "false",
]);

const TYPES = new Set([
  "uuid", "text", "boolean", "bool", "smallint", "integer", "int", "int2",
  "int4", "int8", "bigint", "serial", "bigserial", "smallserial", "numeric",
  "decimal", "real", "double", "precision", "money", "character", "char",
  "varchar", "varying", "bpchar", "bytea", "json", "jsonb", "xml", "date",
  "time", "timetz", "timestamp", "timestamptz", "interval", "with", "without",
  "zone", "inet", "cidr", "macaddr", "bit",
]);

// Quoted identifiers, string/number literals, words, whitespace, or any single
// other char. The trailing alternatives guarantee every character is consumed,
// so the scan always terminates.
const TOKEN = /("(?:[^"]|"")*")|('(?:[^']|'')*')|(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|([^\s])/g;

// Minimal SQL highlighter — enough color to read a CREATE TABLE at a glance,
// without pulling in a full tokenizer/grammar.
function highlightSql(sql: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let m: RegExpExecArray | null;
  let i = 0;
  TOKEN.lastIndex = 0;

  while ((m = TOKEN.exec(sql)) !== null) {
    const [tok, qIdent, str, num, word, ws] = m;
    let cls = "";

    if (qIdent) {
      cls = "text-neutral-100";
    } else if (str || num) {
      cls = "text-amber-300";
    } else if (word) {
      const lower = word.toLowerCase();
      if (sql[m.index + tok.length] === "(") cls = "text-emerald-300"; // function call
      else if (KEYWORDS.has(lower)) cls = "text-violet-300";
      else if (TYPES.has(lower)) cls = "text-sky-300";
    }

    if (ws || !cls) {
      out.push(tok);
    } else {
      out.push(
        <span key={i} className={cls}>
          {tok}
        </span>,
      );
    }
    i++;
  }

  return out;
}

// A read-only SQL block with syntax highlighting and a copy-to-clipboard button
// pinned top-right.
export function CopyableSql({ sql }: { sql: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API needs a secure context (https / localhost); if it's
      // unavailable we just leave the button untouched rather than error.
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={copy}
        aria-label="Copy SQL to clipboard"
        className="absolute right-2 top-2 rounded border border-neutral-700 bg-neutral-900/80 px-2 py-1 text-xs text-neutral-300 backdrop-blur hover:bg-neutral-800"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="overflow-x-auto p-4 pr-20 text-xs leading-relaxed text-neutral-200">
        <code className="font-mono">{highlightSql(sql)}</code>
      </pre>
    </div>
  );
}
