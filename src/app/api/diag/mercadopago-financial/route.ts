export const dynamic = "force-dynamic";

type SettlementTransaction = {
  status?: string;
  date?: string;
  gross_amount?: number;
  net_amount?: number;
  fee_amount?: number;
  type?: string;
};

type MercadoPagoBalance = {
  available_balance?: number;
  unavailable_balance?: number;
};

type MercadoPagoRestriction = {
  reason?: string;
  status?: string;
  type?: string;
};

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

    let transactions: SettlementTransaction[] = [];
    if (transactionsRes.ok) {
      const data = (await transactionsRes.json()) as { results?: SettlementTransaction[] };
      transactions = data.results ?? [];
    }

    // Pega saldo da conta
    const balanceRes = await fetch("https://api.mercadopago.com/v1/account/balance", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let balance: MercadoPagoBalance | null = null;
    if (balanceRes.ok) {
      balance = (await balanceRes.json()) as MercadoPagoBalance;
    }

    // Pega informações do usuário (para ver restrições)
    const userRes = await fetch("https://api.mercadopago.com/v1/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let restrictions: MercadoPagoRestriction[] = [];
    if (userRes.ok) {
      const user = (await userRes.json()) as { restrictions?: MercadoPagoRestriction[] };
      restrictions = user.restrictions ?? [];
    }

    // Analisa se há problemas
    const hasProblems = {
      account_restricted: restrictions.length > 0,
      negative_balance: Boolean(balance && (balance.available_balance ?? 0) < 0),
      pending_charges: transactions.some((transaction) => transaction.status === "pending"),
    };

    return Response.json({
      ok: true,
      account_health: {
        has_restrictions: restrictions.length > 0,
        restrictions: restrictions.map((restriction) => ({
          reason: restriction.reason,
          status: restriction.status,
          type: restriction.type,
        })),
        balance: balance ? {
          available: balance.available_balance ?? 0,
          unavailable: balance.unavailable_balance ?? 0,
          total: (balance.available_balance ?? 0) + (balance.unavailable_balance ?? 0),
        } : null,
      },
      recent_transactions: transactions.slice(0, 10).map((transaction) => ({
        date: transaction.date,
        gross_amount: transaction.gross_amount,
        net_amount: transaction.net_amount,
        fee_amount: transaction.fee_amount,
        status: transaction.status,
        type: transaction.type,
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
