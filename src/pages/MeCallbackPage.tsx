import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { exchangeCode } from "../lib/melhorEnvio";

/**
 * OAuth redirect target from Melhor Envio.
 * Route: /admin/me-callback?code=...&state=...
 */
export function MeCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState("Conectando Melhor Envio…");
  const [error, setError] = useState("");

  useEffect(() => {
    const code = params.get("code");
    const err = params.get("error");
    const errDesc = params.get("error_description");

    if (err) {
      setError(errDesc || err);
      setMessage("Falha na autorização.");
      return;
    }
    if (!code) {
      setError("Código OAuth ausente na URL.");
      setMessage("Não foi possível conectar.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await exchangeCode(code);
        if (cancelled) return;
        setMessage("Melhor Envio conectado. Redirecionando…");
        window.setTimeout(() => navigate("/admin?tab=shipping", { replace: true }), 800);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setMessage("Falha ao trocar o código por token.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params, navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-rosa/10">
        <h1 className="font-display text-2xl font-semibold text-ink">Melhor Envio</h1>
        <p className="mt-3 text-sm text-muted">{message}</p>
        {error ? <p className="mt-3 text-sm font-medium text-rosa-deep">{error}</p> : null}
        <Link
          to="/admin?tab=shipping"
          className="mt-6 inline-block rounded-full bg-rosa px-5 py-2.5 text-sm font-semibold text-white"
        >
          Voltar ao admin
        </Link>
      </div>
    </main>
  );
}
