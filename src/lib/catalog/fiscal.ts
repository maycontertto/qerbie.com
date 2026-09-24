import type { Json } from "@/lib/supabase/database.types";

export const PRODUCT_FISCAL_FIELDS = [
  { key: "ncm", label: "NCM", maxLength: 8, placeholder: "00000000" },
  { key: "cest", label: "CEST", maxLength: 7, placeholder: "0000000" },
  { key: "cfop", label: "CFOP de saída", maxLength: 4, placeholder: "Ex.: 5102" },
  { key: "origin", label: "Origem da mercadoria", maxLength: 1, placeholder: "Código 0 a 8" },
  { key: "icms_cst", label: "CST ICMS", maxLength: 3, placeholder: "Ex.: 00" },
  { key: "icms_csosn", label: "CSOSN", maxLength: 3, placeholder: "Para Simples Nacional" },
  { key: "icms_rate", label: "Alíquota ICMS (%)", maxLength: 8, placeholder: "Ex.: 18,00" },
  { key: "pis_cst", label: "CST PIS", maxLength: 2, placeholder: "Ex.: 01" },
  { key: "pis_rate", label: "Alíquota PIS (%)", maxLength: 8, placeholder: "Ex.: 1,65" },
  { key: "cofins_cst", label: "CST COFINS", maxLength: 2, placeholder: "Ex.: 01" },
  { key: "cofins_rate", label: "Alíquota COFINS (%)", maxLength: 8, placeholder: "Ex.: 7,60" },
  { key: "ipi_cst", label: "CST IPI", maxLength: 2, placeholder: "Opcional" },
  { key: "ipi_rate", label: "Alíquota IPI (%)", maxLength: 8, placeholder: "Opcional" },
] as const;

export type ProductFiscalData = Partial<Record<(typeof PRODUCT_FISCAL_FIELDS)[number]["key"], string>>;

export function readProductFiscalData(formData: FormData): ProductFiscalData {
  const data: ProductFiscalData = {};
  for (const field of PRODUCT_FISCAL_FIELDS) {
    const value = String(formData.get(`fiscal_${field.key}`) ?? "").trim();
    if (value) data[field.key] = value.slice(0, field.maxLength);
  }
  return data;
}

export function parseProductFiscalData(value: Json | null | undefined): ProductFiscalData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const parsed: ProductFiscalData = {};
  for (const field of PRODUCT_FISCAL_FIELDS) {
    const candidate = source[field.key];
    if (typeof candidate === "string" && candidate.trim()) {
      parsed[field.key] = candidate.trim().slice(0, field.maxLength);
    }
  }
  return parsed;
}
