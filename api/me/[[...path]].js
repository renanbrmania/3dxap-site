import {
  exchangeToken,
  getBearer,
  meConfig,
  meFetch,
  ME_SCOPES,
  readJsonBody,
  sendJson,
} from "../_lib/me.js";

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
      const data = await meFetch(`/api/v2/me/shipment/print?mode=private`, {
        token,
        method: "POST",
        body: { orders: [id] },
      }).catch(() => null);

      // Arquivo ZPL dedicado
      const file = await meFetch(`/api/v2/me/imprimir/zpl/${id}`, { token });
      sendJson(res, 200, { ok: true, data: file, printLink: data });
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
