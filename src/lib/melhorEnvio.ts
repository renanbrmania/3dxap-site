const TOKEN_KEY = "3dxap-me-tokens-v1";

export type MeTokens = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  token_type?: string;
  obtained_at: number;
};

export type MeQuoteOption = {
  id: number;
  name: string;
  company?: { id?: number; name?: string };
  price: string | number;
  custom_price?: string | number;
  discount?: string | number;
  currency?: string;
  delivery_time?: number;
  delivery_range?: { min?: number; max?: number };
  error?: string;
  packages?: unknown[];
};

export type ShipRecipient = {
  name: string;
  email: string;
  phone: string;
  document: string;
  company_document: string;
  state_register: string;
  address: string;
  complement: string;
  number: string;
  district: string;
  city: string;
  postal_code: string;
  state_abbr: string;
  country_id: string;
};

export type ShipProduct = {
  name: string;
  quantity: string | number;
  unitary_value: string | number;
};

export type ShippingStatus =
  | "none"
  | "cotado"
  | "aguardando_nf"
  | "etiqueta_gerada"
  | "impresso";

export type ShippingState = {
  status: ShippingStatus;
  destCep: string;
  weightKg: number;
  heightCm: number;
  widthCm: number;
  lengthCm: number;
  quotes: MeQuoteOption[];
  selectedServiceId: number | null;
  selectedQuote: MeQuoteOption | null;
  recipient: ShipRecipient | null;
  products: ShipProduct[];
  invoiceKey: string;
  invoiceXmlContent: string;
  meCartId: string;
  meOrderId: string;
  zplUrl: string;
  lastError: string;
  updatedAt: string;
};

export function emptyShippingState(): ShippingState {
  return {
    status: "none",
    destCep: "",
    weightKg: 0.5,
    heightCm: 10,
    widthCm: 15,
    lengthCm: 20,
    quotes: [],
    selectedServiceId: null,
    selectedQuote: null,
    recipient: null,
    products: [],
    invoiceKey: "",
    invoiceXmlContent: "",
    meCartId: "",
    meOrderId: "",
    zplUrl: "",
    lastError: "",
    updatedAt: new Date().toISOString(),
  };
}

export function emptyRecipient(): ShipRecipient {
  return {
    name: "",
    email: "",
    phone: "",
    document: "",
    company_document: "",
    state_register: "",
    address: "",
    complement: "",
    number: "",
    district: "",
    city: "",
    postal_code: "",
    state_abbr: "",
    country_id: "BR",
  };
}

export function loadMeTokens(): MeTokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MeTokens;
  } catch {
    return null;
  }
}

export function saveMeTokens(tokens: Omit<MeTokens, "obtained_at"> & { obtained_at?: number }) {
  const payload: MeTokens = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: tokens.expires_in,
    token_type: tokens.token_type,
    obtained_at: tokens.obtained_at || Date.now(),
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(payload));
  return payload;
}

export function clearMeTokens() {
  localStorage.removeItem(TOKEN_KEY);
}

export function onlyDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`/api/me${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const errVal = data.error ?? data.message;
    const msg =
      typeof errVal === "string"
        ? errVal
        : errVal
          ? JSON.stringify(errVal)
          : data.details
            ? JSON.stringify(data.details)
            : `Erro API ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function getMeConfig() {
  return api("/config");
}

export async function getAuthorizeUrl(state = "3dxap") {
  return api(`/authorize-url?state=${encodeURIComponent(state)}`);
}

export async function exchangeCode(code: string) {
  const data = await api("/token", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  return saveMeTokens(data.tokens);
}

export async function refreshMeToken() {
  const current = loadMeTokens();
  if (!current?.refresh_token) throw new Error("Sem refresh_token. Conecte o Melhor Envio.");
  const data = await api("/token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: current.refresh_token }),
  });
  return saveMeTokens(data.tokens);
}

async function withToken<T>(fn: (token: string) => Promise<T>): Promise<T> {
  let tokens = loadMeTokens();
  if (!tokens?.access_token) throw new Error("Conecte o Melhor Envio no admin primeiro.");
  try {
    return await fn(tokens.access_token);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/401|Unauthenticated|token/i.test(msg)) throw err;
    tokens = await refreshMeToken();
    return fn(tokens.access_token);
  }
}

export async function calculateShipping(payload: unknown) {
  return withToken((token) =>
    api("/calculate", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    }),
  );
}

export async function addToCart(payload: unknown) {
  return withToken((token) =>
    api("/cart", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    }),
  );
}

export async function checkoutOrders(orderIds: string[]) {
  return withToken((token) =>
    api("/checkout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ orders: orderIds.map(String) }),
    }),
  );
}

export async function generateOrders(orderIds: string[]) {
  const ids = orderIds.map(String);
  const result = await withToken((token) =>
    api("/generate", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ orders: ids }),
    }),
  );

  const data = result.data;
  if (data && typeof data === "object") {
    for (const id of ids) {
      const entry = (data as Record<string, { status?: boolean; message?: string }>)[id];
      if (entry && entry.status === false) {
        throw new Error(entry.message || `Falha ao gerar etiqueta ${id}`);
      }
    }
  }
  return result;
}

export async function fetchOrder(orderId: string) {
  return withToken((token) =>
    api(`/order?id=${encodeURIComponent(String(orderId))}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
}

function sleep(ms: number) {
  return new Promise((r) => window.setTimeout(r, ms));
}

/** Espera o pedido ME atingir um dos status (ex.: released, generated). */
export async function waitForOrderStatus(
  orderId: string,
  statuses: string[],
  { attempts = 20, intervalMs = 1500 } = {},
) {
  let lastStatus = "";
  for (let i = 0; i < attempts; i++) {
    const result = await fetchOrder(orderId);
    const status = String(result.data?.status || "").toLowerCase();
    lastStatus = status;
    if (statuses.map((s) => s.toLowerCase()).includes(status)) {
      return result.data;
    }
    await sleep(intervalMs);
  }
  throw new Error(
    `Pedido ME nao ficou pronto (status atual: ${lastStatus || "desconhecido"}). Esperado: ${statuses.join(", ")}.`,
  );
}

export async function fetchZpl(orderId: string) {
  return withToken((token) =>
    api(`/print-zpl?id=${encodeURIComponent(String(orderId))}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
}

export const PRINTER_AGENT_URL =
  import.meta.env.VITE_PRINTER_AGENT_URL || "http://127.0.0.1:9109";

export async function printerAgentHealth() {
  const res = await fetch(`${PRINTER_AGENT_URL}/health`);
  if (!res.ok) throw new Error("Printer agent offline");
  return res.json();
}

export async function printerAgentDiscover() {
  const res = await fetch(`${PRINTER_AGENT_URL}/discover`);
  const data = await res.json();
  if (!res.ok || data.ok === false) throw new Error(data.error || "Falha ao descobrir impressora");
  return data.printer;
}

/** Discover com timeout — a varredura de rede no Windows pode demorar. */
export async function printerAgentDiscoverTimed(timeoutMs = 25000) {
  const result = await Promise.race([
    printerAgentDiscover(),
    new Promise<never>((_, reject) =>
      window.setTimeout(
        () =>
          reject(
            new Error(
              "Busca demorou demais. Confira Wi-Fi da Elgin e se o agent esta em http://127.0.0.1:9109/health",
            ),
          ),
        timeoutMs,
      ),
    ),
  ]);
  return result;
}

export async function printerAgentPrintZpl(zpl: string) {
  const res = await fetch(`${PRINTER_AGENT_URL}/print`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ zpl }),
  });
  const data = await res.json();
  if (!res.ok || data.ok === false) throw new Error(data.error || "Falha ao imprimir");
  return data;
}

/** Etiqueta minima para validar a Elgin. */
export function buildTestLabelZpl() {
  return `^XA
^CI28
^FO40,40^A0N,48,48^FD3DXAP - TESTE^FS
^FO40,100^A0N,32,32^FDImpressora OK^FS
^FO40,150^A0N,28,28^FD${new Date().toLocaleString("pt-BR")}^FS
^XZ
`;
}

export async function printerAgentPrintTest() {
  await printerAgentHealth();
  return printerAgentPrintZpl(buildTestLabelZpl());
}

export async function fetchZplText(orderId: string): Promise<string> {
  const result = await fetchZpl(orderId);
  const payload = result.data;
  // API pode retornar URL string, objeto com url, ou ZPL cru
  if (typeof payload === "string") {
    if (payload.trim().startsWith("^XA") || payload.includes("^XA")) return payload;
    if (payload.startsWith("http")) {
      const fileRes = await fetch(payload);
      return await fileRes.text();
    }
    return payload;
  }
  if (payload && typeof payload === "object") {
    const url = (payload as { url?: string }).url || Object.values(payload)[0];
    if (typeof url === "string" && url.startsWith("http")) {
      const fileRes = await fetch(url);
      return await fileRes.text();
    }
    if (typeof url === "string") return url;
  }
  throw new Error("Não foi possível obter o ZPL da etiqueta.");
}

/** Tenta baixar ZPL com novas tentativas (ME as vezes demora a liberar apos generate). */
export async function fetchZplTextWithRetry(orderId: string, attempts = 8) {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchZplText(orderId);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!/E-PRT-0011|gerad|generat|422|404/i.test(msg) && i > 1) throw err;
      await sleep(1500);
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("Nao foi possivel obter o ZPL apos varias tentativas.");
}

/** Solicita PDF de impressão no Melhor Envio (um ou vários pedidos). */
export async function fetchPrintPdf(orderIds: string[]) {
  return withToken((token) =>
    api("/print-pdf", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ orders: orderIds, mode: "private" }),
    }),
  );
}

export function extractPrintUrl(payload: unknown): string | null {
  if (typeof payload === "string" && payload.startsWith("http")) return payload;
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (typeof obj.url === "string") return obj.url;
    for (const v of Object.values(obj)) {
      if (typeof v === "string" && v.startsWith("http")) return v;
      if (v && typeof v === "object") {
        const nested = extractPrintUrl(v);
        if (nested) return nested;
      }
    }
  }
  return null;
}
