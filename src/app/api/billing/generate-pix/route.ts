import { getDashboardUserOrRedirect } from "@/lib/auth/guard";

export async function POST(req: Request) {
  try {
    const { user, merchant } = await getDashboardUserOrRedirect();
    if (user.id !== merchant.owner_user_id) {
      return Response.json({ error: "Apenas o proprietário pode gerar esta cobrança" }, { status: 403 });
    }
    const body = await req.json();
    const { amount, description } = body;

    if (!amount || amount <= 0) {
      return Response.json(
        { error: "Valor inválido" },
        { status: 400 }
      );
    }

    if (!merchant.payment_pix_key) {
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
      pix_key: merchant.payment_pix_key,
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
        chave: merchant.payment_pix_key,
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
