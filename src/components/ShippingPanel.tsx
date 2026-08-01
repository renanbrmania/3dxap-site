import { useEffect, useState } from "react";
import {
  addToCart,
  calculateShipping,
  checkoutOrders,
  emptyRecipient,
  fetchZplTextWithRetry,
  generateOrders,
  getAuthorizeUrl,
  getMeConfig,
  loadMeTokens,
  clearMeTokens,
  onlyDigits,
  printerAgentHealth,
  printerAgentPrintZpl,
  waitForOrderStatus,
  type MeQuoteOption,
  type ShippingState,
  type ShipRecipient,
} from "../lib/melhorEnvio";
import { parseNfeFile } from "../lib/nfeXml";
import { loadShipperProfile } from "../lib/shipperProfile";
import { upsertLabelArchive } from "../lib/labelArchive";
import { formatBRL, quoteTotal, type QuoteData } from "../lib/quotePdf";

type Props = {
  quote: QuoteData;
  shipping: ShippingState;
  onChange: (next: ShippingState) => void;
  onStatus?: (message: string) => void;
};

function money(value: string | number | undefined) {
  const n = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function ShippingPanel({ quote, shipping, onChange, onStatus }: Props) {
  const [busy, setBusy] = useState(false);
  const [meConnected, setMeConnected] = useState(Boolean(loadMeTokens()?.access_token));
  const [meConfigured, setMeConfigured] = useState(false);
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);

  useEffect(() => {
    getMeConfig()
      .then((cfg) => setMeConfigured(Boolean(cfg.configured || cfg.clientIdConfigured)))
      .catch(() => setMeConfigured(false));
    printerAgentHealth()
      .then(() => setAgentOnline(true))
      .catch(() => setAgentOnline(false));
  }, []);

  function patch(partial: Partial<ShippingState>) {
    onChange({
      ...shipping,
      ...partial,
      updatedAt: new Date().toISOString(),
    });
  }

  async function connectMe() {
    try {
      const { url } = await getAuthorizeUrl("3dxap-admin");
      window.location.href = url;
    } catch (err) {
      onStatus?.(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleCalculate() {
    setBusy(true);
    onStatus?.("");
    try {
      const shipper = loadShipperProfile();
      const fromCep = onlyDigits(shipper.postal_code);
      const toCep = onlyDigits(shipping.destCep);
      if (fromCep.length !== 8) throw new Error("Cadastre o CEP de origem em Remetente 3DXAP.");
      if (toCep.length !== 8) throw new Error("Informe o CEP de destino (8 dígitos).");

      const payload = {
        from: { postal_code: fromCep },
        to: { postal_code: toCep },
        volumes: [
          {
            height: shipping.heightCm,
            width: shipping.widthCm,
            length: shipping.lengthCm,
            weight: shipping.weightKg,
          },
        ],
        options: {
          receipt: false,
          own_hand: false,
          insurance_value: quoteTotal(quote.itens),
        },
      };

      const result = await calculateShipping(payload);
      const list = (Array.isArray(result.data) ? result.data : []) as MeQuoteOption[];
      const valid = list.filter((q) => !q.error && q.id);
      patch({
        quotes: valid,
        status: valid.length ? "cotado" : shipping.status,
        selectedServiceId: valid[0]?.id ?? null,
        selectedQuote: valid[0] ?? null,
        lastError: valid.length ? "" : "Nenhuma cotação disponível para esses dados.",
      });
      onStatus?.(
        valid.length
          ? `${valid.length} opções de frete encontradas.`
          : "Cotação sem opções. Confira CEP e medidas.",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      patch({ lastError: msg });
      onStatus?.(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleXml(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const parsed = await parseNfeFile(file);
      const recipient: ShipRecipient = {
        ...emptyRecipient(),
        ...parsed.recipient,
        postal_code: parsed.recipient.postal_code || onlyDigits(shipping.destCep),
      };
      patch({
        recipient,
        products: parsed.products,
        invoiceKey: parsed.key,
        invoiceXmlContent: parsed.xmlContent,
        destCep: recipient.postal_code || shipping.destCep,
        status: "aguardando_nf",
        lastError: "",
      });
      onStatus?.("XML da NF importado. Confira o destinatário e finalize o envio.");
    } catch (err) {
      onStatus?.(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleBuyLabel(printNow: boolean) {
    setBusy(true);
    onStatus?.("");
    try {
      if (!shipping.selectedQuote?.id) throw new Error("Selecione uma opção de frete.");
      if (!shipping.invoiceKey) throw new Error("Importe o XML da NF antes de comprar a etiqueta.");
      const recipient = shipping.recipient;
      if (!recipient?.name || !recipient.postal_code) {
        throw new Error("Destinatário incompleto. Importe o XML ou preencha os dados.");
      }
      if (!recipient.document && !recipient.company_document) {
        throw new Error("Informe CPF ou CNPJ do destinatário.");
      }

      const shipper = loadShipperProfile();
      const products =
        shipping.products.length > 0
          ? shipping.products
          : quote.itens
              .filter((i) => i.nome.trim())
              .map((i) => ({
                name: i.nome,
                quantity: i.quantidade,
                unitary_value: i.valorUnitario,
              }));

      const cartPayload = {
        service: shipping.selectedQuote.id,
        from: {
          name: shipper.name,
          email: shipper.email,
          phone: onlyDigits(shipper.phone),
          company_document: onlyDigits(shipper.company_document),
          state_register: shipper.state_register || "ISENTO",
          economic_activity_code: shipper.economic_activity_code || undefined,
          address: shipper.address,
          complement: shipper.complement,
          number: shipper.number,
          district: shipper.district,
          city: shipper.city,
          postal_code: onlyDigits(shipper.postal_code),
          state_abbr: shipper.state_abbr,
        },
        to: {
          name: recipient.name,
          email: recipient.email,
          phone: onlyDigits(recipient.phone),
          document: recipient.document || "",
          company_document: recipient.company_document || "",
          state_register: recipient.state_register || "ISENTO",
          address: recipient.address,
          complement: recipient.complement,
          number: recipient.number,
          district: recipient.district,
          city: recipient.city,
          postal_code: onlyDigits(recipient.postal_code),
          state_abbr: recipient.state_abbr,
          country_id: "BR",
        },
        products,
        volumes: [
          {
            height: shipping.heightCm,
            width: shipping.widthCm,
            length: shipping.lengthCm,
            weight: shipping.weightKg,
          },
        ],
        options: {
          insurance_value: quoteTotal(quote.itens) || money(shipping.selectedQuote.price),
          receipt: false,
          own_hand: false,
          reverse: false,
          platform: "3DXAP",
          reminder: quote.numero,
          invoice: {
            key: shipping.invoiceKey,
            xml_content: shipping.invoiceXmlContent || "",
          },
          tags: [{ tag: quote.numero, url: null }],
        },
      };

      const cart = await addToCart(cartPayload);
      const cartId = String(cart.data?.id || "");
      if (!cartId) throw new Error("Carrinho ME sem id de retorno.");

      onStatus?.("Frete no carrinho. Pagando no Melhor Envio…");
      await checkoutOrders([cartId]);

      onStatus?.("Pagamento ok. Aguardando liberacao…");
      await waitForOrderStatus(cartId, ["released", "generated"], {
        attempts: 15,
        intervalMs: 1200,
      });

      onStatus?.("Gerando etiqueta…");
      await generateOrders([cartId]);

      onStatus?.("Etiqueta gerada. Baixando ZPL…");
      await waitForOrderStatus(cartId, ["generated"], {
        attempts: 20,
        intervalMs: 1500,
      });

      const zpl = await fetchZplTextWithRetry(cartId);
      const q = shipping.selectedQuote;

      await upsertLabelArchive({
        id: String(cartId),
        quoteNumero: quote.numero,
        cliente: quote.cliente,
        carrier: q.company?.name || "",
        service: q.name || "",
        destName: recipient.name,
        destCep: onlyDigits(recipient.postal_code),
        zpl,
        status: "pronta",
      });

      patch({
        meCartId: cartId,
        meOrderId: cartId,
        status: "etiqueta_gerada",
        zplUrl: "",
        lastError: "",
      });

      if (!printNow) {
        onStatus?.(
          "Etiqueta gerada e guardada na fila Impressão. Imprima em lote quando quiser.",
        );
        return;
      }

      try {
        await printerAgentHealth();
        const printed = await printerAgentPrintZpl(zpl);
        await upsertLabelArchive({
          id: String(cartId),
          zpl,
          status: "impressa",
          printedAt: new Date().toISOString(),
        });
        patch({
          meCartId: cartId,
          meOrderId: cartId,
          status: "impresso",
        });
        onStatus?.(
          `Etiqueta gerada, arquivada e enviada à Elgin (${printed.printedOn?.ip || "rede local"}).`,
        );
      } catch (printErr) {
        const blob = new Blob([zpl], { type: "text/plain" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `etiqueta-${quote.numero || cartId}.zpl`;
        a.click();
        onStatus?.(
          `Etiqueta arquivada na fila. Agent offline — ZPL baixado. ${printErr instanceof Error ? printErr.message : ""}`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      patch({ lastError: msg });
      onStatus?.(msg);
    } finally {
      setBusy(false);
    }
  }

  const selected = shipping.quotes.find((q) => q.id === shipping.selectedServiceId) || null;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-rosa/10 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink">Envio Melhor Envio</h2>
            <p className="mt-1 text-sm text-muted">
              Cotação sem NF para passar o valor ao cliente. XML da nota só no final, na hora de
              comprar e imprimir.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {meConnected ? (
              <button
                type="button"
                onClick={() => {
                  clearMeTokens();
                  setMeConnected(false);
                  onStatus?.("Melhor Envio desconectado.");
                }}
                className="admin-btn admin-btn-secondary"
              >
                Desconectar ME
              </button>
            ) : (
              <button
                type="button"
                onClick={connectMe}
                className="admin-btn admin-btn-primary"
              >
                Conectar Melhor Envio
              </button>
            )}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <span className={`rounded-full px-2.5 py-1 font-semibold ${meConnected ? "bg-olive-soft text-olive" : "bg-sand/80 text-ink"}`}>
            ME: {meConnected ? "conectado" : "desconectado"}
          </span>
          <span className={`rounded-full px-2.5 py-1 font-semibold ${meConfigured ? "bg-olive-soft text-olive" : "bg-sand/80 text-ink"}`}>
            App: {meConfigured ? "configurado" : "faltam credenciais"}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 font-semibold ${
              agentOnline ? "bg-olive-soft text-olive" : "bg-sand/80 text-ink"
            }`}
          >
            Elgin agent: {agentOnline == null ? "…" : agentOnline ? "online" : "offline"}
          </span>
          <span className="rounded-full bg-blush px-2.5 py-1 font-semibold text-rosa-deep">
            Status: {shipping.status}
          </span>
        </div>

        {!meConfigured ? (
          <p className="rounded-2xl bg-cream/80 px-4 py-3 text-sm text-muted ring-1 ring-rosa/10">
            Configure no Vercel/local: <code>ME_CLIENT_ID</code>, <code>ME_CLIENT_SECRET</code>,{" "}
            <code>ME_REDIRECT_URI</code> (sandbox) e depois conecte a conta.
          </p>
        ) : null}
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-rosa/10 sm:p-6">
        <h3 className="font-display text-xl font-semibold text-ink">1. Cotar frete (sem NF)</h3>
        <p className="mt-1 text-sm text-muted">
          Use só para consultar preço/prazo e passar ao cliente no WhatsApp.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block text-sm font-medium lg:col-span-2">
            CEP destino
            <input
              value={shipping.destCep}
              onChange={(e) => patch({ destCep: onlyDigits(e.target.value).slice(0, 8) })}
              placeholder="89800000"
              className="mt-1 w-full rounded-xl border border-rosa/15 bg-cream px-3 py-2.5 outline-none focus:border-rosa"
            />
          </label>
          <label className="block text-sm font-medium">
            Peso (kg)
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={shipping.weightKg}
              onChange={(e) => patch({ weightKg: Number(e.target.value) || 0.01 })}
              className="mt-1 w-full rounded-xl border border-rosa/15 bg-cream px-3 py-2.5 outline-none focus:border-rosa"
            />
          </label>
          <label className="block text-sm font-medium">
            A (cm)
            <input
              type="number"
              min={1}
              value={shipping.heightCm}
              onChange={(e) => patch({ heightCm: Number(e.target.value) || 1 })}
              className="mt-1 w-full rounded-xl border border-rosa/15 bg-cream px-3 py-2.5 outline-none focus:border-rosa"
            />
          </label>
          <label className="block text-sm font-medium">
            L (cm)
            <input
              type="number"
              min={1}
              value={shipping.widthCm}
              onChange={(e) => patch({ widthCm: Number(e.target.value) || 1 })}
              className="mt-1 w-full rounded-xl border border-rosa/15 bg-cream px-3 py-2.5 outline-none focus:border-rosa"
            />
          </label>
          <label className="block text-sm font-medium">
            C (cm)
            <input
              type="number"
              min={1}
              value={shipping.lengthCm}
              onChange={(e) => patch({ lengthCm: Number(e.target.value) || 1 })}
              className="mt-1 w-full rounded-xl border border-rosa/15 bg-cream px-3 py-2.5 outline-none focus:border-rosa"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !meConnected}
            onClick={handleCalculate}
            className="admin-btn admin-btn-primary"
          >
            {busy ? "Cotando…" : "Cotar frete"}
          </button>
        </div>

        {shipping.quotes.length > 0 ? (
          <div className="mt-4 space-y-2">
            {shipping.quotes.map((q) => {
              const active = q.id === shipping.selectedServiceId;
              const price = money(q.custom_price ?? q.price);
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() =>
                    patch({
                      selectedServiceId: q.id,
                      selectedQuote: q,
                      status: shipping.invoiceKey ? shipping.status : "aguardando_nf",
                    })
                  }
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                    active
                      ? "border-rosa/40 bg-blush/80 shadow-[0_8px_18px_rgba(196,91,134,0.16)]"
                      : "border-rosa/15 bg-cream/70 hover:border-rosa/35 hover:bg-white"
                  }`}
                >
                  <div>
                    <p className="font-semibold text-ink">
                      {q.company?.name ? `${q.company.name} — ` : ""}
                      {q.name}
                    </p>
                    <p className="text-sm text-muted">
                      Prazo: {q.delivery_time ?? q.delivery_range?.max ?? "—"} dia(s)
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-rosa-deep">{formatBRL(price)}</p>
                </button>
              );
            })}
            {selected ? (
              <p className="text-sm text-muted">
                Selecionado: <strong className="text-ink">{selected.name}</strong> — passe este valor
                ao cliente. A NF entra só na etapa 2.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-rosa/10 sm:p-6">
        <h3 className="font-display text-xl font-semibold text-ink">
          2. Finalizar envio (com NF) + imprimir
        </h3>
        <p className="mt-1 text-sm text-muted">
          Depois que a cliente fechar e a NF for emitida no app MEI, importe o XML, confira e
          compre a etiqueta.
        </p>

        <div className="mt-4">
          <label className="block text-sm font-medium">
            XML da NF-e
            <input
              type="file"
              accept=".xml,text/xml,application/xml"
              onChange={(e) => handleXml(e.target.files)}
              className="mt-1 block w-full cursor-pointer text-sm text-olive file:mr-3 file:cursor-pointer file:rounded-full file:border file:border-olive/40 file:bg-olive file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white file:shadow-[0_6px_14px_rgba(111,129,100,0.28)] hover:file:-translate-y-0.5 hover:file:brightness-105 file:transition"
            />
          </label>
        </div>

        {shipping.invoiceKey ? (
          <p className="mt-3 text-sm text-muted">
            Chave NF: <span className="font-mono text-ink">{shipping.invoiceKey}</span>
          </p>
        ) : null}

        {shipping.recipient ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["name", "Nome"],
                ["document", "CPF"],
                ["company_document", "CNPJ"],
                ["phone", "Telefone"],
                ["postal_code", "CEP"],
                ["address", "Rua"],
                ["number", "Número"],
                ["district", "Bairro"],
                ["city", "Cidade"],
                ["state_abbr", "UF"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm font-medium">
                {label}
                <input
                  value={shipping.recipient?.[key] || ""}
                  onChange={(e) =>
                    patch({
                      recipient: {
                        ...(shipping.recipient || emptyRecipient()),
                        [key]: e.target.value,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-rosa/15 bg-cream px-3 py-2.5 outline-none focus:border-rosa"
                />
              </label>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl bg-cream/80 px-4 py-3 text-sm text-muted ring-1 ring-rosa/10">
            Ainda sem XML. Cotação pode ser feita na etapa 1; a compra da etiqueta espera a NF.
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !meConnected || !shipping.selectedQuote || !shipping.invoiceKey}
            onClick={() => void handleBuyLabel(true)}
            className="admin-btn admin-btn-primary"
          >
            {busy ? "Processando…" : "Comprar, gerar e imprimir na Elgin"}
          </button>
          <button
            type="button"
            disabled={busy || !meConnected || !shipping.selectedQuote || !shipping.invoiceKey}
            onClick={() => void handleBuyLabel(false)}
            className="admin-btn admin-btn-olive"
          >
            Só gerar e guardar (imprimir depois)
          </button>
        </div>

        {shipping.lastError ? (
          <p className="mt-3 text-sm font-medium text-rosa-deep">{shipping.lastError}</p>
        ) : null}
        {shipping.meOrderId ? (
          <p className="mt-2 text-sm text-muted">
            Pedido ME: <span className="font-mono text-ink">{shipping.meOrderId}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
