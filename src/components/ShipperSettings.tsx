import { useEffect, useState, type FormEvent } from "react";
import {
  clearMeTokens,
  getAuthorizeUrl,
  getMeConfig,
  loadMeTokens,
  onlyDigits,
  printerAgentDiscover,
  printerAgentHealth,
  PRINTER_AGENT_URL,
} from "../lib/melhorEnvio";
import {
  defaultShipperProfile,
  loadShipperProfile,
  saveShipperProfile,
  type ShipperProfile,
} from "../lib/shipperProfile";

type Props = {
  onStatus?: (message: string) => void;
};

export function ShipperSettings({ onStatus }: Props) {
  const [profile, setProfile] = useState<ShipperProfile>(() => loadShipperProfile());
  const [meConnected, setMeConnected] = useState(Boolean(loadMeTokens()?.access_token));
  const [meConfigured, setMeConfigured] = useState(false);
  const [meEnv, setMeEnv] = useState("sandbox");
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);
  const [agentIp, setAgentIp] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getMeConfig()
      .then((cfg) => {
        setMeConfigured(Boolean(cfg.configured || cfg.clientIdConfigured));
        setMeEnv(cfg.env || "sandbox");
      })
      .catch(() => setMeConfigured(false));
    printerAgentHealth()
      .then(() => setAgentOnline(true))
      .catch(() => setAgentOnline(false));
  }, []);

  function setField<K extends keyof ShipperProfile>(key: K, value: ShipperProfile[K]) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave(e: FormEvent) {
    e.preventDefault();
    const next = {
      ...profile,
      phone: onlyDigits(profile.phone),
      company_document: onlyDigits(profile.company_document),
      postal_code: onlyDigits(profile.postal_code).slice(0, 8),
      state_abbr: profile.state_abbr.toUpperCase().slice(0, 2),
    };
    saveShipperProfile(next);
    setProfile(next);
    onStatus?.("Remetente 3DXAP salvo neste aparelho.");
  }

  async function connectMe() {
    try {
      const { url } = await getAuthorizeUrl("3dxap-admin");
      window.location.href = url;
    } catch (err) {
      onStatus?.(err instanceof Error ? err.message : String(err));
    }
  }

  async function testPrinter() {
    setBusy(true);
    try {
      await printerAgentHealth();
      const printer = await printerAgentDiscover();
      setAgentOnline(true);
      setAgentIp(printer.ip || "");
      onStatus?.(`Elgin encontrada em ${printer.ip}:${printer.port || 9100}`);
    } catch (err) {
      setAgentOnline(false);
      setAgentIp("");
      onStatus?.(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-rosa/10 sm:p-6">
        <h2 className="font-display text-2xl font-semibold text-ink">Envios</h2>
        <p className="mt-1 text-sm text-muted">
          Conecte o Melhor Envio (sandbox), cadastre o remetente MEI uma vez e deixe o printer-agent
          rodando no PC da Paula (mesma rede da Elgin).
        </p>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span
            className={`rounded-full px-2.5 py-1 font-semibold ${
              meConnected ? "bg-olive-soft text-olive" : "bg-sand/80 text-ink"
            }`}
          >
            ME: {meConnected ? "conectado" : "desconectado"}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 font-semibold ${
              meConfigured ? "bg-olive-soft text-olive" : "bg-sand/80 text-ink"
            }`}
          >
            App ({meEnv}): {meConfigured ? "ok" : "faltam credenciais"}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 font-semibold ${
              agentOnline ? "bg-olive-soft text-olive" : "bg-sand/80 text-ink"
            }`}
          >
            Agent: {agentOnline == null ? "…" : agentOnline ? `online${agentIp ? ` · ${agentIp}` : ""}` : "offline"}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {meConnected ? (
            <button
              type="button"
              onClick={() => {
                clearMeTokens();
                setMeConnected(false);
                onStatus?.("Melhor Envio desconectado.");
              }}
              className="rounded-full bg-cream px-4 py-2 text-sm font-semibold ring-1 ring-rosa/15"
            >
              Desconectar Melhor Envio
            </button>
          ) : (
            <button
              type="button"
              onClick={connectMe}
              className="rounded-full bg-rosa px-4 py-2 text-sm font-semibold text-white"
            >
              Conectar Melhor Envio
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={testPrinter}
            className="rounded-full bg-cream px-4 py-2 text-sm font-semibold ring-1 ring-rosa/15 disabled:opacity-50"
          >
            {busy ? "Testando…" : "Testar Elgin (agent local)"}
          </button>
        </div>

        <p className="mt-4 text-xs text-muted">
          No PC da Paula: pasta <code className="rounded bg-cream px-1">printer-agent</code> →{" "}
          <code className="rounded bg-cream px-1">npm start</code> →{" "}
          <code className="rounded bg-cream px-1">{PRINTER_AGENT_URL}</code>
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-rosa/10 sm:p-6"
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-semibold text-ink">Remetente 3DXAP (MEI)</h3>
            <p className="mt-1 text-sm text-muted">
              Usado na cotação (CEP origem) e na compra da etiqueta. Salvo neste navegador.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setProfile(defaultShipperProfile())}
            className="rounded-full bg-cream px-3 py-1.5 text-sm font-semibold ring-1 ring-rosa/15"
          >
            Restaurar padrão
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["name", "Nome / razão social"],
              ["email", "E-mail"],
              ["phone", "Telefone"],
              ["company_document", "CNPJ"],
              ["state_register", "IE"],
              ["economic_activity_code", "CNAE (opcional)"],
              ["postal_code", "CEP"],
              ["address", "Rua"],
              ["number", "Número"],
              ["complement", "Complemento"],
              ["district", "Bairro"],
              ["city", "Cidade"],
              ["state_abbr", "UF"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-sm font-medium">
              {label}
              <input
                value={profile[key]}
                onChange={(e) => setField(key, e.target.value)}
                className="mt-1 w-full rounded-xl border border-rosa/15 bg-cream px-3 py-2.5 outline-none focus:border-rosa"
              />
            </label>
          ))}
        </div>

        <div className="mt-5">
          <button
            type="submit"
            className="rounded-full bg-rosa px-5 py-2.5 text-sm font-semibold text-white"
          >
            Salvar remetente
          </button>
        </div>
      </form>
    </div>
  );
}
