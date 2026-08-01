import type { QuoteData } from "./quotePdf";
import { getSupabase, hasCloudBackend } from "./store";
import { QUOTE_LIBRARY_SEED } from "./quoteLibrarySeed";

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

function mergeUnique(items: QuoteLibraryItem[]): QuoteLibraryItem[] {
  const map = new Map<string, QuoteLibraryItem>();
  for (const item of items) {
    if (!item?.id) continue;
    map.set(item.id, item);
  }
  return Array.from(map.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Garante Rede Tintou + Simone Matias na biblioteca (recuperados dos PDFs). */
export async function ensureQuoteLibrarySeeds(): Promise<QuoteLibraryItem[]> {
  const local = readLocal();
  const missing = QUOTE_LIBRARY_SEED.filter((seed) => !local.some((x) => x.id === seed.id));
  let next = local;
  if (missing.length) {
    next = mergeUnique([...missing, ...local]);
    writeLocal(next);
  }

  const client = getSupabase();
  if (client) {
    for (const seed of QUOTE_LIBRARY_SEED) {
      const { error } = await client.from("quote_library").upsert(
        {
          id: seed.id,
          cliente: seed.cliente,
          numero: seed.numero,
          data_label: seed.dataLabel,
          payload: seed.data,
          created_at: seed.createdAt,
          updated_at: seed.updatedAt,
        },
        { onConflict: "id" },
      );
      if (error) console.warn("[quote_library] seed sync failed", error.message);
    }
  }

  return next;
}

export async function listQuoteLibrary(): Promise<QuoteLibraryItem[]> {
  await ensureQuoteLibrarySeeds();

  const client = getSupabase();
  if (!client) {
    return mergeUnique([...readLocal(), ...QUOTE_LIBRARY_SEED]);
  }

  const { data, error } = await client
    .from("quote_library")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.warn("[quote_library] list failed, using local", error);
    return mergeUnique([...readLocal(), ...QUOTE_LIBRARY_SEED]);
  }

  const items = mergeUnique([...(data ?? []).map(fromRow), ...QUOTE_LIBRARY_SEED, ...readLocal()]);
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
