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
  | "lava_jato"
  | "loja_calcados"
  | "loja_roupas"
  | "mercado"
  | "pet_shop"
  | "pizzaria"
  | "restaurante"
  | "salao_de_beleza";

export const BUSINESS_CATEGORIES: Array<{ key: BusinessCategoryKey; label: string }> = [
  { key: "academias", label: "Academias" },
  { key: "barbearia", label: "Barbearia" },
  { key: "bares", label: "Bares" },
  { key: "clinica", label: "Clínica" },
  { key: "clinica_estetica", label: "Clínica de Estética" },
  { key: "salao_de_beleza", label: "Salão de Beleza" },
  { key: "pet_shop", label: "Pet Shop / Clínica Veterinária" },
  { key: "lava_jato", label: "Lava Jato / Estética Automotiva" },
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
