/**
 * Ponto único de resolução do provedor de IA configurado, via variáveis de
 * ambiente — nenhum outro módulo do Qerbie sabe qual provedor está ativo.
 *
 * AI_PROVIDER=ollama (padrão sugerido, servidor próprio/Oracle Cloud Free Tier):
 *   OLLAMA_BASE_URL  — ex.: https://ollama.seu-dominio.com/v1 (Ollama expõe API compatível OpenAI em /v1)
 *   OLLAMA_MODEL     — ex.: llama3.1:8b
 *   OLLAMA_API_KEY   — opcional, só se você colocar autenticação no proxy reverso na frente do Ollama
 *
 * AI_PROVIDER=openai | groq | deepseek (troca futura para uma API paga melhor):
 *   AI_PROVIDER_API_KEY
 *   AI_PROVIDER_MODEL — ex.: gpt-4o-mini / llama-3.3-70b-versatile / deepseek-chat
 */
import { createOpenAiCompatibleProvider } from "@ai/providers/openaiCompatible";
import type { AIProvider } from "@ai/core/provider";

const HOSTED_PROVIDER_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  groq: "https://api.groq.com/openai/v1",
  deepseek: "https://api.deepseek.com/v1",
};

export function getConfiguredProvider(): AIProvider {
  const providerName = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();

  if (!providerName) {
    throw new Error(
      "Nenhum provedor de IA configurado. Defina AI_PROVIDER=ollama (ou openai/groq/deepseek) " +
        "e as variáveis correspondentes — ver ai/IMPLEMENTATION_PROGRESS.md.",
    );
  }

  if (providerName === "ollama") {
    const baseUrl = process.env.OLLAMA_BASE_URL;
    const model = process.env.OLLAMA_MODEL;
    if (!baseUrl || !model) {
      throw new Error("Defina OLLAMA_BASE_URL e OLLAMA_MODEL para usar AI_PROVIDER=ollama.");
    }
    return createOpenAiCompatibleProvider({
      name: "ollama",
      baseUrl,
      apiKey: process.env.OLLAMA_API_KEY,
      model,
    });
  }

  const baseUrl = HOSTED_PROVIDER_BASE_URLS[providerName];
  if (!baseUrl) {
    throw new Error(`AI_PROVIDER="${providerName}" desconhecido. Use ollama, openai, groq ou deepseek.`);
  }

  const apiKey = process.env.AI_PROVIDER_API_KEY;
  const model = process.env.AI_PROVIDER_MODEL;
  if (!apiKey || !model) {
    throw new Error(`Defina AI_PROVIDER_API_KEY e AI_PROVIDER_MODEL para usar AI_PROVIDER=${providerName}.`);
  }

  return createOpenAiCompatibleProvider({ name: providerName, baseUrl, apiKey, model });
}

