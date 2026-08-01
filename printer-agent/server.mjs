import http from "node:http";
import { discoverElginPrinter, sendZpl, PRINTER } from "./discover.mjs";

const PORT = Number(process.env.PRINTER_AGENT_PORT || 9109);

function sendJson(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  try {
    if (req.method === "GET" && (req.url === "/" || req.url?.startsWith("/health"))) {
      sendJson(res, 200, {
        ok: true,
        service: "3dxap-printer-agent",
        expectedModel: "Elgin L42 PRO FULL",
        expectedMac: PRINTER.mac,
        printPort: PRINTER.port,
      });
      return;
    }

    if (req.method === "GET" && req.url?.startsWith("/discover")) {
      const printer = await discoverElginPrinter();
      sendJson(res, 200, { ok: true, printer });
      return;
    }

    if (req.method === "POST" && req.url?.startsWith("/print")) {
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

    sendJson(res, 404, { ok: false, error: "Use GET /discover ou POST /print" });
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
  console.log("GET  /discover  -> acha a Elgin na rede (DHCP)");
  console.log("POST /print     -> descobre e envia ZPL");
});
