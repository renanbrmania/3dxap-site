export type QuoteItem = {
  id: string;
  nome: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  /** Desconto % aplicado sobre (qtd × unitário). 0–100. */
  descontoPercent?: number;
};

export type QuoteData = {
  numero: string;
  cliente: string;
  data: string;
  validadeDias: number;
  itens: QuoteItem[];
  pix: string;
  cartao: string;
  telefone: string;
  assinatura: string;
  cidade: string;
};

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function parseMoneyInput(raw: string): number {
  const cleaned = raw
    .replace(/[R$\s]/gi, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function formatMoneyInput(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function defaultQuoteNumber(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `ORC-${y}-${m}${d}`;
}

export function defaultQuoteDateLabel(date = new Date()): string {
  return date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function emptyQuoteItem(): QuoteItem {
  return {
    id: crypto.randomUUID(),
    nome: "",
    descricao: "",
    quantidade: 1,
    valorUnitario: 0,
    descontoPercent: 0,
  };
}

export function createDefaultQuote(): QuoteData {
  return {
    numero: defaultQuoteNumber(),
    cliente: "",
    data: defaultQuoteDateLabel(),
    validadeDias: 10,
    itens: [emptyQuoteItem()],
    pix: "60.010.228/0001-94",
    cartao: "Parcelamento em até 3x (com acréscimo de juros da maquininha).",
    telefone: "(49) 9.9116-7161",
    assinatura: "Paula Pacheco",
    cidade: "Chapecó — SC",
  };
}

/** Normaliza % de desconto (0–100). */
export function itemDiscountPercent(item: QuoteItem): number {
  const n = Number(item.descontoPercent);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(100, n);
}

export function lineSubtotal(item: QuoteItem): number {
  return (Number(item.quantidade) || 0) * (Number(item.valorUnitario) || 0);
}

/** Total da linha após desconto % sobre (qtd × unitário). */
export function lineTotal(item: QuoteItem): number {
  const sub = lineSubtotal(item);
  const disc = itemDiscountPercent(item);
  if (disc <= 0) return sub;
  return Math.round(sub * (1 - disc / 100) * 100) / 100;
}

export function quoteTotal(items: QuoteItem[]): number {
  return items.reduce((sum, item) => sum + lineTotal(item), 0);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugifyClient(cliente: string): string {
  const base = cliente
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "Cliente";
}

export function buildQuoteHtml(data: QuoteData, logoUrl: string): string {
  const total = quoteTotal(data.itens);
  const showDiscount = data.itens.some((i) => itemDiscountPercent(i) > 0);
  const rows = data.itens
    .map((item) => {
      const disc = itemDiscountPercent(item);
      return `
      <tr>
        <td class="item">${escapeHtml(item.nome || "—")}</td>
        <td class="desc">${escapeHtml(item.descricao || "—")}</td>
        <td class="num">${escapeHtml(String(item.quantidade || 0).padStart(2, "0"))}</td>
        <td class="money">${escapeHtml(formatBRL(item.valorUnitario || 0))}</td>
        ${
          showDiscount
            ? `<td class="num">${disc > 0 ? `${escapeHtml(String(disc))}%` : "—"}</td>`
            : ""
        }
        <td class="money">${escapeHtml(formatBRL(lineTotal(item)))}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    #quote-page {
      --cream: #faf6f1;
      --blush: #f8e8ef;
      --rosa: #c45b86;
      --rosa-deep: #9e3d68;
      --rosa-soft: #e8a0bc;
      --ink: #2a2430;
      --muted: #7a7180;
      --white: #ffffff;
      box-sizing: border-box;
      position: relative;
      width: 794px;
      min-height: 1123px;
      padding: 42px 52px 48px;
      font-family: "Outfit", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(ellipse 80% 40% at 0% 0%, rgba(196, 91, 134, 0.10), transparent 55%),
        radial-gradient(ellipse 60% 35% at 100% 0%, rgba(232, 220, 200, 0.55), transparent 50%),
        var(--cream);
      display: flex;
      flex-direction: column;
    }
    #quote-page *, #quote-page *::before, #quote-page *::after { box-sizing: border-box; }
    #quote-page .accent-bar {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 4px;
      background: linear-gradient(90deg, var(--rosa-deep), var(--rosa), var(--rosa-soft));
    }
    #quote-page > header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(196, 91, 134, 0.22);
      margin-bottom: 16px;
    }
    #quote-page .brand img.logo { height: 72px; width: auto; display: block; }
    #quote-page .doc-meta {
      text-align: right;
      font-size: 12px;
      line-height: 1.5;
      color: var(--muted);
    }
    #quote-page .doc-meta .label {
      display: block;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--rosa);
      margin-bottom: 3px;
    }
    #quote-page .doc-meta strong { color: var(--ink); font-weight: 600; }
    #quote-page .title-block { margin-bottom: 14px; }
    #quote-page .title-block h1 {
      font-family: "Cormorant Garamond", serif;
      font-size: 30px;
      font-weight: 600;
      color: var(--ink);
      line-height: 1.1;
      margin: 0 0 4px;
    }
    #quote-page .title-block p { margin: 0; font-size: 12.5px; color: var(--muted); }
    #quote-page .client-card {
      display: grid;
      grid-template-columns: 1.3fr 1fr 1fr;
      gap: 10px;
      background: var(--white);
      border: 1px solid rgba(196, 91, 134, 0.14);
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 16px;
    }
    #quote-page .client-card .k {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--rosa);
      margin-bottom: 3px;
    }
    #quote-page .client-card .v { font-size: 13.5px; font-weight: 600; }
    #quote-page .section-title {
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--rosa-deep);
      margin-bottom: 8px;
    }
    #quote-page table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      background: var(--white);
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid rgba(196, 91, 134, 0.14);
      margin-bottom: 14px;
    }
    #quote-page thead th {
      background: linear-gradient(135deg, var(--rosa-deep), var(--rosa));
      color: white;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 10px 11px;
      text-align: left;
    }
    #quote-page thead th.num, #quote-page tbody td.num { text-align: center; }
    #quote-page thead th.money, #quote-page tbody td.money { text-align: right; white-space: nowrap; }
    #quote-page tbody td {
      padding: 10px 11px;
      font-size: 12.5px;
      border-top: 1px solid rgba(196, 91, 134, 0.10);
      vertical-align: top;
    }
    #quote-page tbody tr:nth-child(even) td { background: rgba(248, 232, 239, 0.35); }
    #quote-page tbody td.item { font-weight: 600; width: 28%; }
    #quote-page tbody td.desc { color: var(--muted); width: 38%; }
    #quote-page .totals { display: flex; justify-content: flex-end; margin-bottom: 16px; }
    #quote-page .totals-box {
      min-width: 250px;
      background: var(--white);
      border: 1px solid rgba(196, 91, 134, 0.18);
      border-radius: 12px;
      overflow: hidden;
    }
    #quote-page .totals-box .row {
      display: flex;
      justify-content: space-between;
      padding: 9px 13px;
      font-size: 12.5px;
      color: var(--muted);
      border-bottom: 1px solid rgba(196, 91, 134, 0.08);
    }
    #quote-page .totals-box .row.total {
      background: linear-gradient(135deg, var(--rosa-deep), var(--rosa));
      color: white;
      font-size: 14.5px;
      font-weight: 700;
      border: none;
      padding: 12px 13px;
    }
    #quote-page .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 14px;
    }
    #quote-page .info-card {
      background: var(--white);
      border: 1px solid rgba(196, 91, 134, 0.14);
      border-radius: 12px;
      padding: 12px 13px;
    }
    #quote-page .info-card h3 {
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--rosa-deep);
      margin: 0 0 8px;
    }
    #quote-page .info-card ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; }
    #quote-page .info-card li {
      position: relative;
      padding-left: 12px;
      font-size: 12px;
      line-height: 1.4;
    }
    #quote-page .info-card li::before {
      content: "";
      position: absolute;
      left: 0;
      top: 6px;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--rosa);
    }
    #quote-page .info-card li strong { color: var(--rosa-deep); font-weight: 600; }
    #quote-page .validity {
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--blush);
      border: 1px solid rgba(196, 91, 134, 0.18);
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 16px;
      font-size: 12px;
    }
    #quote-page .validity .pill {
      flex-shrink: 0;
      background: var(--rosa);
      color: white;
      font-size: 9.5px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      padding: 4px 8px;
      border-radius: 999px;
    }
    #quote-page > footer {
      margin-top: auto;
      padding-top: 14px;
      border-top: 1px solid rgba(196, 91, 134, 0.18);
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
    }
    #quote-page .sign { font-size: 12.5px; line-height: 1.45; }
    #quote-page .sign .closing { color: var(--muted); margin-bottom: 4px; }
    #quote-page .sign .who {
      font-family: "Cormorant Garamond", serif;
      font-size: 19px;
      font-weight: 600;
      color: var(--rosa-deep);
    }
    #quote-page .sign .role { font-size: 11.5px; color: var(--muted); }
    #quote-page .contact {
      text-align: right;
      font-size: 12px;
      line-height: 1.5;
      color: var(--muted);
    }
    #quote-page .contact strong { color: var(--ink); font-weight: 600; }
    #quote-page .contact .phone { color: var(--rosa-deep); font-weight: 600; }
  </style>
</head>
<body>
  <div id="quote-page">
    <div class="accent-bar"></div>
    <header>
      <div class="brand">
        <img class="logo" src="${escapeHtml(logoUrl)}" alt="3DXAP — Impressão 3D" />
      </div>
      <div class="doc-meta">
        <span class="label">Documento</span>
        <div><strong>Orçamento comercial</strong></div>
        <div>Nº ${escapeHtml(data.numero)}</div>
        <div>${escapeHtml(data.cidade)}</div>
      </div>
    </header>

    <div class="title-block">
      <h1>Orçamento de Produtos Personalizados</h1>
      <p>Proposta comercial para itens personalizados em impressão 3D de alta qualidade.</p>
    </div>

    <div class="client-card">
      <div>
        <div class="k">Cliente</div>
        <div class="v">${escapeHtml(data.cliente || "—")}</div>
      </div>
      <div>
        <div class="k">Data</div>
        <div class="v">${escapeHtml(data.data)}</div>
      </div>
      <div>
        <div class="k">Validade</div>
        <div class="v">${escapeHtml(String(data.validadeDias))} dias</div>
      </div>
    </div>

    <div class="section-title">Detalhamento dos itens</div>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Descrição</th>
          <th class="num">Qtd</th>
          <th class="money">Valor unit.</th>
          ${showDiscount ? `<th class="num">Desc.</th>` : ""}
          <th class="money">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals">
      <div class="totals-box">
        <div class="row"><span>Subtotal</span><span>${escapeHtml(formatBRL(total))}</span></div>
        <div class="row total"><span>Valor total</span><span>${escapeHtml(formatBRL(total))}</span></div>
      </div>
    </div>

    <div class="grid-2">
      <div class="info-card">
        <h3>Condições de pagamento</h3>
        <ul>
          <li><strong>PIX:</strong> ${escapeHtml(data.pix)}</li>
          <li><strong>Cartão de crédito:</strong> ${escapeHtml(data.cartao)}</li>
        </ul>
      </div>
      <div class="info-card">
        <h3>Informações importantes</h3>
        <ul>
          <li>Produtos fabricados via impressão 3D de alta qualidade.</li>
          <li>Prazo de entrega conforme disponibilidade de produção.</li>
          <li>Orçamento válido por ${escapeHtml(String(data.validadeDias))} dias a partir da data de emissão.</li>
        </ul>
      </div>
    </div>

    <div class="validity">
      <span class="pill">Atenção</span>
      <span>Esta proposta é válida por <strong>${escapeHtml(String(data.validadeDias))} dias</strong>. Após esse prazo, valores e disponibilidade estão sujeitos a reconfirmação.</span>
    </div>

    <footer>
      <div class="sign">
        <div class="closing">Atenciosamente,</div>
        <div class="who">${escapeHtml(data.assinatura)}</div>
        <div class="role">3DXAP — Impressão 3D · ${escapeHtml(data.cidade)}</div>
      </div>
      <div class="contact">
        <div><strong>Contato</strong></div>
        <div>Fone: <span class="phone">${escapeHtml(data.telefone)}</span></div>
        <div>Produtos personalizados em impressão 3D</div>
      </div>
    </footer>
  </div>
</body>
</html>`;
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    ),
  );
}

async function loadLogoDataUrl(): Promise<string> {
  const candidates = [
    `${window.location.origin}/logo-3dxap-quote.png`,
    `${window.location.origin}/logo-3dxap.png`,
    `${window.location.origin}/logo.png`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) continue;
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      return dataUrl;
    } catch {
      // try next
    }
  }

  return `${window.location.origin}/logo-3dxap.png`;
}

function extractQuoteMarkup(fullHtml: string): { styles: string; body: string } {
  const styleMatch = fullHtml.match(/<style>([\s\S]*?)<\/style>/i);
  const styles = styleMatch?.[1] ?? "";
  const start = fullHtml.indexOf('<div id="quote-page">');
  const end = fullHtml.lastIndexOf("</body>");
  const body = start >= 0 && end > start ? fullHtml.slice(start, end).trim() : "";
  return { styles, body };
}

export async function downloadQuotePdf(data: QuoteData): Promise<void> {
  if (!data.cliente.trim()) {
    throw new Error("Informe o nome do cliente.");
  }
  if (!data.itens.length || data.itens.every((i) => !i.nome.trim())) {
    throw new Error("Adicione pelo menos um item com nome.");
  }

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const logoUrl = await loadLogoDataUrl();
  const fullHtml = buildQuoteHtml(data, logoUrl);
  const { styles, body } = extractQuoteMarkup(fullHtml);

  if (!body) {
    throw new Error("Não foi possível montar o layout do orçamento.");
  }

  const host = document.createElement("div");
  host.id = "quote-pdf-host";
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: "794px",
    opacity: "0.01",
    pointerEvents: "none",
    zIndex: "-1",
    overflow: "hidden",
  });

  const styleEl = document.createElement("style");
  styleEl.textContent = styles;
  host.appendChild(styleEl);

  const mount = document.createElement("div");
  mount.innerHTML = body;
  host.appendChild(mount);
  document.body.appendChild(host);

  try {
    const page = host.querySelector("#quote-page") as HTMLElement | null;
    if (!page) {
      throw new Error("Layout do orçamento não encontrado.");
    }

    await waitForImages(page);
    await document.fonts?.ready.catch(() => undefined);
    await new Promise((r) => setTimeout(r, 200));

    const canvas = await html2canvas(page, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#faf6f1",
      logging: false,
      width: page.scrollWidth || 794,
      height: page.scrollHeight || 1123,
      windowWidth: 794,
    });

    if (!canvas.width || !canvas.height) {
      throw new Error("Falha ao renderizar o PDF (canvas vazio).");
    }

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 2) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const filename = `Orcamento-3DXAP-${slugifyClient(data.cliente)}.pdf`;
    pdf.save(filename);
  } finally {
    host.remove();
  }
}
