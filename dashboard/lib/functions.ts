import { pool } from "./db";
import { getEnvForFunction } from "./function-env";
import { audit } from "./audit";

export type EdgeFunction = {
  name: string;
  description: string | null;
  enabled: boolean;
  code: string;
  env: Record<string, string>;
  timeout_ms: number;
  created_at: Date;
  updated_at: Date;
};

export const FUNCTION_NAME = /^[a-z][a-z0-9_-]{0,62}$/;

export async function listFunctions(): Promise<EdgeFunction[]> {
  const { rows } = await pool().query<EdgeFunction>(
    `SELECT name, description, enabled, code, env, timeout_ms,
            created_at, updated_at
       FROM _dashboard.functions
       ORDER BY name`,
  );
  return rows;
}

export async function getFunction(name: string): Promise<EdgeFunction | null> {
  const { rows } = await pool().query<EdgeFunction>(
    `SELECT name, description, enabled, code, env, timeout_ms,
            created_at, updated_at
       FROM _dashboard.functions WHERE name = $1`,
    [name],
  );
  return rows[0] ?? null;
}

export async function createFunction(input: {
  name: string;
  description?: string | null;
  code?: string;
  updatedBy?: string | null;
}): Promise<void> {
  if (!FUNCTION_NAME.test(input.name)) {
    throw new Error("Invalid function name");
  }
  await pool().query(
    `INSERT INTO _dashboard.functions (name, description, code, updated_by)
     VALUES ($1, $2, $3, $4)`,
    [
      input.name,
      input.description ?? null,
      input.code ?? defaultStarterCode(input.name),
      input.updatedBy ?? null,
    ],
  );
}

export async function updateFunction(
  name: string,
  patch: {
    description?: string | null;
    enabled?: boolean;
    code?: string;
    env?: Record<string, string>;
    timeout_ms?: number;
  },
  updatedBy: string | null,
): Promise<void> {
  await pool().query(
    `UPDATE _dashboard.functions
        SET description = COALESCE($2, description),
            enabled     = COALESCE($3, enabled),
            code        = COALESCE($4, code),
            env         = COALESCE($5::jsonb, env),
            timeout_ms  = COALESCE($6, timeout_ms),
            updated_by  = $7,
            updated_at  = now()
      WHERE name = $1`,
    [
      name,
      patch.description ?? null,
      patch.enabled ?? null,
      patch.code ?? null,
      patch.env ? JSON.stringify(patch.env) : null,
      patch.timeout_ms ?? null,
      updatedBy,
    ],
  );
}

export async function deleteFunction(name: string): Promise<void> {
  await pool().query(`DELETE FROM _dashboard.functions WHERE name = $1`, [name]);
}

function defaultStarterCode(name: string): string {
  return `// ${name} — edge function
// Available in scope:
//   req           — Web Request (await req.json(), req.headers, …)
//   ctx.env       — environment variables. Manage them under
//                   Edge functions → Environment variables.
//                   Use in code as ctx.env.MY_KEY.
//   ctx.db.query  — Postgres query, runs as dashboard_admin.
//                   Example: await ctx.db.query("SELECT 1")
//   fetch, Response, URL, Headers, crypto — Web standards.
// Return a Response or any JSON-serializable value.

const body = req.method === "POST" ? await req.json().catch(() => null) : null;

// Example: read an env var (replace TEST with whatever you defined).
const test = ctx.env.TEST ?? null;

return Response.json({
  ok: true,
  method: req.method,
  body,
  test,
  now: new Date().toISOString(),
});
`;
}

// Compile-checks user code with the same AsyncFunction step the executor
// uses, without running it. Returns null if valid, or a one-line message
// describing the SyntaxError.
const AsyncFunctionCtor = Object.getPrototypeOf(async function () {})
  .constructor as new (...args: string[]) => unknown;

export function validateFunctionCode(code: string): string | null {
  try {
    new AsyncFunctionCtor("req", "ctx", code);
    return null;
  } catch (e) {
    return ((e as Error).message || "Invalid code").split("\n")[0];
  }
}

// Writes one audit row per invocation. Shared by the HTTP route and the cron
// runner so cron-driven invocations also show up on the invocations page.
//
// trigger.kind is the only required discriminator; cron carries the job name
// as `trigger.job` so the invocations page can show "cron: <job>".
export type InvocationTrigger =
  | { kind: "http" }
  | { kind: "cron"; job: string };

export async function auditInvocation(
  fn: EdgeFunction,
  method: string,
  result: ExecResult,
  trigger: InvocationTrigger,
  ip: string | null,
): Promise<void> {
  await audit({
    actor: trigger.kind === "cron" ? `<cron:${trigger.job}>` : "<edge-function-caller>",
    actorId: null,
    role: null,
    action: "function.invoke",
    target: fn.name,
    success: result.ok,
    ip,
    metadata: {
      method,
      trigger: trigger.kind,
      ...(trigger.kind === "cron" ? { cron_job: trigger.job } : {}),
      duration_ms: result.durationMs,
      ...(result.ok
        ? { status: result.response.status }
        : { error: result.error.split("\n")[0] }),
    },
  });
}

// Executes the function. NOT a security boundary — admins are trusted.
// Returns whatever the function returns (Response or anything JSON-able).
export type ExecResult =
  | { ok: true; response: Response; durationMs: number }
  | { ok: false; error: string; durationMs: number };

export async function executeFunction(
  fn: EdgeFunction,
  req: Request,
): Promise<ExecResult> {
  const started = Date.now();
  try {
    // Build an AsyncFunction from the user's code. This is full-Node trust;
    // any escape from a user-written function = full process access. Hence
    // the "admin only" constraint on who can create/edit functions.
    const compiled = new (AsyncFunctionCtor as new (
      ...args: string[]
    ) => (req: Request, ctx: unknown) => Promise<unknown>)(
      "req",
      "ctx",
      fn.code,
    );

    // Merge global function_env vars with per-function overrides. Globals
    // come from _dashboard.function_env, per-function lives on the function
    // row, per-function wins on key collision.
    const env = await getEnvForFunction(fn.env ?? {});

    const ctx = {
      env,
      db: {
        query: (sql: string, params?: unknown[]) =>
          pool().query(sql, params as unknown[] | undefined),
      },
    };

    const raceResult = await Promise.race([
      compiled(req, ctx),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Function timed out after ${fn.timeout_ms}ms`)),
          fn.timeout_ms,
        ),
      ),
    ]);

    const response =
      raceResult instanceof Response
        ? raceResult
        : Response.json(raceResult ?? null);
    return { ok: true, response, durationMs: Date.now() - started };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error).stack ?? (e as Error).message ?? "Unknown error",
      durationMs: Date.now() - started,
    };
  }
}
