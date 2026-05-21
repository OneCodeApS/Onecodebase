import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  experimental: {
    // Server actions are first-party in Next 15; we only call them same-origin
    // via Caddy, so the host header will match.
    serverActions: {
      // Hard ceiling on form submissions; the storage upload action enforces
      // its own per-bucket cap on top of this. Numbers like "100mb" use Next's
      // bytes-style parser. Bump if you need larger uploads.
      bodySizeLimit: "100mb",
    },
  },
};

export default config;
