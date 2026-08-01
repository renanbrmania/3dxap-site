import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverElginPrinter, sendZpl, PRINTER } from "./discover.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PRINTER_AGENT_PORT || 9109);

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    // Chrome/Edge: site HTTPS (3dxap) → agent em 127.0.0.1
    "Access-Control-Allow-Private-Network": "true",
  };
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders(),
  });
  res.end(payload);
}

function sendHtml(res, status, html) {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    ...corsHeaders(),
  });
  res.end(html);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);

  // Preflight CORS + Private Network Access
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      ...corsHeaders(),
      "Access-Control-Max-Age": "86400",
    });
    res.end();
    return;
  }

  try {
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      sendJson(res, 200, {
        ok: true,
        service: "3dxap-printer-agent",
        expectedModel: "Elgin L42 PRO FULL",
        expectedMac: PRINTER.mac,
        printPort: PRINTER.port,
        bridge: "/bridge",
      });
      return;
    }

    if (req.method === "GET" && (url.pathname === "/bridge" || url.pathname === "/bridge.html")) {
      const html = fs.readFileSync(path.join(__dirname, "bridge.html"), "utf8");
      sendHtml(res, 200, html);
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/discover")) {
      const printer = await discoverElginPrinter();
      sendJson(res, 200, { ok: true, printer });
      return;
    }

    if (req.method === "POST" && url.pathname.startsWith("/print")) {
      const raw = await readBody(req);
      let zpl = raw;
      const contentType = req.headers["content-type"] || "";
      if (contentType.includes("application/json")) {
        const parsed = JSON.parse(raw || "{}");
        zpl = parsed.zpl || parsed.data || "";
      }
      if (!String(zpl).trim()) {
        sendJson(res, 400, { ok: false, error: "Envie o ZPL no body (texto ou JSON { zpl })." });
        return;
      }
      const printer = await sendZpl(String(zpl));
      sendJson(res, 200, { ok: true, printedOn: printer });
      return;
    }

    sendJson(res, 404, { ok: false, error: "Use GET /health, GET /bridge ou POST /print" });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.log(`Porta ${PORT} ja em uso — agent provavelmente ja esta rodando.`);
    console.log(`Teste: http://127.0.0.1:${PORT}/health`);
    process.exit(0);
  }
  console.error(err);
  process.exit(1);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`3dxap-printer-agent em http://127.0.0.1:${PORT}`);
  console.log("GET  /bridge   -> ponte Safari/Chrome (postMessage)");
  console.log("GET  /discover -> acha a Elgin na rede (DHCP)");
  console.log("POST /print    -> descobre e envia ZPL");
});
