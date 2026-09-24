import "server-only";
import https from "node:https";
import { gunzipSync } from "node:zlib";
import { decryptFiscalValue, encryptFiscalValue } from "@/lib/merchant/fiscalEncryption";

const DISTRIBUTION_URL = "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx";
const PORTAL_NS = "http://www.portalfiscal.inf.br/nfe";
const WSDL_NS = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe";

function xmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function tag(xml: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = xml.match(new RegExp(`<(?:(?:[\\w.-]+):)?${escaped}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:[\\w.-]+):)?${escaped}\\s*>`, "i"));
  return match?.[1]?.trim() ?? null;
}

function attributes(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const match of raw.matchAll(/([\w:.-]+)\s*=\s*(["'])(.*?)\2/g)) result[match[1]] = match[3];
  return result;
}

function soapPost(pfx: Buffer, passphrase: string, soap: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = https.request(DISTRIBUTION_URL, {
      method: "POST",
      pfx,
      passphrase,
      headers: {
        "Content-Type": `application/soap+xml; charset=utf-8; action="${WSDL_NS}/nfeDistDFeInteresse"`,
        "Content-Length": Buffer.byteLength(soap),
        Accept: "application/soap+xml, text/xml",
      },
      timeout: 25000,
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        if ((response.statusCode ?? 500) >= 400) reject(new Error(`SEFAZ HTTP ${response.statusCode}`));
        else resolve(body);
      });
    });
    request.on("timeout", () => request.destroy(new Error("SEFAZ timeout")));
    request.on("error", reject);
    request.end(soap);
  });
}

export type FiscalInvoiceSummary = {
  accessKey: string;
  nsu: string;
  invoiceNumber: string | null;
  series: string | null;
  issuerName: string | null;
  issuerTaxId: string | null;
  issuedAt: string | null;
  totalAmount: number | null;
  encryptedSummary: string;
};

export async function queryReceivedNfe(input: {
  certificateCiphertext: string;
  passwordCiphertext: string;
  taxIdCiphertext: string;
  taxIdType: "CPF" | "CNPJ";
  lastNsu: string;
}): Promise<{ invoices: FiscalInvoiceSummary[]; lastNsu: string; maxNsu: string; statusCode: string }> {
  const cert = decryptFiscalValue(input.certificateCiphertext);
  const password = decryptFiscalValue(input.passwordCiphertext).toString("utf8");
  const taxId = decryptFiscalValue(input.taxIdCiphertext).toString("utf8");
  const docTag = input.taxIdType;
  let cursor = input.lastNsu.padStart(15, "0");
  let maxNsu = cursor;
  let statusCode = "";
  const invoices: FiscalInvoiceSummary[] = [];
  for (let requestCount = 0; requestCount < 3; requestCount += 1) {
    const inner = `<distDFeInt versao="1.01" xmlns="${PORTAL_NS}"><tpAmb>1</tpAmb><cUFAutor>91</cUFAutor><${docTag}>${xmlEscape(taxId)}</${docTag}><distNSU><ultNSU>${cursor}</ultNSU></distNSU></distDFeInt>`;
    const envelope = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:nfe="${WSDL_NS}"><soap12:Body><nfe:nfeDistDFeInteresse><nfe:nfeDadosMsg>${inner}</nfe:nfeDadosMsg></nfe:nfeDistDFeInteresse></soap12:Body></soap12:Envelope>`;
    const response = await soapPost(cert, password, envelope);
    const ret = tag(response, "retDistDFeInt");
    if (!ret) throw new Error("Resposta inválida da SEFAZ");
    statusCode = tag(ret, "cStat") ?? "";
    if (!/^(137|138)$/.test(statusCode)) throw new Error(`SEFAZ status ${statusCode}`);
    const nextCursor = (tag(ret, "ultNSU") ?? cursor).padStart(15, "0");
    maxNsu = (tag(ret, "maxNSU") ?? maxNsu).padStart(15, "0");
    for (const match of ret.matchAll(/<(?:(?:[\w.-]+):)?docZip\b([^>]*)>([\s\S]*?)<\/(?:(?:[\w.-]+):)?docZip\s*>/gi)) {
      const attrs = attributes(match[1]);
      const nsu = attrs.NSU ?? attrs.nSU ?? "";
      const kind = attrs.schema ?? "";
      if (!/^resNFe/i.test(kind) || !/^\d{15}$/.test(nsu)) continue;
      const xml = gunzipSync(Buffer.from(match[2].replace(/\s/g, ""), "base64")).toString("utf8");
      const accessKey = tag(xml, "chNFe") ?? "";
      if (!/^\d{44}$/.test(accessKey)) continue;
      const totalText = tag(xml, "vNF");
      invoices.push({
        accessKey,
        nsu,
        invoiceNumber: tag(xml, "nNF"),
        series: tag(xml, "serie"),
        issuerName: tag(xml, "xNome"),
        issuerTaxId: tag(xml, "CNPJ") ?? tag(xml, "CPF"),
        issuedAt: tag(xml, "dhEmi") ?? tag(xml, "dEmi"),
        totalAmount: totalText && Number.isFinite(Number(totalText)) ? Number(totalText) : null,
        encryptedSummary: encryptFiscalValue(xml),
      });
    }
    if (nextCursor <= cursor || nextCursor >= maxNsu) {
      cursor = nextCursor;
      break;
    }
    cursor = nextCursor;
  }
  return {
    invoices,
    lastNsu: cursor,
    maxNsu,
    statusCode,
  };
}

export async function queryInvoiceXml(input: {
  certificateCiphertext: string;
  passwordCiphertext: string;
  accessKey: string;
}): Promise<{ xml: string; encryptedXml: string }> {
  if (!/^\d{44}$/.test(input.accessKey)) throw new Error("invalid_access_key");
  const cert = decryptFiscalValue(input.certificateCiphertext);
  const password = decryptFiscalValue(input.passwordCiphertext).toString("utf8");
  const query = `<consChNFe versao="1.01" xmlns="${PORTAL_NS}"><tpAmb>1</tpAmb><xServ>CONSULTAR</xServ><chNFe>${input.accessKey}</chNFe></consChNFe>`;
  const envelope = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:nfe="${WSDL_NS}"><soap12:Body><nfe:nfeDistDFeInteresse><nfe:nfeDadosMsg>${query}</nfe:nfeDadosMsg></nfe:nfeDistDFeInteresse></soap12:Body></soap12:Envelope>`;
  const response = await soapPost(cert, password, envelope);
  const ret = tag(response, "retDistDFeInt");
  if (!ret) throw new Error("invalid_sefaz_response");
  const statusCode = tag(ret, "cStat") ?? "";
  const docMatch = ret.match(/<(?:(?:[\w.-]+):)?docZip\b[^>]*>([\s\S]*?)<\/(?:(?:[\w.-]+):)?docZip\s*>/i);
  if (statusCode !== "138" || !docMatch) throw new Error(`xml_unavailable_${statusCode}`);
  const xml = gunzipSync(Buffer.from(docMatch[1].replace(/\s/g, ""), "base64")).toString("utf8");
  if (!/<(?:(?:[\w.-]+):)?(?:nfeProc|NFe)\b/.test(xml) || !xml.includes(input.accessKey)) throw new Error("xml_unavailable");
  return { xml, encryptedXml: encryptFiscalValue(xml) };
}
