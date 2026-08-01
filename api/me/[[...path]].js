import {
  exchangeToken,
  getBearer,
  meConfig,
  meFetch,
  ME_SCOPES,
  readJsonBody,
  sendJson,
} from "../_lib/me.js";
import { jpegToElginZpl, zplLooksLikeUnsupportedZ64 } from "../_lib/jpegToZpl.js";

/**
 * ME devolve URL S3 ou ZPL cru. Resolve sempre para texto ZPL no servidor
 * (fetch do browser na URL S3 falha com CORS / "Load failed" no Safari).
 */
async function resolveZplContent(payload) {
  if (typeof payload === "string") {
    const text = payload.trim();
    if (text.startsWith("^XA") || text.includes("^XA")) return text;
    if (/^https?:\/\//i.test(text)) {
      const res = await fetch(text);
      const body = await res.text();
      if (!res.ok) {
        throw new Error(`Falha ao baixar ZPL (${res.status}): ${body.slice(0, 200)}`);
      }
      return body;
    }
    // JSON stringificado com URL
    try {
      const parsed = JSON.parse(text);
      return resolveZplContent(parsed);
    } catch {
      return text;
    }
  }
  if (payload && typeof payload === "object") {
    if (typeof payload.url === "string") return resolveZplContent(payload.url);
    for (const v of Object.values(payload)) {
      if (typeof v === "string" && (/^https?:\/\//i.test(v) || v.includes("^XA"))) {
        return resolveZplContent(v);
      }
    }
  }
  throw new Error("Resposta ZPL do Melhor Envio em formato inesperado.");
}

/** Baixa JPEG (bytes) a partir da resposta ME (URL, JSON, Buffer ou binario). */
async function resolveJpegBuffer(payload) {
  if (Buffer.isBuffer(payload)) return payload;
  if (payload instanceof Uint8Array) return Buffer.from(payload);
  if (payload && typeof payload === "object" && payload.type === "Buffer" && Array.isArray(payload.data)) {
    return Buffer.from(payload.data);
  }
  if (typeof payload === "string") {
    const text = payload.trim();
    if (/^https?:\/\//i.test(text)) {
      const res = await fetch(text);
      if (!res.ok) throw new Error(`Falha ao baixar JPEG (${res.status})`);
      return Buffer.from(await res.arrayBuffer());
    }
    try {
      const parsed = JSON.parse(text);
      return resolveJpegBuffer(parsed);
    } catch {
      // base64 puro?
      if (/^[A-Za-z0-9+/=\s]+$/.test(text) && text.length > 200) {
        return Buffer.from(text.replace(/\s/g, ""), "base64");
      }
    }
  }
  if (payload && typeof payload === "object") {
    if (typeof payload.url === "string") return resolveJpegBuffer(payload.url);
    if (typeof payload.jpeg === "string") return resolveJpegBuffer(payload.jpeg);
    for (const v of Object.values(payload)) {
      if (typeof v === "string" && /^https?:\/\//i.test(v)) return resolveJpegBuffer(v);
    }
  }
  throw new Error("Resposta JPEG do Melhor Envio em formato inesperado.");
}

async function fetchElginCompatibleZpl(token, id) {
  // Preferir JPEG → ZPL ASCII (Elgin nao imprime Z64 do ME)
  try {
    const jpegPayload = await meFetch(`/api/v2/me/imprimir/jpeg/${id}`, { token });
    const buf = await resolveJpegBuffer(jpegPayload);
    return jpegToElginZpl(buf);
  } catch (jpegErr) {
    const file = await meFetch(`/api/v2/me/imprimir/zpl/${id}`, { token });
    const raw = await resolveZplContent(file);
    const zpl = extractShippingLabelZpl(raw);
    if (zplLooksLikeUnsupportedZ64(zpl)) {
      throw new Error(
        `Etiqueta Z64 nao suportada pela Elgin e JPEG falhou: ${jpegErr instanceof Error ? jpegErr.message : jpegErr}`,
      );
    }
    return zpl;
  }
}

const EXTRA_DOC_RE =
  /declara[cç][aã]o\s+de\s+conte[uú]do|\bdace\b|\bdce\b|aviso\s+de\s+recebimento|\bcanhoto\b|lista\s+de\s+postagem|documento\s+auxiliar/i;

/** Só a etiqueta de frete (como desmarcar declaração/recibo no PDF do ME). */
function extractShippingLabelZpl(zpl) {
  const text = String(zpl || "").replace(/^\uFEFF/, "").trim();
  if (!text) return text;
  const parts = [];
  const re = /\^XA[\s\S]*?\^XZ/gi;
  let match;
  while ((match = re.exec(text)) !== null) {
    const block = match[0].trim();
    if (block) parts.push(block);
  }
  if (!parts.length) return text;
  if (parts.length === 1) return parts[0];

  const usable = parts.filter((l) => !EXTRA_DOC_RE.test(l));
  const pool = usable.length ? usable : parts;
  pool.sort((a, b) => {
    const score = (l) => {
      let s = 0;
      if (/jadlog|correios|melhor\s*envio|\bORD-|\bPAK\b/i.test(l)) s += 3;
      if (/\^BC|\^BY|\^BQ/i.test(l)) s += 2;
      if (EXTRA_DOC_RE.test(l)) s -= 10;
      return s;
    };
    return score(b) - score(a);
  });
  return pool[0];
}

/**
 * Unified Melhor Envio API handler for Vercel and local server.
 * Routes:
 *  GET  /api/me/config
 *  GET  /api/me/authorize-url
 *  POST /api/me/token
 *  POST /api/me/calculate
 *  POST /api/me/cart
 *  POST /api/me/checkout
 *  POST /api/me/generate
 *  GET  /api/me/print-zpl?id=
 *  POST /api/me/print-pdf
 */
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const path = url.pathname.replace(/^\/api\/me/, "") || "/";

    if (req.method === "GET" && (path === "/" || path === "/config")) {
      const { clientId, redirectUri, baseUrl } = meConfig();
      sendJson(res, 200, {
        ok: true,
        configured: Boolean(clientId && process.env.ME_CLIENT_SECRET),
        clientIdConfigured: Boolean(clientId),
        redirectUri,
        baseUrl,
        env: (process.env.ME_ENV || "sandbox").toLowerCase(),
      });
      return;
    }

    if (req.method === "GET" && path === "/authorize-url") {
      const { clientId, redirectUri, baseUrl } = meConfig();
      if (!clientId) {
        sendJson(res, 400, {
          ok: false,
          error: "ME_CLIENT_ID / VITE_ME_CLIENT_ID não configurado.",
        });
        return;
      }
      const state = url.searchParams.get("state") || "3dxap";
      const auth = new URL(`${baseUrl}/oauth/authorize`);
      auth.searchParams.set("client_id", clientId);
      auth.searchParams.set("redirect_uri", redirectUri);
      auth.searchParams.set("response_type", "code");
      auth.searchParams.set("state", state);
      auth.searchParams.set("scope", ME_SCOPES);
      sendJson(res, 200, { ok: true, url: auth.toString() });
      return;
    }

    if (req.method === "POST" && (path === "/token" || path === "/oauth/token" || path === "/oauth-token")) {
      const body = await readJsonBody(req);
      if (body.refresh_token) {
        const tokens = await exchangeToken({
          grantType: "refresh_token",
          refreshToken: body.refresh_token,
        });
        sendJson(res, 200, { ok: true, tokens });
        return;
      }
      if (!body.code) {
        sendJson(res, 400, { ok: false, error: "Informe code ou refresh_token." });
        return;
      }
      const tokens = await exchangeToken({
        grantType: "authorization_code",
        code: body.code,
      });
      sendJson(res, 200, { ok: true, tokens });
      return;
    }

    const token = getBearer(req);
    if (!token) {
      sendJson(res, 401, { ok: false, error: "Token Melhor Envio ausente. Conecte a conta." });
      return;
    }

    if (req.method === "POST" && path === "/calculate") {
      const body = await readJsonBody(req);
      const data = await meFetch("/api/v2/me/shipment/calculate", {
        token,
        method: "POST",
        body,
      });
      sendJson(res, 200, { ok: true, data });
      return;
    }

    if (req.method === "POST" && path === "/cart") {
      const body = await readJsonBody(req);
      const data = await meFetch("/api/v2/me/cart", {
        token,
        method: "POST",
        body,
      });
      sendJson(res, 200, { ok: true, data });
      return;
    }

    if (req.method === "POST" && path === "/checkout") {
      const body = await readJsonBody(req);
      const data = await meFetch("/api/v2/me/shipment/checkout", {
        token,
        method: "POST",
        body,
      });
      sendJson(res, 200, { ok: true, data });
      return;
    }

    if (req.method === "POST" && path === "/generate") {
      const body = await readJsonBody(req);
      const data = await meFetch("/api/v2/me/shipment/generate", {
        token,
        method: "POST",
        body,
      });
      sendJson(res, 200, { ok: true, data });
      return;
    }

    if (req.method === "GET" && path === "/print-zpl") {
      const id = url.searchParams.get("id");
      if (!id) {
        sendJson(res, 400, { ok: false, error: "Informe id da etiqueta." });
        return;
      }
      // Confere status antes — E-PRT-0011 = ainda nao gerado
      try {
        const order = await meFetch(`/api/v2/me/orders/${id}`, { token });
        const status = String(order?.status || "").toLowerCase();
        const ready = ["generated", "posted", "delivered", "received", "in_transit"].includes(
          status,
        );
        if (!ready && !order?.generated_at) {
          sendJson(res, 409, {
            ok: false,
            error: `E-PRT-0011: envio ainda nao gerado (status: ${status || "desconhecido"}).`,
            data: { status, id },
          });
          return;
        }
      } catch {
        /* se order falhar, ainda tenta o ZPL */
      }

      const zpl = await fetchElginCompatibleZpl(token, id);
      sendJson(res, 200, { ok: true, data: zpl });
      return;
    }

    if (req.method === "POST" && path === "/print-pdf") {
      const body = await readJsonBody(req);
      const orders = Array.isArray(body.orders) ? body.orders.filter(Boolean) : [];
      if (!orders.length) {
        sendJson(res, 400, { ok: false, error: "Informe orders: [id, ...]." });
        return;
      }
      const data = await meFetch("/api/v2/me/shipment/print", {
        token,
        method: "POST",
        body: {
          mode: body.mode || "private",
          orders,
        },
      });
      sendJson(res, 200, { ok: true, data });
      return;
    }

    if (req.method === "GET" && path === "/order") {
      const id = url.searchParams.get("id");
      if (!id) {
        sendJson(res, 400, { ok: false, error: "Informe id." });
        return;
      }
      const data = await meFetch(`/api/v2/me/orders/${id}`, { token });
      sendJson(res, 200, { ok: true, data });
      return;
    }

    sendJson(res, 404, { ok: false, error: `Rota não encontrada: ${path}` });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : JSON.stringify(err);
    sendJson(res, err?.status || 500, {
      ok: false,
      error: message || "Erro interno",
      details: err?.data || null,
    });
  }
}
