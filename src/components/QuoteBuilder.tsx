import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  createQuoteDraft,
  draftLabel,
  draftSummary,
  formatDraftDate,
  listQuoteDrafts,
  removeQuoteDraft,
  reuseQuoteForNewClient,
  saveQuoteDraft,
  type QuoteDraft,
} from "../lib/quoteDrafts";
import {
  createDefaultQuote,
  downloadQuotePdf,
  emptyQuoteItem,
  formatBRL,
  formatMoneyInput,
  lineTotal,
  parseMoneyInput,
  quoteTotal,
  type QuoteData,
  type QuoteItem,
} from "../lib/quotePdf";
import { emptyShippingState, type ShippingState } from "../lib/melhorEnvio";
import {
  listQuoteLibrary,
  quoteLibraryCloudEnabled,
  removeQuoteLibrary,
  upsertQuoteLibrary,
  type QuoteLibraryItem,
} from "../lib/quoteLibrary";
import { ShippingPanel } from "./ShippingPanel";

type Props = {
  onStatus?: (message: string) => void;
};

function updateItem(items: QuoteItem[], id: string, patch: Partial<QuoteItem>): QuoteItem[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

function getFormFields(root: HTMLElement): HTMLInputElement[] {
  return Array.from(
    root.querySelectorAll<HTMLInputElement>(
      "input:not([type='hidden']):not([type='button']):not([type='submit']):not([disabled])",
    ),
  ).filter((el) => {
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && !el.readOnly;
  });
}

function handleQuoteFieldKeyDown(
  e: KeyboardEvent<HTMLElement>,
  options?: { onLastEnter?: () => void },
) {
  if (e.key !== "Enter") return;
  const target = e.target;
  if (!(target instanceof HTMLInputElement)) return;

  e.preventDefault();

  const root = e.currentTarget;
  const fieldsBefore = getFormFields(root);
  const index = fieldsBefore.indexOf(target);

  // Flush blur handlers (ex.: valor unitário salva no blur)
  target.blur();

  window.setTimeout(() => {
    const fields = getFormFields(root);
    if (index >= 0 && index + 1 < fields.length) {
      const next = fields[index + 1];
      next.focus();
      if (typeof next.select === "function") next.select();
      return;
    }
    options?.onLastEnter?.();
  }, 0);
}

export function QuoteBuilder({ onStatus }: Props) {
  const [drafts, setDrafts] = useState<QuoteDraft[]>(() => listQuoteDrafts());
  const [library, setLibrary] = useState<QuoteLibraryItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteData>(() => createDefaultQuote());
  const [shipping, setShipping] = useState<ShippingState>(() => emptyShippingState());
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const skipAutoSave = useRef(false);

  const total = useMemo(() => quoteTotal(quote.itens), [quote.itens]);
  const activeDraft = drafts.find((d) => d.id === draftId) ?? null;
  const openDrafts = drafts.filter((d) => d.status === "draft");
  const cloudOn = quoteLibraryCloudEnabled();

  function refreshDrafts() {
    setDrafts(listQuoteDrafts());
  }

  async function refreshLibrary() {
    setLibraryLoading(true);
    try {
      const localFinalized = listQuoteDrafts().filter((d) => d.status === "finalized");
      for (const d of localFinalized) {
        try {
          await upsertQuoteLibrary(d.id, d.data);
        } catch {
          /* tabela ainda não criada — local já foi gravado */
        }
      }
      setLibrary(await listQuoteLibrary());
    } finally {
      setLibraryLoading(false);
    }
  }

  useEffect(() => {
    void refreshLibrary();
  }, []);

  function setField<K extends keyof QuoteData>(key: K, value: QuoteData[K]) {
    setQuote((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function startNew() {
    skipAutoSave.current = true;
    setDraftId(null);
    setQuote(createDefaultQuote());
    setShipping(emptyShippingState());
    setDirty(false);
    setLastSavedAt(null);
    onStatus?.("Novo orçamento iniciado.");
  }

  function openDraft(draft: QuoteDraft) {
    skipAutoSave.current = true;
    setDraftId(draft.id);
    setQuote(structuredClone(draft.data));
    setShipping(structuredClone(draft.shipping || emptyShippingState()));
    setDirty(false);
    setLastSavedAt(draft.updatedAt);
    onStatus?.(`Rascunho aberto: ${draftLabel(draft)}.`);
  }

  function persist(status?: QuoteDraft["status"]): QuoteDraft {
    if (draftId) {
      const saved = saveQuoteDraft(draftId, quote, status, shipping);
      setLastSavedAt(saved.updatedAt);
      setDirty(false);
      refreshDrafts();
      return saved;
    }

    const created = createQuoteDraft(quote);
    const saved = saveQuoteDraft(created.id, quote, status ?? "draft", shipping);
    setDraftId(saved.id);
    setLastSavedAt(saved.updatedAt);
    setDirty(false);
    refreshDrafts();
    return saved;
  }

  function updateShipping(next: ShippingState) {
    setShipping(next);
    if (draftId) {
      saveQuoteDraft(draftId, quote, undefined, next);
      refreshDrafts();
    } else {
      const created = createQuoteDraft(quote);
      const saved = saveQuoteDraft(created.id, quote, "draft", next);
      setDraftId(saved.id);
      refreshDrafts();
    }
  }

  function handleSaveDraft() {
    const saved = persist("draft");
    onStatus?.(`Rascunho salvo: ${draftLabel(saved)}. Pode fechar e continuar depois.`);
  }

  function addItemAndFocusName() {
    const newItem = emptyQuoteItem();
    setQuote((prev) => ({ ...prev, itens: [...prev.itens, newItem] }));
    setDirty(true);
    window.setTimeout(() => {
      const root = document.getElementById("quote-form-nav");
      if (!root) return;
      const names = root.querySelectorAll<HTMLInputElement>(
        'input[placeholder="Ex.: Tintinhos (Chaveiro)"]',
      );
      const last = names[names.length - 1];
      last?.focus();
      last?.select();
    }, 30);
  }

  function handleDeleteDraft(id: string) {
    const target = drafts.find((d) => d.id === id);
    const label = target ? draftLabel(target) : "orçamento";
    if (!confirm(`Excluir o orçamento de "${label}"?`)) return;
    removeQuoteDraft(id);
    refreshDrafts();
    if (draftId === id) startNew();
    onStatus?.("Orçamento excluído.");
  }

  function handleReuseLibrary(item: QuoteLibraryItem) {
    const created = createQuoteDraft(reuseQuoteForNewClient(item.data));
    skipAutoSave.current = true;
    setDraftId(created.id);
    setQuote(structuredClone(created.data));
    setShipping(emptyShippingState());
    setDirty(false);
    setLastSavedAt(created.updatedAt);
    refreshDrafts();
    onStatus?.(
      `Modelo reutilizado de "${item.cliente || item.numero}". Troque o cliente e ajuste o que precisar.`,
    );
    window.setTimeout(() => {
      document.getElementById("quote-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function openLibraryItem(item: QuoteLibraryItem) {
    skipAutoSave.current = true;
    const created = createQuoteDraft(structuredClone(item.data));
    setDraftId(created.id);
    setQuote(structuredClone(item.data));
    setShipping(emptyShippingState());
    setDirty(false);
    setLastSavedAt(created.updatedAt);
    refreshDrafts();
    onStatus?.(`Biblioteca: aberto "${item.cliente || item.numero}".`);
    window.setTimeout(() => {
      document.getElementById("quote-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  async function handleDeleteLibrary(item: QuoteLibraryItem) {
    if (!confirm(`Excluir da biblioteca "${item.cliente || item.numero}"?`)) return;
    await removeQuoteLibrary(item.id);
    removeQuoteDraft(item.id);
    await refreshLibrary();
    refreshDrafts();
    onStatus?.("Removido da biblioteca.");
  }

  async function handleDownload() {
    setBusy(true);
    onStatus?.("");
    try {
      await downloadQuotePdf(quote);
      const saved = persist("finalized");
      try {
        await upsertQuoteLibrary(saved.id, quote);
        await refreshLibrary();
        onStatus?.(
          cloudOn
            ? "PDF baixado e salvo na biblioteca (nuvem). Use Reutilizar para outro cliente."
            : "PDF baixado e salvo na biblioteca deste navegador.",
        );
      } catch (libErr) {
        await refreshLibrary();
        onStatus?.(
          libErr instanceof Error
            ? `PDF ok. Biblioteca local salva — nuvem: ${libErr.message}`
            : "PDF ok. Biblioteca local salva; falhou sync na nuvem.",
        );
      }
    } catch (err) {
      console.error("[quotePdf]", err);
      onStatus?.(
        err instanceof Error
          ? `Erro ao gerar PDF: ${err.message}`
          : `Erro ao gerar PDF: ${String(err)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (skipAutoSave.current) {
      skipAutoSave.current = false;
      return;
    }
    if (!dirty) return;

    const timer = window.setTimeout(() => {
      const saved = persist(activeDraft?.status === "finalized" ? "finalized" : "draft");
      onStatus?.(`Salvo automaticamente · ${formatDraftDate(saved.updatedAt)}`);
    }, 900);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally debounce on quote/dirty only
  }, [quote, dirty]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-rosa/10 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink">
              Em andamento
              {openDrafts.length > 0 ? (
                <span className="ml-2 text-lg font-medium text-muted">({openDrafts.length})</span>
              ) : null}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Orçamentos ainda abertos. Salva sozinho neste navegador para continuar depois.
            </p>
          </div>
          <button
            type="button"
            onClick={startNew}
            className="admin-btn admin-btn-primary"
          >
            + Novo orçamento
          </button>
        </div>

        {openDrafts.length === 0 ? (
          <p className="rounded-2xl bg-cream/80 px-4 py-3 text-sm text-muted ring-1 ring-rosa/10">
            Nenhum rascunho em andamento. Preencha o formulário abaixo ou reutilize um da
            biblioteca.
          </p>
        ) : (
          <div className="space-y-2">
            {openDrafts.map((draft) => (
              <DraftRow
                key={draft.id}
                draft={draft}
                active={draft.id === draftId}
                mode="draft"
                onOpen={() => openDraft(draft)}
                onDelete={() => handleDeleteDraft(draft.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-rosa/10 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink">
              Biblioteca de orçamentos
              {library.length > 0 ? (
                <span className="ml-2 text-lg font-medium text-muted">({library.length})</span>
              ) : null}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Ao gerar o PDF, o orçamento entra aqui
              {cloudOn ? " (nuvem Supabase — qualquer aparelho)" : " (neste navegador)"}. Use{" "}
              <strong className="font-semibold text-ink">Reutilizar</strong> para copiar itens e
              preços para um novo cliente.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshLibrary()}
            className="admin-btn admin-btn-secondary admin-btn-sm"
          >
            Atualizar
          </button>
        </div>

        {libraryLoading ? (
          <p className="rounded-2xl bg-cream/80 px-4 py-3 text-sm text-muted ring-1 ring-rosa/10">
            Carregando biblioteca…
          </p>
        ) : library.length === 0 ? (
          <p className="rounded-2xl bg-olive-soft/60 px-4 py-3 text-sm text-muted ring-1 ring-olive/15">
            Ainda vazio. Clique em <strong className="text-ink">Finalizar e baixar PDF</strong> para
            guardar o orçamento aqui e reaproveitar depois.
          </p>
        ) : (
          <div className="space-y-2">
            {library.map((item) => (
              <LibraryRow
                key={item.id}
                item={item}
                onOpen={() => openLibraryItem(item)}
                onReuse={() => handleReuseLibrary(item)}
                onDelete={() => void handleDeleteLibrary(item)}
              />
            ))}
          </div>
        )}
      </div>

      <div
        id="quote-form-nav"
        onKeyDown={(e) =>
          handleQuoteFieldKeyDown(e, {
            onLastEnter: addItemAndFocusName,
          })
        }
        className="space-y-6"
      >
      <div
        id="quote-editor"
        className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-rosa/10 sm:p-6"
      >
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink">
              {draftId ? "Editar orçamento" : "Novo orçamento"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {dirty
                ? "Alterações pendentes — salvando automaticamente…"
                : lastSavedAt
                  ? `Salvo · ${formatDraftDate(lastSavedAt)}`
                  : "Preencha e salve para continuar depois."}
              {activeDraft?.status === "finalized"
                ? " · Já finalizado (pode gerar o PDF de novo)."
                : null}{" "}
              Use <strong className="font-semibold text-ink">Tab</strong> ou{" "}
              <strong className="font-semibold text-ink">Enter</strong> para ir ao próximo campo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={busy}
              className="admin-btn admin-btn-secondary"
            >
              Salvar rascunho
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={busy}
              className="admin-btn admin-btn-primary"
            >
              {busy ? "Gerando PDF…" : "Finalizar e baixar PDF"}
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm font-medium sm:col-span-2">
            Cliente
            <input
              value={quote.cliente}
              onChange={(e) => setField("cliente", e.target.value)}
              placeholder="Ex.: Rede Tintou"
              className="mt-1 w-full rounded-xl border border-rosa/15 bg-cream px-3 py-2.5 outline-none focus:border-rosa"
            />
          </label>
          <label className="block text-sm font-medium">
            Data
            <input
              value={quote.data}
              onChange={(e) => setField("data", e.target.value)}
              className="mt-1 w-full rounded-xl border border-rosa/15 bg-cream px-3 py-2.5 outline-none focus:border-rosa"
            />
          </label>
          <label className="block text-sm font-medium">
            Nº do orçamento
            <input
              value={quote.numero}
              onChange={(e) => setField("numero", e.target.value)}
              className="mt-1 w-full rounded-xl border border-rosa/15 bg-cream px-3 py-2.5 outline-none focus:border-rosa"
            />
          </label>
          <label className="block text-sm font-medium">
            Validade (dias)
            <input
              type="number"
              min={1}
              value={quote.validadeDias}
              onChange={(e) => setField("validadeDias", Math.max(1, Number(e.target.value) || 1))}
              className="mt-1 w-full rounded-xl border border-rosa/15 bg-cream px-3 py-2.5 outline-none focus:border-rosa"
            />
          </label>
          <label className="block text-sm font-medium">
            PIX / CNPJ
            <input
              value={quote.pix}
              onChange={(e) => setField("pix", e.target.value)}
              className="mt-1 w-full rounded-xl border border-rosa/15 bg-cream px-3 py-2.5 outline-none focus:border-rosa"
            />
          </label>
          <label className="block text-sm font-medium">
            Telefone
            <input
              value={quote.telefone}
              onChange={(e) => setField("telefone", e.target.value)}
              className="mt-1 w-full rounded-xl border border-rosa/15 bg-cream px-3 py-2.5 outline-none focus:border-rosa"
            />
          </label>
          <label className="block text-sm font-medium sm:col-span-2">
            Assinatura
            <input
              value={quote.assinatura}
              onChange={(e) => setField("assinatura", e.target.value)}
              className="mt-1 w-full rounded-xl border border-rosa/15 bg-cream px-3 py-2.5 outline-none focus:border-rosa"
            />
          </label>
          <label className="block text-sm font-medium sm:col-span-2 lg:col-span-4">
            Condição cartão
            <input
              value={quote.cartao}
              onChange={(e) => setField("cartao", e.target.value)}
              className="mt-1 w-full rounded-xl border border-rosa/15 bg-cream px-3 py-2.5 outline-none focus:border-rosa"
            />
          </label>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-rosa/10 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-xl font-semibold text-ink">Itens</h3>
          <button
            type="button"
            onClick={() => setField("itens", [...quote.itens, emptyQuoteItem()])}
            className="admin-btn admin-btn-primary"
          >
            + Adicionar item
          </button>
        </div>

        <div className="space-y-4">
          {quote.itens.map((item, index) => (
            <div key={item.id} className="rounded-2xl bg-cream/70 p-4 ring-1 ring-rosa/10">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rosa">
                  Item {index + 1}
                </p>
                <button
                  type="button"
                  disabled={quote.itens.length === 1}
                  onClick={() =>
                    setField(
                      "itens",
                      quote.itens.filter((row) => row.id !== item.id),
                    )
                  }
                  className="text-sm font-medium text-rosa-deep disabled:opacity-40"
                >
                  Remover
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
                <label className="block text-sm font-medium lg:col-span-3">
                  Nome
                  <input
                    value={item.nome}
                    onChange={(e) =>
                      setField("itens", updateItem(quote.itens, item.id, { nome: e.target.value }))
                    }
                    placeholder="Ex.: Tintinhos (Chaveiro)"
                    className="mt-1 w-full rounded-xl border border-rosa/15 bg-white px-3 py-2.5 outline-none focus:border-rosa"
                  />
                </label>
                <label className="block text-sm font-medium sm:col-span-2 lg:col-span-4">
                  Descrição
                  <input
                    value={item.descricao}
                    onChange={(e) =>
                      setField(
                        "itens",
                        updateItem(quote.itens, item.id, { descricao: e.target.value }),
                      )
                    }
                    placeholder="Ex.: Corpo verde e cabelo roxo."
                    className="mt-1 w-full rounded-xl border border-rosa/15 bg-white px-3 py-2.5 outline-none focus:border-rosa"
                  />
                </label>
                <label className="block text-sm font-medium lg:col-span-1">
                  Qtd
                  <input
                    type="number"
                    min={1}
                    value={item.quantidade}
                    onChange={(e) =>
                      setField(
                        "itens",
                        updateItem(quote.itens, item.id, {
                          quantidade: Math.max(1, Number(e.target.value) || 1),
                        }),
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-rosa/15 bg-white px-3 py-2.5 outline-none focus:border-rosa"
                  />
                </label>
                <label className="block text-sm font-medium lg:col-span-2">
                  Valor unit. (R$)
                  <input
                    inputMode="decimal"
                    defaultValue={formatMoneyInput(item.valorUnitario)}
                    key={`${item.id}-${item.valorUnitario}`}
                    onBlur={(e) =>
                      setField(
                        "itens",
                        updateItem(quote.itens, item.id, {
                          valorUnitario: parseMoneyInput(e.target.value),
                        }),
                      )
                    }
                    placeholder="0,00"
                    className="mt-1 w-full rounded-xl border border-rosa/15 bg-white px-3 py-2.5 outline-none focus:border-rosa"
                  />
                </label>
                <div className="lg:col-span-2">
                  <p className="text-sm font-medium">Total</p>
                  <p className="mt-2 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-rosa-deep ring-1 ring-rosa/10">
                    {formatBRL(lineTotal(item))}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <div className="min-w-[220px] overflow-hidden rounded-2xl bg-gradient-to-br from-rosa-deep to-rosa px-4 py-3 text-white shadow-[0_10px_24px_rgba(196,91,134,0.28)]">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">
              Valor total
            </p>
            <p className="mt-1 text-2xl font-semibold">{formatBRL(total)}</p>
          </div>
        </div>
      </div>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-rosa/10 sm:p-6">
        <h3 className="font-display text-xl font-semibold text-ink">Pré-visualização</h3>
        <p className="mt-1 text-sm text-muted">
          Resumo do que vai no PDF (o arquivo final usa o layout completo com logo).
        </p>

        <div className="mt-4 overflow-x-auto rounded-2xl ring-1 ring-rosa/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-rosa text-white">
              <tr>
                <th className="px-3 py-2 font-semibold">Item</th>
                <th className="px-3 py-2 font-semibold">Descrição</th>
                <th className="px-3 py-2 text-center font-semibold">Qtd</th>
                <th className="px-3 py-2 text-right font-semibold">Unit.</th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {quote.itens.map((item) => (
                <tr key={item.id} className="border-t border-rosa/10 odd:bg-blush/40">
                  <td className="px-3 py-2 font-medium">{item.nome || "—"}</td>
                  <td className="px-3 py-2 text-muted">{item.descricao || "—"}</td>
                  <td className="px-3 py-2 text-center">{item.quantidade}</td>
                  <td className="px-3 py-2 text-right">{formatBRL(item.valorUnitario)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatBRL(lineTotal(item))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <p>
            <span className="font-semibold text-ink">{quote.cliente || "Cliente"}</span>
            {" · "}
            {quote.numero}
            {" · "}
            {quote.data}
          </p>
          <p className="text-base font-semibold text-rosa-deep">Total {formatBRL(total)}</p>
        </div>
      </div>

      <ShippingPanel
        quote={quote}
        shipping={shipping}
        onChange={updateShipping}
        onStatus={onStatus}
      />
    </div>
  );
}

function LibraryRow({
  item,
  onOpen,
  onReuse,
  onDelete,
}: {
  item: QuoteLibraryItem;
  onOpen: () => void;
  onReuse: () => void;
  onDelete: () => void;
}) {
  const summaryDraft = {
    id: item.id,
    status: "finalized" as const,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    data: item.data,
  };

  return (
    <div className="admin-card flex flex-wrap items-center gap-3 rounded-2xl border border-olive/20 bg-olive-soft/40 p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink">{item.cliente || "Cliente sem nome"}</p>
        <p className="text-sm text-muted">
          {item.numero} · {draftSummary(summaryDraft)}
        </p>
        <p className="text-xs text-muted">Salvo {formatDraftDate(item.updatedAt)}</p>
      </div>
      <span className="rounded-full bg-olive-soft px-2.5 py-1 text-xs font-semibold text-olive ring-1 ring-olive/25">
        Biblioteca
      </span>
      <button type="button" onClick={onReuse} className="admin-btn admin-btn-primary admin-btn-sm">
        Reutilizar
      </button>
      <button type="button" onClick={onOpen} className="admin-btn admin-btn-secondary admin-btn-sm">
        Abrir
      </button>
      <button type="button" onClick={onDelete} className="admin-btn admin-btn-danger admin-btn-sm">
        Excluir
      </button>
    </div>
  );
}

function DraftRow({
  draft,
  active,
  mode,
  onOpen,
  onReuse,
  onDelete,
}: {
  draft: QuoteDraft;
  active: boolean;
  mode: "draft" | "library";
  onOpen: () => void;
  onReuse?: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`admin-card flex flex-wrap items-center gap-3 rounded-2xl border p-3 ${
        active ? "border-rosa/35 bg-blush/60" : "border-rosa/12 bg-cream/70"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink">{draftLabel(draft)}</p>
        <p className="text-sm text-muted">
          {draft.data.numero} · {draftSummary(draft)}
        </p>
        <p className="text-xs text-muted">
          {mode === "library" ? "Salvo" : "Atualizado"} {formatDraftDate(draft.updatedAt)}
        </p>
      </div>
      <span
        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
          mode === "draft" ? "bg-sand/80 text-ink" : "bg-olive-soft text-olive"
        }`}
      >
        {mode === "draft" ? "Em andamento" : "Biblioteca"}
      </span>
      {mode === "library" ? (
        <button
          type="button"
          onClick={onReuse}
          className="admin-btn admin-btn-primary admin-btn-sm"
        >
          Reutilizar
        </button>
      ) : null}
      <button
        type="button"
        onClick={onOpen}
        className="admin-btn admin-btn-secondary admin-btn-sm"
      >
        {mode === "library" ? "Abrir" : "Continuar"}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="admin-btn admin-btn-danger admin-btn-sm"
      >
        Excluir
      </button>
    </div>
  );
}
