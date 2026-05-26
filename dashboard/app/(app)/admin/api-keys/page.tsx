import { headers } from "next/headers";
import Link from "next/link";
import { audit } from "@/lib/audit";
import { getAnonKey, getServiceRoleKey } from "@/lib/auth-jwt";
import { getSession } from "@/lib/session";
import { Card } from "../../_components/Card";
import { KeyDisplay } from "./_components/KeyDisplay";

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip");
}

export default async function ApiKeysPage() {
  const session = await getSession();
  // Middleware already gates /admin/* to admins, but the audit row stamps
  // the actor so we're explicit about who could see the service-role key.
  const [anonKey, serviceRoleKey, ip] = await Promise.all([
    getAnonKey(),
    getServiceRoleKey(),
    clientIp(),
  ]);

  await audit({
    actor: session.email!,
    actorId: session.userId,
    role: "admin",
    action: "api_keys.view",
    ip,
    sessionId: session.sessionId ?? null,
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-100">
        ← Back
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">API keys</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Long-lived JWTs derived from{" "}
        <span className="font-mono text-neutral-200">PGRST_JWT_SECRET</span>.
        Stable across restarts — same key every time, given the same secret.
        Rotating the secret invalidates these keys and every user JWT, so don&apos;t
        rotate it casually.
      </p>

      <Card padded className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-medium">Anon key</h2>
          <code className="rounded border border-neutral-700 bg-neutral-800/40 px-2 py-0.5 text-xs text-neutral-300">
            role: anon
          </code>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          Embed in client-side code (web apps, mobile apps, browser extensions).
          Treated as &quot;a known client, no specific user&quot; — equivalent to public
          access. Inside an edge function, this token appears as{" "}
          <span className="font-mono text-neutral-300">ctx.user.role === &quot;anon&quot;</span>.
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Clients send it as{" "}
          <span className="font-mono">apikey: &lt;key&gt;</span> or{" "}
          <span className="font-mono">Authorization: Bearer &lt;key&gt;</span>.
        </p>
        <KeyDisplay value={anonKey} />
      </Card>

      <Card padded className="mt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-medium text-red-300">Service role key</h2>
          <code className="rounded border border-red-900/50 bg-red-950/30 px-2 py-0.5 text-xs text-red-300">
            role: service_role
          </code>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          Server-side only. Bypasses Row Level Security at the PostgREST
          layer. Use for admin scripts and trusted backend services.{" "}
          <strong className="text-red-300">
            Treat as a secret. Do not commit, do not embed in client code, do
            not paste in chat.
          </strong>{" "}
          If leaked, rotate{" "}
          <span className="font-mono text-neutral-300">PGRST_JWT_SECRET</span>{" "}
          (which also invalidates all user sessions — plan ahead).
        </p>
        <KeyDisplay value={serviceRoleKey} sensitive />
      </Card>

      <Card padded className="mt-4">
        <h2 className="text-lg font-medium">Endpoints</h2>
        <p className="mt-1 text-sm text-neutral-500">
          All public APIs live under{" "}
          <span className="font-mono text-neutral-300">api.&lt;your-host&gt;</span>.
          The dashboard host serves only the operator UI.
        </p>
        <table className="mt-3 w-full text-left text-xs">
          <thead className="text-neutral-500">
            <tr>
              <th className="py-1 pr-4 font-normal">Surface</th>
              <th className="py-1 font-normal">Path</th>
            </tr>
          </thead>
          <tbody className="font-mono text-neutral-300">
            <tr>
              <td className="py-1 pr-4 text-neutral-400">Tables (PostgREST)</td>
              <td className="py-1">/rest/v1/&lt;table&gt;</td>
            </tr>
            <tr>
              <td className="py-1 pr-4 text-neutral-400">DB functions (RPC)</td>
              <td className="py-1">/rpc/v1/&lt;fn&gt;</td>
            </tr>
            <tr>
              <td className="py-1 pr-4 text-neutral-400">End-user auth</td>
              <td className="py-1">/auth/v1/&lt;signin|signup|refresh|signout|user&gt;</td>
            </tr>
            <tr>
              <td className="py-1 pr-4 text-neutral-400">Realtime</td>
              <td className="py-1">/realtime?schema=&lt;s&gt;&amp;table=&lt;t&gt;</td>
            </tr>
            <tr>
              <td className="py-1 pr-4 text-neutral-400">Edge functions</td>
              <td className="py-1">/functions/v1/&lt;name&gt;</td>
            </tr>
            <tr>
              <td className="py-1 pr-4 text-neutral-400">Storage (issue URL)</td>
              <td className="py-1">/storage/v1/object/&lt;sign|sign-batch|upload&gt;/…</td>
            </tr>
            <tr>
              <td className="py-1 pr-4 text-neutral-400">Storage (data)</td>
              <td className="py-1">/storage/v1/object/&lt;bucket&gt;/&lt;key&gt;?…</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs text-neutral-500">
          Storage clients POST to{" "}
          <span className="font-mono text-neutral-300">/storage/v1/object/sign/…</span>{" "}
          (or <span className="font-mono text-neutral-300">/upload/…</span>) to
          get a short-lived SigV4-signed URL, then GET/PUT that URL directly.
          The data path strips the prefix in Caddy and goes straight to MinIO —
          Node is never in the byte stream, so video/large-file traffic scales
          with MinIO bandwidth.
        </p>
      </Card>

      <Card padded className="mt-4">
        <h2 className="text-lg font-medium">Quick reference</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Calling an edge function with the anon key:
        </p>
        <pre className="mt-2 overflow-x-auto rounded border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-xs text-neutral-300">{`curl -H "apikey: <anon-key>" \\
     https://api.example.com/functions/v1/<name>`}</pre>
        <p className="mt-3 text-sm text-neutral-500">
          Calling as a signed-in end user (their JWT, not the anon key):
        </p>
        <pre className="mt-2 overflow-x-auto rounded border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-xs text-neutral-300">{`curl -H "Authorization: Bearer <user-jwt>" \\
     https://api.example.com/functions/v1/<name>`}</pre>
        <p className="mt-3 text-sm text-neutral-500">
          Inside the function, branch on{" "}
          <span className="font-mono text-neutral-300">ctx.user.role</span>{" "}
          to enforce auth as needed:
        </p>
        <pre className="mt-2 overflow-x-auto rounded border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-xs text-neutral-300">{`if (ctx.user?.role === "anon") {
  return new Response("auth required", { status: 401 });
}
if (ctx.user?.role === "authenticated") {
  // ctx.user.id is the auth.users id
}`}</pre>
      </Card>
    </main>
  );
}
