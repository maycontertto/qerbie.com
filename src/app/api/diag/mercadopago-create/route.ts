import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const email = searchParams.get("email") || "test@qerbie.com";
  const amount = searchParams.get("amount") || "99.90";

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const appUrl = process.env.APP_URL;

  if (!accessToken || !appUrl) {
    return NextResponse.json(
      {
        ok: false,
        message: "Variáveis de ambiente faltando",
        env: {
          MERCADOPAGO_ACCESS_TOKEN: accessToken ? "✓ definido" : "✗ faltando",
          APP_URL: appUrl ? `✓ ${appUrl}` : "✗ faltando",
        },
      },
      { status: 400 }
    );
  }

  try {
    // Simula exatamente o que o código faz
    const invoiceId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const amountNum = parseFloat(amount);

    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Valor inválido",
          amount: amount,
          parsed: amountNum,
        },
        { status: 400 }
      );
    }

    const body = {
      items: [
        {
          title: "Qerbie • Plano Mensal",
          quantity: 1,
          currency_id: "BRL",
          unit_price: amountNum,
        },
      ],
      external_reference: invoiceId,
      statement_descriptor: "QERBIE",
      payer: {
        email: email,
      },
      notification_url: `${appUrl}/api/webhooks/mercadopago`,
      back_urls: {
        success: `${appUrl}/dashboard/pagamento?status=success`,
        failure: `${appUrl}/dashboard/pagamento?status=failure`,
      },
      auto_return: "approved",
    };

    console.log("[MP Debug] Enviando para MP:", {
      url: "https://api.mercadopago.com/checkout/preferences",
      body: body,
      token: accessToken.substring(0, 30) + "...",
    });

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    console.log("[MP Debug] Resposta do MP (status", res.status, "):", data);

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: `Erro do Mercado Pago (HTTP ${res.status})`,
          error: data,
          request_body: body,
        },
        { status: res.status }
      );
    }

    if (!data.id || (!data.init_point && !data.sandbox_init_point)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Resposta do MP incompleta (sem id ou init_point)",
          response: data,
        },
        { status: 500 }
      );
    }

    const paymentUrl = data.init_point || data.sandbox_init_point;

    return NextResponse.json(
      {
        ok: true,
        message: "Preferência criada com sucesso",
        invoice_id: invoiceId,
        preference: {
          id: data.id,
          init_point: data.init_point,
          sandbox_init_point: data.sandbox_init_point,
        },
        payment_url: paymentUrl,
        test_url: `${paymentUrl}`,
        params: {
          email: email,
          amount: amountNum,
          app_url: appUrl,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[MP Debug] Exception:", errorMsg, error);

    return NextResponse.json(
      {
        ok: false,
        message: "Erro ao criar preferência",
        error: errorMsg,
      },
      { status: 500 }
    );
  }
}
