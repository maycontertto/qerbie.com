import { createClient } from "@/lib/supabase/server";
import { getDashboardUserOrRedirect } from "@/lib/auth/guard";

export async function POST(req: Request) {
  try {
    const user = await getDashboardUserOrRedirect();
    const supabase = createClient();

    const body = await req.json();
    const { amount, description } = body;

    if (!amount || amount <= 0) {
      return Response.json(
        { error: "Valor inválido" },
        { status: 400 }
      );
    }

    // Pega o merchant
    const { data: merchant, error: merchErr } = await supabase
      .from("merchants")
      .select("id, user_id, pix_key")
      .eq("user_id", user.id)
      .single();

    if (merchErr || !merchant) {
      return Response.json(
        { error: "Comerciante não encontrado" },
        { status: 404 }
      );
    }

    if (!merchant.pix_key) {
      return Response.json(
        { error: "Chave PIX não configurada na conta" },
        { status: 400 }
      );
    }

    // Formata dados para gerar QR Code
    const pixData = {
      merchant_id: merchant.id,
      amount: amount.toFixed(2),
      description: description || "Pagamento Qerbie",
      pix_key: merchant.pix_key,
      timestamp: new Date().toISOString(),
    };

    // Simula QR Code (em produção, usar biblioteca de QR Code)
    // Para agora, só retorna os dados do PIX
    return Response.json({
      ok: true,
      type: "pix",
      data: pixData,
      instructions: [
        "1. Copie a chave PIX abaixo",
        `2. Abra seu app bancário e escaneie o QR ou cole a chave`,
        "3. Envie R$ " + amount.toFixed(2),
        "4. Volte aqui e clique 'Confirmar Pagamento Manual'",
      ],
      pix_display: {
        chave: merchant.pix_key,
        beneficiario: "Qerbie",
        valor: "R$ " + amount.toFixed(2),
        descricao: description,
      },
    });
  } catch (e) {
    console.error("PIX generation error:", e);
    return Response.json(
      { error: "Erro ao gerar PIX", message: String(e) },
      { status: 500 }
    );
  }
}
