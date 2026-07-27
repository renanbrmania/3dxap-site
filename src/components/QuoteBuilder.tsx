import { useMemo, useState } from "react";
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

type Props = {
  onStatus?: (message: string) => void;
};

function updateItem(items: QuoteItem[], id: string, patch: Partial<QuoteItem>): QuoteItem[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

export function QuoteBuilder({ onStatus }: Props) {
  const [quote, setQuote] = useState<QuoteData>(() => createDefaultQuote());
  const [busy, setBusy] = useState(false);

  const total = useMemo(() => quoteTotal(quote.itens), [quote.itens]);

  function setField<K extends keyof QuoteData>(key: K, value: QuoteData[K]) {
    setQuote((prev) => ({ ...prev, [key]: value }));
  }

  function clearForm() {
    setQuote(createDefaultQuote());
    onStatus?.("Formulário limpo.");
  }

  async function handleDownload() {
    setBusy(true);
    onStatus?.("");
    try {
      await downloadQuotePdf(quote);
      onStatus?.("PDF baixado com sucesso.");
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

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-rosa/10 sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink">Novo orçamento</h2>
            <p className="mt-1 text-sm text-muted">
              Preencha os dados e baixe o PDF com o layout profissional da 3DXAP.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={clearForm}
              disabled={busy}
              className="rounded-full bg-cream px-4 py-2 text-sm font-semibold ring-1 ring-rosa/15 disabled:opacity-50"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={busy}
              className="rounded-full bg-rosa px-5 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(196,91,134,0.25)] disabled:opacity-50"
            >
              {busy ? "Gerando PDF…" : "Baixar PDF"}
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
            className="rounded-full bg-rosa px-4 py-2 text-sm font-semibold text-white"
          >
            + Adicionar item
          </button>
        </div>

        <div className="space-y-4">
          {quote.itens.map((item, index) => (
            <div
              key={item.id}
              className="rounded-2xl bg-cream/70 p-4 ring-1 ring-rosa/10"
            >
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
    </div>
  );
}
