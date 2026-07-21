import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { seedContent, type SiteContent } from "./content";

const STORAGE_KEY = "3dxap-site-content-v1";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const hasCloudBackend = Boolean(supabaseUrl && supabaseKey);

let supabase: SupabaseClient | null = null;

export function getSupabase() {
  if (!hasCloudBackend) return null;
  if (!supabase) {
    supabase = createClient(supabaseUrl!, supabaseKey!);
  }
  return supabase;
}

export function loadLocalContent(): SiteContent {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(seedContent);
    return JSON.parse(raw) as SiteContent;
  } catch {
    return structuredClone(seedContent);
  }
}

export function saveLocalContent(content: SiteContent) {
  const next = { ...content, updatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function loadContent(): Promise<SiteContent> {
  const client = getSupabase();
  if (!client) return loadLocalContent();

  const [{ data: products, error: pErr }, { data: testimonials, error: tErr }] =
    await Promise.all([
      client.from("products").select("*").order("created_at", { ascending: true }),
      client.from("testimonials").select("*").order("created_at", { ascending: true }),
    ]);

  if (pErr || tErr || !products) {
    console.warn("Supabase load failed, using local content", pErr || tErr);
    return loadLocalContent();
  }

  return {
    updatedAt: new Date().toISOString(),
    products: products.map((row) => ({
      id: row.id,
      nome: row.nome,
      preco: row.preco,
      categoria: row.categoria,
      descricao: row.descricao,
      material: row.material,
      imagens: row.imagens ?? [],
      whatsapp: row.whatsapp,
      ativo: row.ativo ?? true,
    })),
    testimonials: (testimonials ?? []).map((row) => ({
      id: row.id,
      nome: row.nome,
      texto: row.texto,
      imagem: row.imagem ?? "",
      ativo: row.ativo ?? true,
    })),
  };
}

export async function persistContent(content: SiteContent): Promise<SiteContent> {
  const next = { ...content, updatedAt: new Date().toISOString() };
  saveLocalContent(next);

  const client = getSupabase();
  if (!client) return next;

  // Replace strategy for simplicity (admin is single editor)
  await client.from("products").delete().neq("id", "__none__");
  await client.from("testimonials").delete().neq("id", "__none__");

  if (next.products.length) {
    const { error } = await client.from("products").insert(
      next.products.map((p) => ({
        id: p.id,
        nome: p.nome,
        preco: p.preco,
        categoria: p.categoria,
        descricao: p.descricao,
        material: p.material,
        imagens: p.imagens,
        whatsapp: p.whatsapp,
        ativo: p.ativo,
      })),
    );
    if (error) console.warn("Failed saving products", error);
  }

  if (next.testimonials.length) {
    const { error } = await client.from("testimonials").insert(
      next.testimonials.map((t) => ({
        id: t.id,
        nome: t.nome,
        texto: t.texto,
        imagem: t.imagem,
        ativo: t.ativo,
      })),
    );
    if (error) console.warn("Failed saving testimonials", error);
  }

  return next;
}

export async function uploadImage(file: File, folder: "products" | "testimonials") {
  const client = getSupabase();

  // Local / demo: store as data URL so the panel works before cloud setup
  if (!client) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await client.storage.from("uploads").upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;

  const { data } = client.storage.from("uploads").getPublicUrl(path);
  return data.publicUrl;
}
