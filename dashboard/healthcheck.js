// Container HEALTHCHECK — exits 0 if /login responds with a 2xx/3xx, 1 otherwise.
// No deps; uses only node:http so it works inside the standalone image.
const http = require("node:http");

const req = http.request(
  {
    host: "127.0.0.1",
    port: Number(process.env.PORT) || 3000,
    path: "/login",
    method: "GET",
    timeout: 2000,
  },
  (res) => {
    process.exit(res.statusCode >= 200 && res.statusCode < 400 ? 0 : 1);
  },
);

req.on("error", () => process.exit(1));
req.on("timeout", () => {
  req.destroy();
  process.exit(1);
});

req.end();
