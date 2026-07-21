import { type FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useContent } from "../lib/ContentContext";
import type { Product, Testimonial } from "../lib/content";

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "3dxap2026";
const AUTH_KEY = "3dxap-admin-auth";

function emptyProduct(): Product {
  return {
    id: crypto.randomUUID(),
    nome: "",
    preco: "",
    categoria: "",
    descricao: "",
    material: "PLA",
    imagens: [],
    whatsapp: "",
    ativo: true,
  };
}

function emptyTestimonial(): Testimonial {
  return {
    id: crypto.randomUUID(),
    nome: "",
    texto: "",
    imagem: "",
    ativo: true,
  };
}

export function AdminPage() {
  const {
    content,
    hasCloudBackend,
    upsertProduct,
    removeProduct,
    upsertTestimonial,
    removeTestimonial,
    uploadImage,
  } = useContent();

  const [authed, setAuthed] = useState(() => sessionStorage.getItem(AUTH_KEY) === "1");
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<"products" | "testimonials">("products");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const sortedProducts = useMemo(
    () => [...content.products].sort((a, b) => a.nome.localeCompare(b.nome)),
    [content.products],
  );

  function login(e: FormEvent) {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, "1");
      setAuthed(true);
      setStatus("");
    } else {
      setStatus("Senha incorreta.");
    }
  }

  function logout() {
    sessionStorage.removeItem(AUTH_KEY);
    setAuthed(false);
  }

  async function onProductFiles(files: FileList | null) {
    if (!editingProduct || !files?.length) return;
    setBusy(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await uploadImage(file, "products"));
      }
      setEditingProduct({
        ...editingProduct,
        imagens: [...editingProduct.imagens, ...uploaded],
      });
    } catch (err) {
      setStatus(`Erro no upload: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function saveProduct(e: FormEvent) {
    e.preventDefault();
    if (!editingProduct) return;
    if (!editingProduct.nome.trim() || !editingProduct.preco.trim()) {
      setStatus("Preencha pelo menos nome e preço.");
      return;
    }
    setBusy(true);
    const payload = {
      ...editingProduct,
      whatsapp:
        editingProduct.whatsapp.trim() ||
        `Olá, tenho interesse em ${editingProduct.nome.trim()}`,
    };
    await upsertProduct(payload);
    setEditingProduct(null);
    setStatus("Produto salvo.");
    setBusy(false);
  }

  async function onTestimonialFile(files: FileList | null) {
    if (!editingTestimonial || !files?.[0]) return;
    setBusy(true);
    try {
      const url = await uploadImage(files[0], "testimonials");
      setEditingTestimonial({ ...editingTestimonial, imagem: url });
    } catch (err) {
      setStatus(`Erro no upload: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function saveTestimonial(e: FormEvent) {
    e.preventDefault();
    if (!editingTestimonial) return;
    if (!editingTestimonial.nome.trim() || !editingTestimonial.texto.trim()) {
      setStatus("Preencha nome e texto do depoimento.");
      return;
    }
    setBusy(true);
    await upsertTestimonial(editingTestimonial);
    setEditingTestimonial(null);
    setStatus("Depoimento salvo.");
    setBusy(false);
  }

  if (!authed) {
    return (
      <div className="mx-auto flex min-h-screen w-[min(420px,calc(100%-1.5rem))] flex-col justify-center py-16">
        <h1 className="font-display text-4xl font-semibold text-ink">Painel 3DXAP</h1>
        <p className="mt-2 text-sm text-muted">Área para cadastrar produtos e depoimentos.</p>
        <form onSubmit={login} className="mt-8 space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-rosa/10">
          <label className="block text-sm font-medium">
            Senha
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-rosa/15 bg-cream px-3 py-2.5 outline-none focus:border-rosa"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-full bg-rosa px-4 py-3 text-sm font-semibold text-white"
          >
            Entrar
          </button>
          {status ? <p className="text-sm text-rosa-deep">{status}</p> : null}
        </form>
        <Link to="/" className="mt-6 text-center text-sm text-muted hover:text-rosa">
          ← Voltar ao site
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream pb-16">
      <header className="border-b border-rosa/10 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-[min(1100px,calc(100%-1.5rem))] items-center justify-between gap-3 py-4">
          <div>
            <h1 className="font-display text-3xl font-semibold text-ink">Painel 3DXAP</h1>
            <p className="text-sm text-muted">
              {hasCloudBackend
                ? "Salvando na nuvem (Supabase) — aparece no site para todos."
                : "Modo local — salva neste navegador. Conecte o Supabase para publicar de verdade."}
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/" className="rounded-full bg-cream px-4 py-2 text-sm font-medium ring-1 ring-rosa/15">
              Ver site
            </Link>
            <button
              type="button"
              onClick={logout}
              className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-[min(1100px,calc(100%-1.5rem))] pt-6">
        {!hasCloudBackend ? (
          <div className="mb-5 rounded-2xl bg-sand/70 px-4 py-3 text-sm text-ink ring-1 ring-rosa/10">
            Para sua esposa alimentar o site de qualquer celular/computador, configure o arquivo{" "}
            <code className="rounded bg-white px-1">.env</code> com Supabase (veja{" "}
            <code className="rounded bg-white px-1">supabase/schema.sql</code>). Enquanto isso, o
            painel já funciona neste aparelho.
          </div>
        ) : null}

        {status ? <p className="mb-4 text-sm font-medium text-rosa-deep">{status}</p> : null}

        <div className="mb-6 flex gap-2">
          <button
            type="button"
            onClick={() => setTab("products")}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === "products" ? "bg-rosa text-white" : "bg-white ring-1 ring-rosa/10"}`}
          >
            Produtos ({content.products.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("testimonials")}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === "testimonials" ? "bg-rosa text-white" : "bg-white ring-1 ring-rosa/10"}`}
          >
            Depoimentos ({content.testimonials.length})
          </button>
        </div>

        {tab === "products" ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setEditingProduct(emptyProduct())}
                className="w-full rounded-2xl bg-rosa px-4 py-3 text-sm font-semibold text-white"
              >
                + Novo produto
              </button>
              {sortedProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-rosa/10"
                >
                  {product.imagens[0] ? (
                    <img src={product.imagens[0]} alt="" className="h-14 w-14 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-cream text-xs text-muted">
                      foto
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{product.nome}</p>
                    <p className="text-sm text-muted">
                      {product.preco} · {product.ativo ? "Ativo" : "Oculto"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-full bg-cream px-3 py-1.5 text-xs font-semibold"
                    onClick={() => setEditingProduct(product)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-ink/90 px-3 py-1.5 text-xs font-semibold text-white"
                    onClick={() => void removeProduct(product.id)}
                  >
                    Excluir
                  </button>
                </div>
              ))}
            </div>

            {editingProduct ? (
              <form onSubmit={saveProduct} className="space-y-3 rounded-3xl bg-white p-5 ring-1 ring-rosa/10">
                <h2 className="font-display text-2xl font-semibold">
                  {content.products.some((p) => p.id === editingProduct.id)
                    ? "Editar produto"
                    : "Novo produto"}
                </h2>
                {(
                  [
                    ["nome", "Nome"],
                    ["preco", "Preço"],
                    ["categoria", "Categoria"],
                    ["material", "Material"],
                    ["whatsapp", "Mensagem WhatsApp"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block text-sm font-medium">
                    {label}
                    <input
                      value={editingProduct[key]}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, [key]: e.target.value })
                      }
                      className="mt-1 w-full rounded-xl border border-rosa/15 bg-cream px-3 py-2 outline-none focus:border-rosa"
                    />
                  </label>
                ))}
                <label className="block text-sm font-medium">
                  Descrição
                  <textarea
                    value={editingProduct.descricao}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, descricao: e.target.value })
                    }
                    rows={4}
                    className="mt-1 w-full rounded-xl border border-rosa/15 bg-cream px-3 py-2 outline-none focus:border-rosa"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Fotos
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => void onProductFiles(e.target.files)}
                    className="mt-1 block w-full text-sm"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {editingProduct.imagens.map((img, i) => (
                    <div key={`${img}-${i}`} className="relative">
                      <img src={img} alt="" className="h-16 w-16 rounded-xl object-cover" />
                      <button
                        type="button"
                        className="absolute -right-1 -top-1 rounded-full bg-ink px-1.5 text-xs text-white"
                        onClick={() =>
                          setEditingProduct({
                            ...editingProduct,
                            imagens: editingProduct.imagens.filter((_, idx) => idx !== i),
                          })
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editingProduct.ativo}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, ativo: e.target.checked })
                    }
                  />
                  Visível no site
                </label>
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-full bg-rosa px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {busy ? "Salvando…" : "Salvar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="rounded-full bg-cream px-5 py-2.5 text-sm font-semibold ring-1 ring-rosa/15"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div className="rounded-3xl bg-white/70 p-8 text-sm text-muted ring-1 ring-rosa/10">
                Selecione um produto para editar ou crie um novo.
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setEditingTestimonial(emptyTestimonial())}
                className="w-full rounded-2xl bg-rosa px-4 py-3 text-sm font-semibold text-white"
              >
                + Novo depoimento / print
              </button>
              {content.testimonials.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-rosa/10"
                >
                  {item.imagem ? (
                    <img src={item.imagem} alt="" className="h-14 w-14 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-cream text-xs text-muted">
                      print
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{item.nome}</p>
                    <p className="truncate text-sm text-muted">{item.texto}</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-full bg-cream px-3 py-1.5 text-xs font-semibold"
                    onClick={() => setEditingTestimonial(item)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-ink/90 px-3 py-1.5 text-xs font-semibold text-white"
                    onClick={() => void removeTestimonial(item.id)}
                  >
                    Excluir
                  </button>
                </div>
              ))}
            </div>

            {editingTestimonial ? (
              <form
                onSubmit={saveTestimonial}
                className="space-y-3 rounded-3xl bg-white p-5 ring-1 ring-rosa/10"
              >
                <h2 className="font-display text-2xl font-semibold">Depoimento</h2>
                <label className="block text-sm font-medium">
                  Nome
                  <input
                    value={editingTestimonial.nome}
                    onChange={(e) =>
                      setEditingTestimonial({ ...editingTestimonial, nome: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-rosa/15 bg-cream px-3 py-2 outline-none focus:border-rosa"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Texto
                  <textarea
                    value={editingTestimonial.texto}
                    onChange={(e) =>
                      setEditingTestimonial({ ...editingTestimonial, texto: e.target.value })
                    }
                    rows={4}
                    className="mt-1 w-full rounded-xl border border-rosa/15 bg-cream px-3 py-2 outline-none focus:border-rosa"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Print do cliente (foto)
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => void onTestimonialFile(e.target.files)}
                    className="mt-1 block w-full text-sm"
                  />
                </label>
                {editingTestimonial.imagem ? (
                  <img
                    src={editingTestimonial.imagem}
                    alt=""
                    className="max-h-56 w-full rounded-xl object-contain bg-cream"
                  />
                ) : null}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editingTestimonial.ativo}
                    onChange={(e) =>
                      setEditingTestimonial({ ...editingTestimonial, ativo: e.target.checked })
                    }
                  />
                  Visível no site
                </label>
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-full bg-rosa px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {busy ? "Salvando…" : "Salvar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTestimonial(null)}
                    className="rounded-full bg-cream px-5 py-2.5 text-sm font-semibold ring-1 ring-rosa/15"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div className="rounded-3xl bg-white/70 p-8 text-sm text-muted ring-1 ring-rosa/10">
                Cadastre um print de elogio ou um depoimento em texto.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
