/**
 * Limite simples de taxa em memória, por instância do processo — contém
 * abuso/custo básico nas rotas públicas de assistente de IA (menu do
 * restaurante e assistente de serviços das demais verticais), mas NÃO é
 * distribuído entre instâncias serverless da Vercel (cada instância tem
 * seu próprio contador). Ver nota em ai/IMPLEMENTATION_PROGRESS.md —
 * evoluir pra um limitador real (Supabase ou KV) se o uso crescer.
 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 8;

const requestLog = new Map<string, number[]>();

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  requestLog.set(key, timestamps);
  return timestamps.length > RATE_LIMIT_MAX_REQUESTS;
}
