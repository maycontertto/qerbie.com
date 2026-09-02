import { NextResponse } from "next/server";

// Rota temporária de diagnóstico - lista os IDs de modelo disponíveis para a
// AI_PROVIDER_API_KEY configurada. Não retorna a chave em si. Remover após uso.
export async function GET() {
  const apiKey = process.env.AI_PROVIDER_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "AI_PROVIDER_API_KEY não configurada" }, { status: 500 });
  }

  const res = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json({ status: res.status, data }, { status: 502 });
  }
  const ids = Array.isArray(data.data) ? data.data.map((m: { id: string }) => m.id).sort() : data;
  return NextResponse.json({ ids });
}
