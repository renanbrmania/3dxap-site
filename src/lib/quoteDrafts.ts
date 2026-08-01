import {
  createDefaultQuote,
  defaultQuoteDateLabel,
  defaultQuoteNumber,
  emptyQuoteItem,
  quoteTotal,
  type QuoteData,
} from "./quotePdf";
import { emptyShippingState, type ShippingState } from "./melhorEnvio";

const STORAGE_KEY = "3dxap-quote-drafts-v1";

export type QuoteDraftStatus = "draft" | "finalized";

export type QuoteDraft = {
  id: string;
  status: QuoteDraftStatus;
  createdAt: string;
  updatedAt: string;
  data: QuoteData;
  shipping?: ShippingState;
};

function normalizeDraft(draft: QuoteDraft): QuoteDraft {
  return {
    ...draft,
    shipping: draft.shipping
      ? { ...emptyShippingState(), ...draft.shipping }
      : emptyShippingState(),
  };
}

function readAll(): QuoteDraft[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QuoteDraft[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((d) => d && typeof d.id === "string" && d.data)
      .map(normalizeDraft)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

function writeAll(drafts: QuoteDraft[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

export function listQuoteDrafts(): QuoteDraft[] {
  return readAll();
}

export function getQuoteDraft(id: string): QuoteDraft | null {
  return readAll().find((d) => d.id === id) ?? null;
}

export function createQuoteDraft(data: QuoteData = createDefaultQuote()): QuoteDraft {
  const now = new Date().toISOString();
  const draft: QuoteDraft = {
    id: crypto.randomUUID(),
    status: "draft",
    createdAt: now,
    updatedAt: now,
    data,
    shipping: emptyShippingState(),
  };
  writeAll([draft, ...readAll()]);
  return draft;
}

export function saveQuoteDraft(
  id: string,
  data: QuoteData,
  status?: QuoteDraftStatus,
  shipping?: ShippingState,
): QuoteDraft {
  const now = new Date().toISOString();
  const existing = readAll();
  const index = existing.findIndex((d) => d.id === id);

  if (index === -1) {
    const draft: QuoteDraft = {
      id,
      status: status ?? "draft",
      createdAt: now,
      updatedAt: now,
      data,
      shipping: shipping ?? emptyShippingState(),
    };
    writeAll([draft, ...existing]);
    return draft;
  }

  const next: QuoteDraft = {
    ...existing[index],
    data,
    updatedAt: now,
    status: status ?? existing[index].status,
    shipping: shipping ?? existing[index].shipping ?? emptyShippingState(),
  };
  const copy = [...existing];
  copy[index] = next;
  writeAll(copy);
  return next;
}

export function removeQuoteDraft(id: string) {
  writeAll(readAll().filter((d) => d.id !== id));
}

/** Copia itens/valores de um orçamento pronto para um novo cliente. */
export function reuseQuoteForNewClient(source: QuoteData): QuoteData {
  const itens = source.itens
    .filter((item) => item.nome.trim())
    .map((item) => ({
      ...item,
      id: crypto.randomUUID(),
    }));

  return {
    ...source,
    cliente: "",
    numero: defaultQuoteNumber(),
    data: defaultQuoteDateLabel(),
    itens: itens.length > 0 ? itens : [emptyQuoteItem()],
  };
}

export function reuseQuoteDraft(source: QuoteDraft): QuoteDraft {
  return createQuoteDraft(reuseQuoteForNewClient(source.data));
}

export function draftLabel(draft: QuoteDraft): string {
  const cliente = draft.data.cliente.trim();
  return cliente || "Cliente sem nome";
}

export function draftSummary(draft: QuoteDraft): string {
  const itens = draft.data.itens.filter((i) => i.nome.trim()).length;
  const total = quoteTotal(draft.data.itens);
  const totalLabel = total.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  return `${itens} item${itens === 1 ? "" : "s"} · ${totalLabel}`;
}

export function formatDraftDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
