export const dynamic = "force-dynamic";

export async function GET() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!accessToken) {
    return Response.json({ error: "Token não configurado" }, { status: 400 });
  }

  try {
    // Pega histórico de transações da conta
    const transactionsRes = await fetch(
      "https://api.mercadopago.com/v1/account/settlement_report/transactions?limit=50",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    let transactions = [];
    if (transactionsRes.ok) {
      const data = await transactionsRes.json();
      transactions = data.results || [];
    }

    // Pega saldo da conta
    const balanceRes = await fetch("https://api.mercadopago.com/v1/account/balance", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let balance = null;
    if (balanceRes.ok) {
      balance = await balanceRes.json();
    }

    // Pega status da conta
    const statusRes = await fetch("https://api.mercadopago.com/v1/accounts/search", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let accountStatus = null;
    if (statusRes.ok) {
      const data = await statusRes.json();
      accountStatus = data;
    }

    // Pega informações do usuário (para ver restrições)
    const userRes = await fetch("https://api.mercadopago.com/v1/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let user = null;
    let restrictions = [];
    if (userRes.ok) {
      user = await userRes.json();
      restrictions = user.restrictions || [];
    }

    // Analisa se há problemas
    const hasProblems = {
      account_restricted: restrictions.length > 0,
      negative_balance: balance && balance.available_balance < 0,
      pending_charges: transactions.some((t: any) => t.status === "pending"),
    };

    return Response.json({
      ok: true,
      account_health: {
        has_restrictions: restrictions.length > 0,
        restrictions: restrictions.map((r: any) => ({
          reason: r.reason,
          status: r.status,
          type: r.type,
        })),
        balance: balance ? {
          available: balance.available_balance || 0,
          unavailable: balance.unavailable_balance || 0,
          total: (balance.available_balance || 0) + (balance.unavailable_balance || 0),
        } : null,
      },
      recent_transactions: transactions.slice(0, 10).map((t: any) => ({
        date: t.date,
        gross_amount: t.gross_amount,
        net_amount: t.net_amount,
        fee_amount: t.fee_amount,
        status: t.status,
        type: t.type,
      })),
      problems_detected: hasProblems,
      solutions: [
        hasProblems.account_restricted && "❌ Sua conta tem RESTRIÇÕES ativas! Acesse https://www.mercadopago.com.br/alerts para resolver",
        hasProblems.negative_balance && "❌ Saldo NEGATIVO! Você deve ao Mercado Pago. Pague para liberar os pagamentos",
        hasProblems.pending_charges && "⚠️ Há cobranças pendentes na sua conta",
        !hasProblems.account_restricted && !hasProblems.negative_balance && !hasProblems.pending_charges && "✅ Sua conta parece OK! O problema pode ser no checkout",
      ].filter(Boolean),
    });
  } catch (e) {
    return Response.json({
      error: "Erro ao conectar",
      message: String(e),
    }, { status: 500 });
  }
}
