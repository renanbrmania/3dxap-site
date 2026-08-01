# Printer agent (Elgin L42 PRO FULL)

Rode **neste PC** (o da Paula), na mesma rede Wi‑Fi/LAN da impressora.

```bash
cd printer-agent
npm start
```

Fica em `http://127.0.0.1:9109`:

- `GET /health` — agent vivo
- `GET /discover` — acha a Elgin (porta 9100 / MAC)
- `POST /print` — body JSON `{ "zpl": "^XA..." }`

No admin do site (`/admin` → Envios / Orçamentos), use **Testar Elgin** e depois **Comprar, gerar e imprimir**.

Se o agent estiver offline, o admin baixa o arquivo `.zpl` para imprimir depois.
