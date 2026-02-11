import type { BusinessCategoryKey } from "@/lib/merchant/businessCategories";

export function getBusinessCategoryLabel(
  key: BusinessCategoryKey | string | null | undefined,
): string | null {
  if (!key) return null;

  switch (key) {
    case "academias":
      return "Academias";
    case "barbearia":
      return "Barbearia";
    case "clinica_estetica":
      return "Clínica de Estética";
    case "salao_de_beleza":
      return "Salão de Beleza";
    case "farmacia":
      return "Farmácia";
    case "mercado":
      return "Mercado";
    case "bares":
      return "Bares";
    case "restaurante":
      return "Restaurante";
    case "pizzaria":
      return "Pizzaria";
    case "consultorio":
      return "Consultório";
    case "clinica":
      return "Clínica";
    case "hoteis":
      return "Hotéis";
    case "loja_roupas":
      return "Loja de roupas";
    case "loja_calcados":
      return "Loja de calçados";
    case "conveniencia":
      return "Conveniência";
    case "pet_shop":
      return "Pet Shop / Clínica Veterinária";
    default:
      return null;
  }
}
