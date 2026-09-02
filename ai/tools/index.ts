/**
 * Registro central das ferramentas do Sprint 1 (todas somente leitura).
 * Importar este módulo uma vez (ex.: na rota /api/ai/chat) garante que todas
 * as ferramentas estejam disponíveis no `toolRegistry`.
 */
import { toolRegistry } from "@ai/core/registry";
import { getSalesSummaryTool, getTopProductsTool } from "@ai/tools/sales";
import { adjustStockTool, findProductTool, getLowStockTool } from "@ai/tools/inventory";
import { updateProductTool } from "@ai/tools/catalog";
import {
  confirmAppointmentTool,
  declineAppointmentTool,
  getAppointmentsTodayTool,
  getPendingAppointmentsTool,
} from "@ai/tools/agenda";
import { getExchangeRequestsTool, updateExchangeStatusTool } from "@ai/tools/exchanges";

let registered = false;

export function registerAllTools(): void {
  if (registered) return;
  registered = true;

  toolRegistry.register(getSalesSummaryTool);
  toolRegistry.register(getTopProductsTool);
  toolRegistry.register(getLowStockTool);
  toolRegistry.register(findProductTool);
  toolRegistry.register(adjustStockTool);
  toolRegistry.register(updateProductTool);
  toolRegistry.register(getAppointmentsTodayTool);
  toolRegistry.register(getPendingAppointmentsTool);
  toolRegistry.register(confirmAppointmentTool);
  toolRegistry.register(declineAppointmentTool);
  toolRegistry.register(getExchangeRequestsTool);
  toolRegistry.register(updateExchangeStatusTool);
}
