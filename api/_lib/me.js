/**
 * Shared Melhor Envio helpers for Vercel `/api` and local API server.
 */

export const ME_SCOPES = [
  "cart-read",
  "cart-write",
  "shipping-calculate",
  "shipping-checkout",
  "shipping-generate",
  "shipping-print",
  "shipping-companies",
  "orders-read",
  "users-read",
].join(" ");

export function meBaseUrl() {
  const env = (process.env.ME_ENV || process.env.VITE_ME_ENV || "sandbox").toLowerCase();
  return env === "production"
    ? "https://melhorenvio.com.br"
    : "https://sandbox.melhorenvio.com.br";
}

export function meUserAgent() {
  return (
    process.env.ME_USER_AGENT ||
    process.env.VITE_ME_USER_AGENT ||
    "3DXAP Admin (renan@repatech.com.br)"
  );
}

export function meConfig() {
  const clientId = process.env.ME_CLIENT_ID || process.env.VITE_ME_CLIENT_ID || "";
  const clientSecret = process.env.ME_CLIENT_SECRET || "";
  const redirectUri =
    process.env.ME_REDIRECT_URI ||
    process.env.VITE_ME_REDIRECT_URI ||
    "https://www.3dxap.com.br/admin/me-callback";
  return { clientId, clientSecret, redirectUri, baseUrl: meBaseUrl(), userAgent: meUserAgent() };
}

export async function meFetch(path, { token, method = "GET", body } = {}) {
  const { baseUrl, userAgent } = meConfig();
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": userAgent,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  const looksZpl = text.trim().startsWith("^XA") || text.includes("^XA");
  if (looksZpl) {
    data = text;
  } else {
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
  }

  if (!res.ok) {
    let msg = `Melhor Envio ${res.status}`;
    if (typeof data === "string") msg = data;
    else if (data && typeof data === "object") {
      if (typeof data.message === "string") msg = data.message;
      else if (typeof data.error === "string") msg = data.error;
      else if (data.error && typeof data.error === "object") {
        msg =
          data.error.message ||
          data.error.code ||
          JSON.stringify(data.error);
      } else {
        try {
          msg = JSON.stringify(data);
        } catch {
          /* keep default */
        }
      }
    }
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function exchangeToken({ code, refreshToken, grantType }) {
  const { clientId, clientSecret, redirectUri, baseUrl, userAgent } = meConfig();
  if (!clientId || !clientSecret) {
    throw new Error(
      "Configure ME_CLIENT_ID e ME_CLIENT_SECRET no ambiente (Vercel / .env).",
    );
  }

  const params = new URLSearchParams();
  params.set("grant_type", grantType);
  params.set("client_id", clientId);
  params.set("client_secret", clientSecret);

  if (grantType === "authorization_code") {
    params.set("redirect_uri", redirectUri);
    params.set("code", code);
  } else if (grantType === "refresh_token") {
    params.set("refresh_token", refreshToken);
  } else {
    throw new Error("grant_type inválido");
  }

  const res = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent,
    },
    body: params.toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (typeof data?.message === "string" && data.message) ||
      (typeof data?.error === "string" && data.error) ||
      (data?.error_description && String(data.error_description)) ||
      (data && typeof data === "object" ? JSON.stringify(data) : "") ||
      `OAuth ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export function readJsonBody(req) {
  if (req.body != null && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body);
  }
  if (typeof req.body === "string") {
    try {
      return Promise.resolve(req.body ? JSON.parse(req.body) : {});
    } catch {
      return Promise.resolve({});
    }
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(body));
}

export function getBearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}
