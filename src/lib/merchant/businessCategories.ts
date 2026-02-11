export type BusinessCategoryKey =
  | "academias"
  | "barbearia"
  | "bares"
  | "clinica"
  | "clinica_estetica"
  | "consultorio"
  | "conveniencia"
  | "farmacia"
  | "hoteis"
  | "loja_calcados"
  | "loja_roupas"
  | "mercado"
  | "pizzaria"
  | "restaurante";

export const BUSINESS_CATEGORIES: Array<{ key: BusinessCategoryKey; label: string }> = [
  { key: "academias", label: "Academias" },
  { key: "barbearia", label: "Barbearia" },
  { key: "bares", label: "Bares" },
  { key: "clinica", label: "Clínica" },
  { key: "clinica_estetica", label: "Clínica de Estética" },
  { key: "conveniencia", label: "Conveniência" },
  { key: "consultorio", label: "Consultório" },
  { key: "farmacia", label: "Farmácia" },
  { key: "hoteis", label: "Hotéis" },
  { key: "loja_calcados", label: "Loja de calçados" },
  { key: "loja_roupas", label: "Loja de roupas" },
  { key: "mercado", label: "Mercado" },
  { key: "pizzaria", label: "Pizzaria" },
  { key: "restaurante", label: "Restaurante" },
];

export function isBusinessCategoryKey(value: string): value is BusinessCategoryKey {
  return BUSINESS_CATEGORIES.some((c) => c.key === value);
}
