/**
 * Verifica se um módulo do dashboard está habilitado para o segmento de
 * negócio do merchant. Reaproveita `getDashboardModules` (fonte real da
 * navegação do dashboard, src/lib/merchant/dashboardModules.ts) em vez de
 * manter uma segunda lista de "quais segmentos têm qual módulo" — evita as
 * duas listas divergirem com o tempo.
 */
import { getDashboardModules, type DashboardCardModel } from "@/lib/merchant/dashboardModules";

function allCards(sections: Record<string, DashboardCardModel[]>): DashboardCardModel[] {
  return Object.values(sections).flat();
}

export function isModuleEnabledForCategory(businessCategory: string | null, moduleHref: string): boolean {
  const modules = getDashboardModules(businessCategory);
  return allCards(modules.sections).some((card) => (card.href ?? "").startsWith(moduleHref));
}
