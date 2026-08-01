/**
 * Melhor Envio / transportadoras às vezes devolvem vários blocos ZPL
 * (etiqueta + declaração + recibo). Na térmica (Elgin 10x15) só usamos a etiqueta de frete.
 */

const EXTRA_DOC_RE =
  /declara[cç][aã]o\s+de\s+conte[uú]do|\bdace\b|\bdce\b|aviso\s+de\s+recebimento|\bcanhoto\b|lista\s+de\s+postagem|documento\s+auxiliar/i;

const SHIPPING_HINT_RE =
  /jadlog|correios|melhor\s*envio|\bORD-|\bPAK\b|\bPAC\b|\bSEDEX\b|rastreio|tracking|^XA/i;

/** Divide o arquivo em etiquetas ^XA ... ^XZ. */
export function splitZplLabels(zpl: string): string[] {
  const text = String(zpl || "").replace(/^\uFEFF/, "").trim();
  if (!text) return [];

  const parts: string[] = [];
  const re = /\^XA[\s\S]*?\^XZ/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const block = match[0].trim();
    if (block) parts.push(block);
  }

  // Se nao achou bloco padrao, devolve o texto inteiro
  if (!parts.length && /\^XA/i.test(text)) return [text];
  return parts;
}

function looksLikeExtraDocument(label: string) {
  return EXTRA_DOC_RE.test(label);
}

function scoreShippingLabel(label: string) {
  let score = 0;
  if (SHIPPING_HINT_RE.test(label)) score += 2;
  if (/jadlog/i.test(label)) score += 3;
  if (/\^BC|\^BY|\^BQ/i.test(label)) score += 2; // barcodes / QR
  if (looksLikeExtraDocument(label)) score -= 10;
  return score;
}

/**
 * Mantém só a etiqueta de frete (equivalente a desmarcar declaração/recibo no PDF do ME).
 */
export function extractShippingLabelZpl(zpl: string): string {
  const labels = splitZplLabels(zpl);
  if (!labels.length) return String(zpl || "").trim();
  if (labels.length === 1) {
    return looksLikeExtraDocument(labels[0]) ? labels[0] : labels[0];
  }

  const usable = labels.filter((l) => !looksLikeExtraDocument(l));
  const pool = usable.length ? usable : labels;
  pool.sort((a, b) => scoreShippingLabel(b) - scoreShippingLabel(a));
  return pool[0];
}
