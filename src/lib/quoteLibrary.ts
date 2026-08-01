import type { QuoteData } from "./quotePdf";
import { getSupabase, hasCloudBackend } from "./store";

const LOCAL_KEY = "3dxap-quote-library-v1";

export type QuoteLibraryItem = {
  id: string;
  cliente: string;
  numero: string;
  dataLabel: string;
  data: QuoteData;
  createdAt: string;
  updatedAt: string;
};

function fromRow(row: {
  id: string;
  cliente: string;
  numero: string;
  data_label: string;
  payload: QuoteData;
  created_at: string;
  updated_at: string;
}): QuoteLibraryItem {
  return {
    id: row.id,
    cliente: row.cliente || row.payload?.cliente || "",
    numero: row.numero || row.payload?.numero || "",
    dataLabel: row.data_label || row.payload?.data || "",
    data: row.payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function readLocal(): QuoteLibraryItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QuoteLibraryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(items: QuoteLibraryItem[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
}

export async function listQuoteLibrary(): Promise<QuoteLibraryItem[]> {
  const client = getSupabase();
  if (!client) {
    return readLocal().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  const { data, error } = await client
    .from("quote_library")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.warn("[quote_library] list failed, using local", error);
    return readLocal().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  const items = (data ?? []).map(fromRow);
  writeLocal(items);
  return items;
}

export async function upsertQuoteLibrary(
  id: string,
  quote: QuoteData,
): Promise<QuoteLibraryItem> {
  const now = new Date().toISOString();
  const item: QuoteLibraryItem = {
    id,
    cliente: quote.cliente.trim(),
    numero: quote.numero,
    dataLabel: quote.data,
    data: structuredClone(quote),
    createdAt: now,
    updatedAt: now,
  };

  const local = readLocal();
  const idx = local.findIndex((x) => x.id === id);
  if (idx >= 0) {
    item.createdAt = local[idx].createdAt;
    local[idx] = item;
  } else {
    local.unshift(item);
  }
  writeLocal(local);

  const client = getSupabase();
  if (!client) return item;

  const { error } = await client.from("quote_library").upsert(
    {
      id: item.id,
      cliente: item.cliente,
      numero: item.numero,
      data_label: item.dataLabel,
      payload: item.data,
      updated_at: item.updatedAt,
      created_at: item.createdAt,
    },
    { onConflict: "id" },
  );

  if (error) {
    console.warn("[quote_library] upsert failed", error);
    // Local já foi salvo; avisa se a tabela não existe ainda
    if (error.code === "PGRST205" || /quote_library|schema cache/i.test(error.message)) {
      throw new Error(
        "Crie a tabela no Supabase: rode o arquivo supabase/quote_library.sql no SQL Editor.",
      );
    }
    throw new Error(`Falha ao salvar na nuvem: ${error.message}`);
  }

  return item;
}

export async function removeQuoteLibrary(id: string): Promise<void> {
  writeLocal(readLocal().filter((x) => x.id !== id));

  const client = getSupabase();
  if (!client) return;

  const { error } = await client.from("quote_library").delete().eq("id", id);
  if (error) console.warn("[quote_library] delete failed", error);
}

export function quoteLibraryCloudEnabled() {
  return hasCloudBackend;
}
