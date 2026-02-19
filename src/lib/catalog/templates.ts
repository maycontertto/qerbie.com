import type { BusinessCategoryKey } from "@/lib/merchant/businessCategories";

export const DEFAULT_MENU_SLUG = "principal";
export const DEFAULT_MENU_NAME = "Catálogo";

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
