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

type GenerateEntry = { status?: boolean | number | string; message?: string };

function unwrapGenerateMap(data: unknown): Record<string, GenerateEntry> {
  if (!data || typeof data !== "object") return {};
  const obj = data as Record<string, unknown>;
  if (obj.details && typeof obj.details === "object") {
    return obj.details as Record<string, GenerateEntry>;
  }
  if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
    const nested = obj.data as Record<string, unknown>;
    if (nested.details && typeof nested.details === "object") {
      return nested.details as Record<string, GenerateEntry>;
    }
    // Se data for o mapa uuid -> {status,message}
    const nestedEntries = Object.values(nested).filter(
      (v) => v && typeof v === "object" && "status" in (v as object),
    );
    if (nestedEntries.length > 0) return nested as Record<string, GenerateEntry>;
  }
  return obj as Record<string, GenerateEntry>;
}

function findGenerateEntry(map: Record<string, GenerateEntry>, orderId: string) {
  if (map[orderId]) return map[orderId];
  const lower = orderId.toLowerCase();
  for (const [key, value] of Object.entries(map)) {
    if (key.toLowerCase() === lower && value && typeof value === "object") return value;
  }
  return null;
}

function isGenerateSuccess(entry: GenerateEntry) {
  return entry.status === true || entry.status === 1 || entry.status === "1";
}

function isAlreadyGeneratedMessage(msg: string) {
  return /j[aá]\s+(foi\s+)?gerad|already\s+generat|gerado com sucesso/i.test(msg);
}

function assertGenerateOk(data: unknown, ids: string[]) {
  const map = unwrapGenerateMap(data);
  const statusEntries = Object.entries(map).filter(
    ([, v]) => v && typeof v === "object" && "status" in v,
  );

  for (const id of ids) {
    let entry = findGenerateEntry(map, id);
    if (!entry && statusEntries.length === 1) {
      entry = statusEntries[0][1];
    }
    if (!entry) {
      throw new Error(
        `Melhor Envio nao confirmou a geracao (${id}). Resposta: ${JSON.stringify(data).slice(0, 400)}`,
      );
    }
    if (isGenerateSuccess(entry) || isAlreadyGeneratedMessage(String(entry.message || ""))) {
      continue;
    }
    throw new Error(entry.message || `Falha ao gerar etiqueta ${id}`);
  }
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
  assertGenerateOk(result.data, ids);
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

const READY_STATUSES = ["generated", "posted", "delivered", "received", "in_transit"];

export function extractOrderStatus(order: unknown): string {
  if (!order || typeof order !== "object") return "";
  const obj = order as Record<string, unknown>;
  if (typeof obj.status === "string") return obj.status.toLowerCase();
  if (obj.status && typeof obj.status === "object") {
    const nested = obj.status as Record<string, unknown>;
    if (typeof nested.name === "string") return nested.name.toLowerCase();
    if (typeof nested.status === "string") return nested.status.toLowerCase();
  }
  if (obj.order && typeof obj.order === "object") {
    return extractOrderStatus(obj.order);
  }
  return "";
}

function orderLooksGenerated(order: unknown): boolean {
  const status = extractOrderStatus(order);
  if (READY_STATUSES.includes(status)) return true;
  if (!order || typeof order !== "object") return false;
  const obj = order as Record<string, unknown>;
  return Boolean(obj.generated_at);
}

export function isJadlogQuote(q: { name?: string; company?: { name?: string } } | null | undefined) {
  if (!q) return false;
  return /jadlog/i.test(q.company?.name || "") || /jadlog/i.test(q.name || "");
}

export function isAzulQuote(q: { name?: string; company?: { name?: string } } | null | undefined) {
  if (!q) return false;
  return /azul/i.test(q.company?.name || "") || /azul/i.test(q.name || "");
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
    const status = extractOrderStatus(result.data);
    lastStatus = status;
    if (statuses.map((s) => s.toLowerCase()).includes(status) || orderLooksGenerated(result.data)) {
      return result.data;
    }
    await sleep(intervalMs);
  }
  throw new Error(
    `Pedido ME nao ficou pronto (status atual: ${lastStatus || "desconhecido"}). Esperado: ${statuses.join(", ")}.`,
  );
}

/**
 * Chama generate e so retorna quando o pedido estiver realmente gerado.
 * Nunca segue para ZPL com status released — isso causa E-PRT-0011.
 */
export async function ensureOrderGenerated(
  orderId: string,
  { attempts = 30, intervalMs = 2000 } = {},
) {
  let lastStatus = "";
  let lastGenerateError = "";
  let lastGenerateRaw = "";

  for (let i = 0; i < attempts; i++) {
    const result = await fetchOrder(orderId);
    lastStatus = extractOrderStatus(result.data);
    if (orderLooksGenerated(result.data)) return result.data;

    if (lastStatus === "released" || lastStatus === "pending" || !lastStatus) {
      if (i === 0 || i % 2 === 0) {
        try {
          const gen = await generateOrders([orderId]);
          lastGenerateRaw = JSON.stringify(gen.data).slice(0, 350);
          lastGenerateError = "";
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (isAlreadyGeneratedMessage(msg)) {
            lastGenerateError = "";
          } else {
            lastGenerateError = msg;
          }
        }
      }
    }

    await sleep(intervalMs);
  }

  const parts = [
    `Etiqueta nao ficou gerada no Melhor Envio (status: ${lastStatus || "desconhecido"}).`,
  ];
  if (lastGenerateError) parts.push(`Erro generate: ${lastGenerateError}`);
  if (lastGenerateRaw) parts.push(`Resposta generate: ${lastGenerateRaw}`);
  parts.push("No sandbox, ZPL so funciona com Jadlog — escolha Jadlog na cotacao.");
  throw new Error(parts.join(" "));
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

const BRIDGE_ORIGINS = new Set([
  "http://127.0.0.1:9109",
  "http://localhost:9109",
]);

function isNetworkAgentError(msg: string) {
  return /load failed|failed to fetch|networkerror|cors|private network|blocked/i.test(msg);
}

function agentOfflineMessage() {
  return "Nao foi possivel falar com o agent da Elgin em http://127.0.0.1:9109. No Mac: no Terminal rode `cd printer-agent && node server.mjs`. No Windows da Paula: iniciar-agent.bat. Se o Safari bloquear, o admin abre uma janela-ponte — permita o pop-up.";
}

/** Abre a ponte HTTP local (funciona no Safari, onde fetch HTTPS→HTTP falha). */
function openPrinterBridge() {
  const w = window.open(
    `${PRINTER_AGENT_URL}/bridge`,
    "3dxap-elgin-bridge",
    "popup=yes,width=440,height=340",
  );
  return w;
}

function waitForBridgeReady(bridge: Window, timeoutMs = 12000) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(
        new Error(
          "Ponte do agent nao respondeu. Confira http://127.0.0.1:9109/health e permita pop-ups.",
        ),
      );
    }, timeoutMs);

    function onMessage(ev: MessageEvent) {
      if (!BRIDGE_ORIGINS.has(ev.origin)) return;
      if (ev.data?.type === "3dxap-bridge-ready" || ev.data?.type === "3dxap-pong") {
        window.clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        resolve();
      }
    }

    window.addEventListener("message", onMessage);
    // Pedido de ping caso ready tenha passado
    window.setTimeout(() => {
      try {
        bridge.postMessage({ type: "3dxap-ping" }, PRINTER_AGENT_URL);
      } catch {
        /* ignore */
      }
    }, 300);
  });
}

async function printViaBridge(zpl: string) {
  const bridge = openPrinterBridge();
  if (!bridge) {
    throw new Error(
      "Pop-up bloqueado. Permita pop-ups para este site (ou use Chrome) e tente de novo.",
    );
  }

  await waitForBridgeReady(bridge);

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timeout esperando impressao pela ponte. A Elgin esta ligada?"));
    }, 90000);

    function onMessage(ev: MessageEvent) {
      if (!BRIDGE_ORIGINS.has(ev.origin)) return;
      if (ev.data?.type !== "3dxap-print-result") return;
      cleanup();
      if (ev.data.ok) resolve(ev.data);
      else reject(new Error(ev.data.error || "Falha ao imprimir via ponte."));
    }

    function cleanup() {
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    }

    window.addEventListener("message", onMessage);
    try {
      bridge.postMessage({ type: "3dxap-print", zpl }, PRINTER_AGENT_URL);
    } catch (err) {
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

async function healthViaBridge() {
  const bridge = openPrinterBridge();
  if (!bridge) {
    throw new Error(
      "Pop-up bloqueado. Permita pop-ups para este site (ou use Chrome) e tente de novo.",
    );
  }
  await waitForBridgeReady(bridge);
  try {
    bridge.close();
  } catch {
    /* ignore */
  }
  return { ok: true, via: "bridge" };
}

export async function printerAgentHealth() {
  try {
    const res = await fetch(`${PRINTER_AGENT_URL}/health`);
    if (!res.ok) throw new Error("Printer agent offline");
    return res.json();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!isNetworkAgentError(msg)) {
      throw err instanceof Error ? err : new Error(String(err));
    }
    // Safari bloqueia fetch HTTPS→HTTP; tenta a ponte (janela local)
    try {
      return await healthViaBridge();
    } catch {
      throw new Error(agentOfflineMessage());
    }
  }
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
  const payload = String(zpl || "").trim();
  if (!payload) throw new Error("ZPL vazio — nao ha etiqueta para imprimir.");
  try {
    const res = await fetch(`${PRINTER_AGENT_URL}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zpl: payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.error || "Falha ao imprimir");
    return data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Erro retornado pelo agent (HTTP ok parse) — nao usar ponte
    if (msg && !isNetworkAgentError(msg) && !(err instanceof TypeError)) {
      throw err instanceof Error ? err : new Error(msg);
    }
    // Safari/Chrome bloqueando HTTPS→HTTP: imprime pela janela-ponte local
    return printViaBridge(payload);
  }
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

import { extractShippingLabelZpl } from "./zplLabel";

export async function fetchZplText(orderId: string): Promise<string> {
  const result = await fetchZpl(orderId);
  const payload = result.data;
  // API ja resolve URL S3 no servidor e devolve ZPL cru (evita CORS / Load failed)
  let raw = "";
  if (typeof payload === "string") {
    if (payload.trim().startsWith("^XA") || payload.includes("^XA")) raw = payload;
    else if (/^https?:\/\//i.test(payload)) {
      throw new Error(
        "API devolveu URL ZPL em vez do arquivo. Atualize a pagina e tente de novo (deploy pode estar atrasado).",
      );
    } else raw = payload;
  } else if (payload && typeof payload === "object") {
    const url = (payload as { url?: string }).url || Object.values(payload)[0];
    if (typeof url === "string" && (url.includes("^XA") || url.trim().startsWith("^XA"))) {
      raw = url;
    } else if (typeof url === "string" && !/^https?:\/\//i.test(url)) {
      raw = url;
    }
  }
  if (!raw) throw new Error("Não foi possível obter o ZPL da etiqueta.");
  // Só a etiqueta de frete — sem declaração/recibo (como desmarcar no PDF do ME)
  return extractShippingLabelZpl(raw);
}

/** Tenta baixar ZPL com novas tentativas (ME as vezes demora a liberar apos generate). */
export async function fetchZplTextWithRetry(orderId: string, attempts = 10) {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const order = await fetchOrder(orderId);
      if (!orderLooksGenerated(order.data) && i > 0 && i % 2 === 0) {
        try {
          await generateOrders([orderId]);
        } catch {
          /* segue tentando ZPL */
        }
        await sleep(1000);
      }
      return await fetchZplText(orderId);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!/E-PRT-0011|gerad|generat|422|404/i.test(msg) && i > 1) throw err;
      await sleep(2000);
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
