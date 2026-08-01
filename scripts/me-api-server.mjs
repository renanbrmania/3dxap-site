import http from "node:http";
import { pathToFileURL } from "node:url";
import handler from "../api/me/[[...path]].js";

const PORT = Number(process.env.ME_API_PORT || 9110);

const server = http.createServer(async (req, res) => {
  // Normalize so handler sees /api/me/...
  if (!req.url?.startsWith("/api/me")) {
    req.url = `/api/me${req.url === "/" ? "/config" : req.url}`;
  }
  await handler(req, res);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Melhor Envio API local em http://127.0.0.1:${PORT}/api/me`);
});

// allow import check
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  // running as main
}
