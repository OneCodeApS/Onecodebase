import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  experimental: {
    // Server actions are first-party in Next 15; we only call them same-origin
    // via Caddy, so the host header will match.
  },
};

export default config;
