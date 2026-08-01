import { getSupabase, hasCloudBackend } from "./store";

const LOCAL_KEY = "3dxap-label-archive-v1";

export type LabelStatus = "pronta" | "impressa";

export type LabelArchiveItem = {
  id: string;
  quoteNumero: string;
  cliente: string;
  carrier: string;
  service: string;
  destName: string;
  destCep: string;
  zpl: string;
  status: LabelStatus;
  printedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LabelArchiveInput = {
  id: string;
  quoteNumero?: string;
  cliente?: string;
  carrier?: string;
  service?: string;
  destName?: string;
  destCep?: string;
  zpl: string;
  status?: LabelStatus;
  printedAt?: string | null;
};

function fromRow(row: {
  id: string;
  quote_numero: string;
  cliente: string;
  carrier: string;
  service: string;
  dest_name: string;
  dest_cep: string;
  zpl: string;
  status: string;
  printed_at: string | null;
  created_at: string;
  updated_at: string;
}): LabelArchiveItem {
  return {
    id: row.id,
    quoteNumero: row.quote_numero || "",
    cliente: row.cliente || "",
    carrier: row.carrier || "",
    service: row.service || "",
    destName: row.dest_name || "",
    destCep: row.dest_cep || "",
    zpl: row.zpl || "",
    status: row.status === "impressa" ? "impressa" : "pronta",
    printedAt: row.printed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(item: LabelArchiveItem) {
  return {
    id: item.id,
    quote_numero: item.quoteNumero,
    cliente: item.cliente,
    carrier: item.carrier,
    service: item.service,
    dest_name: item.destName,
    dest_cep: item.destCep,
    zpl: item.zpl,
    status: item.status,
    printed_at: item.printedAt,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

function readLocal(): LabelArchiveItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LabelArchiveItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(items: LabelArchiveItem[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
}

function sortItems(items: LabelArchiveItem[]) {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listLabelArchive(): Promise<LabelArchiveItem[]> {
  const client = getSupabase();
  if (!client) return sortItems(readLocal());

  const { data, error } = await client
    .from("label_archive")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[label_archive] list failed, using local", error.message);
    return sortItems(readLocal());
  }

  const items = (data ?? []).map(fromRow);
  writeLocal(items);
  return sortItems(items);
}

export async function upsertLabelArchive(input: LabelArchiveInput): Promise<LabelArchiveItem> {
  const now = new Date().toISOString();
  const local = readLocal();
  const existing = local.find((x) => x.id === input.id);

  const item: LabelArchiveItem = {
    id: input.id,
    quoteNumero: input.quoteNumero ?? existing?.quoteNumero ?? "",
    cliente: input.cliente ?? existing?.cliente ?? "",
    carrier: input.carrier ?? existing?.carrier ?? "",
    service: input.service ?? existing?.service ?? "",
    destName: input.destName ?? existing?.destName ?? "",
    destCep: input.destCep ?? existing?.destCep ?? "",
    zpl: input.zpl || existing?.zpl || "",
    status: input.status ?? existing?.status ?? "pronta",
    printedAt:
      input.printedAt !== undefined ? input.printedAt : (existing?.printedAt ?? null),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const next = [item, ...local.filter((x) => x.id !== item.id)];
  writeLocal(next);

  const client = getSupabase();
  if (client) {
    const { error } = await client.from("label_archive").upsert(toRow(item), { onConflict: "id" });
    if (error) {
      console.warn("[label_archive] upsert failed", error.message);
      if (error.code === "PGRST205" || /label_archive|schema cache/i.test(error.message)) {
        // local ok; tabela ainda não criada
      }
    }
  }

  return item;
}

export async function markLabelsPrinted(ids: string[]): Promise<void> {
  const now = new Date().toISOString();
  const local = readLocal().map((item) =>
    ids.includes(item.id)
      ? { ...item, status: "impressa" as const, printedAt: now, updatedAt: now }
      : item,
  );
  writeLocal(local);

  const client = getSupabase();
  if (!client) return;

  for (const id of ids) {
    const { error } = await client
      .from("label_archive")
      .update({ status: "impressa", printed_at: now, updated_at: now })
      .eq("id", id);
    if (error) console.warn("[label_archive] mark printed failed", error.message);
  }
}

export async function removeLabelArchive(id: string): Promise<void> {
  writeLocal(readLocal().filter((x) => x.id !== id));
  const client = getSupabase();
  if (!client) return;
  const { error } = await client.from("label_archive").delete().eq("id", id);
  if (error) console.warn("[label_archive] delete failed", error.message);
}

export function labelArchiveCloudEnabled() {
  return hasCloudBackend;
}

export function filterLabelsByRange(
  items: LabelArchiveItem[],
  range: "today" | "7d" | "all",
): LabelArchiveItem[] {
  if (range === "all") return items;
  const now = new Date();
  const start = new Date(now);
  if (range === "today") {
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
  }
  return items.filter((item) => new Date(item.createdAt) >= start);
}
