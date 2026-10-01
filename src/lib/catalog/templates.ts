import type { BusinessCategoryKey } from "@/lib/merchant/businessCategories";

export const DEFAULT_MENU_SLUG = "principal";
export const DEFAULT_MENU_NAME = "Catálogo";

export type ProductUnitOption = { value: string; label: string };

const PRODUCT_UNITS: Record<string, ProductUnitOption[]> = {
  material_construcao: [
    { value: "un", label: "Unidade" }, { value: "kg", label: "Kg" }, { value: "g", label: "g" },
    { value: "m", label: "Metro (m)" }, { value: "m2", label: "Metro² (m²)" }, { value: "m3", label: "Metro³ (m³)" },
    { value: "l", label: "Litro (L)" }, { value: "saco", label: "Saco" }, { value: "caixa", label: "Caixa" }, { value: "pacote", label: "Pacote" },
  ],
  casa_de_racao: [
    { value: "un", label: "Unidade" }, { value: "kg", label: "Kg" }, { value: "g", label: "g" },
    { value: "l", label: "Litro (L)" }, { value: "saco", label: "Saco" }, { value: "caixa", label: "Caixa" }, { value: "pacote", label: "Pacote" },
  ],
  farmacia: [
    { value: "un", label: "Unidade" }, { value: "caixa", label: "Caixa" }, { value: "pacote", label: "Pacote" }, { value: "blister", label: "Blister" }, { value: "frasco", label: "Frasco" },
  ],
  pet_shop: [
    { value: "un", label: "Unidade" }, { value: "kg", label: "Kg" }, { value: "g", label: "g" },
    { value: "l", label: "Litro (L)" }, { value: "saco", label: "Saco" }, { value: "caixa", label: "Caixa" }, { value: "pacote", label: "Pacote" },
  ],
  mercado: [
    { value: "un", label: "Unidade" }, { value: "kg", label: "Kg" }, { value: "g", label: "g" },
    { value: "l", label: "Litro (L)" }, { value: "caixa", label: "Caixa" }, { value: "pacote", label: "Pacote" },
  ],
  conveniencia: [
    { value: "un", label: "Unidade" }, { value: "kg", label: "Kg" }, { value: "g", label: "g" },
    { value: "l", label: "Litro (L)" }, { value: "caixa", label: "Caixa" }, { value: "pacote", label: "Pacote" },
  ],
  loja_roupas: [
    { value: "un", label: "Peça" }, { value: "par", label: "Par" }, { value: "caixa", label: "Caixa" }, { value: "pacote", label: "Pacote" },
  ],
  loja_calcados: [
    { value: "un", label: "Par" }, { value: "caixa", label: "Caixa" }, { value: "pacote", label: "Pacote" },
  ],
};

const GENERAL_PRODUCT_UNITS: ProductUnitOption[] = [
  { value: "un", label: "Unidade" }, { value: "kg", label: "Kg" }, { value: "g", label: "g" },
  { value: "l", label: "Litro (L)" }, { value: "caixa", label: "Caixa" }, { value: "pacote", label: "Pacote" },
];

export function getProductUnitOptions(category: BusinessCategoryKey | string | null | undefined): ProductUnitOption[] {
  return PRODUCT_UNITS[category ?? ""] ?? GENERAL_PRODUCT_UNITS;
}

export function getSuggestedCategories(
  category: BusinessCategoryKey | string | null | undefined,
): string[] {
  switch (category) {
    case "farmacia":
      return [
        "Medicamentos",
        "Perfumaria",
        "Higiene pessoal",
        "Bebês",
        "Suplementos",
      ];
    case "mercado":
    case "conveniencia":
      return [
        "Bebidas",
        "Mercearia",
        "Higiene e limpeza",
        "Frios e laticínios",
        "Doces e snacks",
      ];
    case "restaurante":
      return ["Entradas", "Pratos", "Bebidas", "Sobremesas"];
    case "pizzaria":
      return ["Pizzas", "Bebidas", "Combos", "Sobremesas"];
    case "bares":
      return ["Bebidas", "Petiscos", "Combos"];
    case "clinica":
    case "consultorio":
      return ["Consultas", "Exames", "Procedimentos", "Retornos"];
    case "hoteis":
      return ["Acomodações", "Serviços", "Extras", "Promoções"];
    case "loja_roupas":
      return ["Feminino", "Masculino", "Infantil", "Acessórios", "Promoções"];
    case "loja_calcados":
      return ["Feminino", "Masculino", "Infantil", "Acessórios", "Promoções"];
    case "material_construcao":
      return [
        "Cimento, Areia e Brita",
        "Tijolos e Blocos",
        "Ferramentas",
        "Elétrica",
        "Hidráulica",
        "Tintas e Acessórios",
        "Pisos e Revestimentos",
        "Madeiras",
        "EPI (Segurança)",
        "Fixadores (Parafusos/Pregos)",
      ];
    default:
      return ["Destaques", "Novidades"];
  }
}
