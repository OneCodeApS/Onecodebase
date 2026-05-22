// Next.js runs this once when the server starts (Node runtime only).
// Used to boot the in-process cron scheduler so admin-defined jobs fire
// without needing the dashboard UI to be accessed first.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Dynamic import keeps node-only modules out of the Edge bundle.
  const { initCron } = await import("./lib/cron");
  await initCron();
}
