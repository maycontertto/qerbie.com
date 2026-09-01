/**
 * Ponto único de resolução do provedor de IA configurado.
 *
 * Sprint 1: nenhum provedor concreto existe ainda (ver ai/IMPLEMENTATION_PROGRESS.md).
 * Isso é intencional — não criamos um provedor "fake" que devolve respostas
 * inventadas. Até a decisão de hospedagem (Ollama próprio vs. API externa)
 * ser tomada, `getConfiguredProvider()` falha de forma explícita.
 */
import type { AIProvider } from "@ai/core/provider";

export function getConfiguredProvider(): AIProvider {
  throw new Error(
    "Nenhum provedor de IA configurado ainda. Defina AI_PROVIDER e as credenciais " +
      "correspondentes (ai/providers/ollama.ts ou ai/providers/openai.ts) — ver ai/IMPLEMENTATION_PROGRESS.md.",
  );
}
