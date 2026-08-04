import { NextResponse } from "next/server";

export async function GET() {
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
    // Testa criação de preferência de teste
    const testPreference = {
      items: [
        {
          title: "Test Payment - Qerbie",
          quantity: 1,
          currency_id: "BRL",
          unit_price: 1.0,
        },
      ],
      external_reference: `test-${Date.now()}`,
      statement_descriptor: "QERBIE",
      notification_url: `${appUrl}/api/webhooks/mercadopago`,
      back_urls: {
        success: `${appUrl}/dashboard/pagamento?status=success`,
        failure: `${appUrl}/dashboard/pagamento?status=failure`,
      },
      auto_return: "approved",
    };

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testPreference),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: `Erro ao criar preferência (HTTP ${res.status})`,
          error: data,
          request: {
            url: "https://api.mercadopago.com/checkout/preferences",
            token_sample: accessToken.substring(0, 20) + "...",
            notification_url: `${appUrl}/api/webhooks/mercadopago`,
          },
        },
        { status: res.status }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Conexão com Mercado Pago OK ✓",
        preference: {
          id: data.id,
          init_point: data.init_point,
          sandbox_init_point: data.sandbox_init_point,
        },
        test_payment_url: data.init_point || data.sandbox_init_point,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Erro ao conectar com Mercado Pago",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
