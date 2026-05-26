"use client";

import { useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { saveDbFunction } from "../actions";

// Mirrors the edge-function CodeEditor pattern (Ctrl/Cmd+S submits) but uses
// SQL highlighting and posts the full CREATE OR REPLACE DDL.
export function FunctionEditor({
  oid,
  initialDefinition,
}: {
  oid: string; // "new" for a fresh function
  initialDefinition: string;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [definition, setDefinition] = useState(initialDefinition);

  const saveKeymap = Prec.highest(
    keymap.of([
      {
        key: "Mod-s",
        run: () => {
          formRef.current?.requestSubmit();
          return true;
        },
      },
    ]),
  );

  return (
    <form ref={formRef} action={saveDbFunction}>
      <input type="hidden" name="oid" value={oid} />
      <input type="hidden" name="definition" value={definition} />

      <div className="overflow-hidden rounded border border-neutral-700">
        <CodeMirror
          value={definition}
          onChange={setDefinition}
          theme="dark"
          extensions={[sql(), saveKeymap]}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
            autocompletion: false,
          }}
          height="520px"
        />
      </div>

      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-neutral-500">
          Ctrl/Cmd+S to save. Must start with{" "}
          <span className="font-mono">CREATE [OR REPLACE] FUNCTION</span> or{" "}
          <span className="font-mono">PROCEDURE</span>.
        </p>
        <button
          type="submit"
          className="rounded border border-neutral-700 bg-neutral-800 px-4 py-1.5 text-sm hover:bg-neutral-700"
        >
          Save
        </button>
      </div>
    </form>
  );
}
