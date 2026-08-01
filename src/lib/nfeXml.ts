import { emptyRecipient, onlyDigits, type ShipProduct, type ShipRecipient } from "./melhorEnvio";

function text(el: Element | null, ...tags: string[]) {
  if (!el) return "";
  for (const tag of tags) {
    const node = el.getElementsByTagName(tag)[0];
    if (node?.textContent) return node.textContent.trim();
  }
  return "";
}

function first(doc: Document, tag: string) {
  return doc.getElementsByTagName(tag)[0] || null;
}

/**
 * Lê XML de NF-e (procNFe / NFe) e extrai destinatário, produtos e chave.
 */
export function parseNfeXml(xmlString: string): {
  key: string;
  recipient: ShipRecipient;
  products: ShipProduct[];
  xmlContent: string;
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "text/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("XML da NF-e inválido.");
  }

  const inf = first(doc, "infNFe");
  const ide = first(doc, "ide");
  const dest = first(doc, "dest");
  const enderDest = dest?.getElementsByTagName("enderDest")[0] || null;

  let key =
    text(inf, "Id").replace(/^NFe/i, "") ||
    text(first(doc, "protNFe") || first(doc, "infProt"), "chNFe") ||
    "";

  // Alguns XMLs trazem chave só no atributo Id
  if (!key && inf) {
    key = (inf.getAttribute("Id") || "").replace(/^NFe/i, "");
  }

  const recipient = emptyRecipient();
  recipient.name = text(dest, "xNome");
  recipient.email = text(dest, "email");
  recipient.document = onlyDigits(text(dest, "CPF"));
  recipient.company_document = onlyDigits(text(dest, "CNPJ"));
  recipient.state_register = text(dest, "IE") || (recipient.document ? "ISENTO" : "");
  recipient.phone = onlyDigits(text(enderDest, "fone") || text(dest, "fone"));
  recipient.address = text(enderDest, "xLgr");
  recipient.number = text(enderDest, "nro");
  recipient.complement = text(enderDest, "xCpl");
  recipient.district = text(enderDest, "xBairro");
  recipient.city = text(enderDest, "xMun");
  recipient.postal_code = onlyDigits(text(enderDest, "CEP"));
  recipient.state_abbr = text(enderDest, "UF");
  recipient.country_id = "BR";

  const products: ShipProduct[] = [];
  const dets = Array.from(doc.getElementsByTagName("det"));
  for (const det of dets) {
    const prod = det.getElementsByTagName("prod")[0];
    if (!prod) continue;
    products.push({
      name: text(prod, "xProd") || "Item",
      quantity: text(prod, "qCom") || "1",
      unitary_value: text(prod, "vUnCom") || text(prod, "vProd") || "0",
    });
  }

  // xml_content: Melhor Envio espera conteúdo; enviamos o XML em base64
  const xmlContent = btoa(unescape(encodeURIComponent(xmlString)));

  void ide;
  return { key, recipient, products, xmlContent };
}

export async function parseNfeFile(file: File) {
  const xml = await file.text();
  return parseNfeXml(xml);
}
