import { useEffect, useMemo, useState } from "react";
import {
  filterLabelsByRange,
  labelArchiveCloudEnabled,
  listLabelArchive,
  markLabelsPrinted,
  removeLabelArchive,
  upsertLabelArchive,
  type LabelArchiveItem,
} from "../lib/labelArchive";
import {
  extractPrintUrl,
  fetchPrintPdf,
  fetchZplText,
  loadMeTokens,
  printerAgentDiscoverTimed,
  printerAgentHealth,
  printerAgentPrintTest,
  printerAgentPrintZpl,
} from "../lib/melhorEnvio";
import { extractShippingLabelZpl } from "../lib/zplLabel";
import { buildZip, downloadBlob } from "../lib/zipDownload";

type Props = {
  onStatus?: (message: string) => void;
};

type Range = "today" | "7d" | "all";

function sleep(ms: number) {
  return new Promise((r) => window.setTimeout(r, ms));
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function LabelPrintQueue({ onStatus }: Props) {
  const [items, setItems] = useState<LabelArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [localMsg, setLocalMsg] = useState("");
  const [range, setRange] = useState<Range>("today");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);
  const meConnected = Boolean(loadMeTokens()?.access_token);
  const cloudOn = labelArchiveCloudEnabled();

  const visible = useMemo(() => filterLabelsByRange(items, range), [items, range]);

  function notify(message: string) {
    setLocalMsg(message);
    onStatus?.(message);
  }

  async function refresh() {
    setLoading(true);
    try {
      setItems(await listLabelArchive());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    printerAgentHealth()
      .then(() => setAgentOnline(true))
      .catch(() => setAgentOnline(false));
  }, []);

  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(visible.map((i) => i.id));
      return new Set([...prev].filter((id) => ids.has(id)));
    });
  }, [visible]);

  async function handleTestPrinter() {
    setTesting(true);
    notify("Testando agent e buscando a Elgin na rede… pode levar alguns segundos.");
    try {
      await printerAgentHealth();
      setAgentOnline(true);
      notify("Agent online. Procurando impressora…");
      const printer = await printerAgentDiscoverTimed(30000);
      notify(`Elgin encontrada: ${printer.ip}:${printer.port || 9100}. Enviando etiqueta de teste…`);
      const printed = await printerAgentPrintTest();
      notify(
        `Teste OK — etiqueta enviada para ${printed.printedOn?.ip || printer.ip}. Confira a Elgin.`,
      );
    } catch (err) {
      setAgentOnline(false);
      notify(err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected(new Set(visible.map((i) => i.id)));
  }

  function selectPending() {
    setSelected(new Set(visible.filter((i) => i.status === "pronta").map((i) => i.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  const selectedItems = visible.filter((i) => selected.has(i.id));

  async function handlePrintBatch() {
    if (!selectedItems.length) {
      notify("Selecione ao menos uma etiqueta.");
      return;
    }
    setBusy(true);
    notify("Conectando ao agent da Elgin…");
    try {
      await printerAgentHealth();
      setAgentOnline(true);
      const printedIds: string[] = [];
      for (let i = 0; i < selectedItems.length; i++) {
        const item = selectedItems[i];
        notify(`Preparando ${i + 1}/${selectedItems.length} para a Elgin (100×150)…`);
        // Sempre regenera ZPL a partir do JPEG do ME — sizing certo e sem Z64
        const zpl = extractShippingLabelZpl(await fetchZplText(item.id));
        if (!zpl.trim()) throw new Error(`Etiqueta ${item.quoteNumero || item.id}: ZPL invalido.`);
        await upsertLabelArchive({ id: item.id, zpl, status: item.status });
        notify(`Imprimindo ${i + 1}/${selectedItems.length}: ${item.cliente || item.quoteNumero || item.id}…`);
        await printerAgentPrintZpl(zpl);
        printedIds.push(item.id);
        await sleep(400);
      }
      await markLabelsPrinted(printedIds);
      await refresh();
      notify(`${printedIds.length} etiqueta(s) enviada(s) à Elgin. Confira se saiu papel na impressora.`);
      clearSelection();
    } catch (err) {
      setAgentOnline(false);
      notify(err instanceof Error ? err.message : String(err));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function handleDownloadZip() {
    if (!selectedItems.length) {
      notify("Selecione ao menos uma etiqueta.");
      return;
    }
    const files = selectedItems.map((item, idx) => ({
      name: `${String(idx + 1).padStart(2, "0")}-${item.quoteNumero || item.id}-${item.destCep || "cep"}.zpl`,
      content: extractShippingLabelZpl(item.zpl),
    }));
    const zip = buildZip(files);
    const day = new Date().toISOString().slice(0, 10);
    downloadBlob(zip, `etiquetas-3dxap-${day}.zip`);
    notify(`ZIP com ${files.length} ZPL baixado (backup).`);
  }

  async function handleDownloadPdf() {
    if (!selectedItems.length) {
      notify("Selecione ao menos uma etiqueta.");
      return;
    }
    if (!meConnected) {
      notify("Conecte o Melhor Envio na aba Envios para baixar o PDF.");
      return;
    }
    setBusy(true);
    notify("");
    try {
      const result = await fetchPrintPdf(selectedItems.map((i) => i.id));
      const url = extractPrintUrl(result.data);
      if (!url) throw new Error("Melhor Envio não retornou URL do PDF.");
      window.open(url, "_blank", "noopener,noreferrer");
      notify("PDF do Melhor Envio aberto — use como backup ou impressão manual.");
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(item: LabelArchiveItem) {
    if (!confirm(`Remover etiqueta ${item.quoteNumero || item.id} do arquivo?`)) return;
    await removeLabelArchive(item.id);
    await refresh();
    notify("Etiqueta removida do arquivo.");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-rosa/10 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink">Impressão de etiquetas</h2>
            <p className="mt-1 text-sm text-muted">
              Selecione várias vendas do dia e imprima em lote na Elgin, ou baixe ZPL/PDF de backup.
              {cloudOn ? " Arquivo também na nuvem (Supabase)." : " Arquivo neste navegador."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={testing || busy}
              onClick={() => void handleTestPrinter()}
              className="admin-btn admin-btn-olive"
            >
              {testing ? "Testando…" : "Testar impressora"}
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              className="admin-btn admin-btn-secondary admin-btn-sm"
            >
              Atualizar
            </button>
          </div>
        </div>

        {localMsg ? (
          <p className="mb-4 rounded-2xl bg-blush/80 px-4 py-3 text-sm font-medium text-ink ring-1 ring-rosa/20">
            {localMsg}
          </p>
        ) : null}

        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <span
            className={`rounded-full px-2.5 py-1 font-semibold ${
              agentOnline ? "bg-olive-soft text-olive" : "bg-sand/80 text-ink"
            }`}
          >
            Elgin agent: {agentOnline == null ? "…" : agentOnline ? "online" : "offline"}
          </span>
          {agentOnline === false ? (
            <span className="rounded-full bg-sand/80 px-2.5 py-1 font-semibold text-rosa-deep">
              Abra o iniciar-agent.bat no PC da impressora
            </span>
          ) : null}
          <span
            className={`rounded-full px-2.5 py-1 font-semibold ${
              meConnected ? "bg-olive-soft text-olive" : "bg-sand/80 text-ink"
            }`}
          >
            ME: {meConnected ? "conectado" : "desconectado"}
          </span>
          <span className="rounded-full bg-blush px-2.5 py-1 font-semibold text-rosa-deep">
            {selectedItems.length} selecionada(s)
          </span>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              ["today", "Hoje"],
              ["7d", "7 dias"],
              ["all", "Todas"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={`admin-tab ${range === key ? "admin-tab-active" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <button type="button" onClick={selectAllVisible} className="admin-btn admin-btn-secondary admin-btn-sm">
            Selecionar todas
          </button>
          <button type="button" onClick={selectPending} className="admin-btn admin-btn-secondary admin-btn-sm">
            Só não impressas
          </button>
          <button type="button" onClick={clearSelection} className="admin-btn admin-btn-secondary admin-btn-sm">
            Limpar seleção
          </button>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !selectedItems.length}
            onClick={() => void handlePrintBatch()}
            className="admin-btn admin-btn-primary"
          >
            {busy ? "Imprimindo…" : "Imprimir selecionadas na Elgin"}
          </button>
          <button
            type="button"
            disabled={busy || !selectedItems.length}
            onClick={handleDownloadZip}
            className="admin-btn admin-btn-olive"
          >
            Baixar ZPL (ZIP)
          </button>
          <button
            type="button"
            disabled={busy || !selectedItems.length}
            onClick={() => void handleDownloadPdf()}
            className="admin-btn admin-btn-secondary"
          >
            Baixar PDF (Melhor Envio)
          </button>
        </div>
        <p className="text-xs text-muted">
          Impressão térmica: apenas a etiqueta de frete. O PDF do ME pode incluir declaração — use o
          site do ME se precisar dos extras.
        </p>

        {loading ? (
          <p className="rounded-2xl bg-cream/80 px-4 py-3 text-sm text-muted">Carregando arquivo…</p>
        ) : visible.length === 0 ? (
          <p className="rounded-2xl bg-cream/80 px-4 py-3 text-sm text-muted ring-1 ring-rosa/10">
            Nenhuma etiqueta neste filtro. Gere fretes no orçamento (com ou sem imprimir agora) — elas
            aparecem aqui.
          </p>
        ) : (
          <div className="space-y-2">
            {visible.map((item) => {
              const checked = selected.has(item.id);
              return (
                <label
                  key={item.id}
                  className={`admin-card flex cursor-pointer flex-wrap items-center gap-3 rounded-2xl border p-3 ${
                    checked ? "border-rosa/40 bg-blush/50" : "border-rosa/12 bg-cream/60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(item.id)}
                    className="h-4 w-4 accent-[var(--color-rosa)]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">
                      {item.cliente || item.destName || "Sem cliente"}
                      {item.quoteNumero ? (
                        <span className="ml-2 font-medium text-muted">· {item.quoteNumero}</span>
                      ) : null}
                    </p>
                    <p className="text-sm text-muted">
                      {[item.carrier, item.service].filter(Boolean).join(" — ") || "Frete"}
                      {item.destCep ? ` · CEP ${item.destCep}` : ""}
                      {item.destName ? ` · ${item.destName}` : ""}
                    </p>
                    <p className="text-xs text-muted">
                      {formatWhen(item.createdAt)}
                      {item.printedAt ? ` · impressa ${formatWhen(item.printedAt)}` : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      item.status === "impressa"
                        ? "bg-olive-soft text-olive"
                        : "bg-sand/80 text-ink"
                    }`}
                  >
                    {item.status === "impressa" ? "Impressa" : "Pronta"}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      void handleDelete(item);
                    }}
                    className="admin-btn admin-btn-danger admin-btn-sm"
                  >
                    Excluir
                  </button>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
