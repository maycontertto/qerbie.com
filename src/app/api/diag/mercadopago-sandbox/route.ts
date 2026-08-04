export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const appUrl = process.env.APP_URL || "https://www.qerbie.com";

  if (!accessToken) {
    return Response.json({ error: "Token não configurado" }, { status: 400 });
  }

  const url = new URL(req.url);
  const email = url.searchParams.get("email") || "test@example.com";
  const amount = parseFloat(url.searchParams.get("amount") || "29.90");

  if (isNaN(amount) || amount <= 0) {
    return Response.json({ error: "Amount inválido" }, { status: 400 });
  }

  try {
    const invoiceId = `sandbox-test-${Date.now()}`;
    const externalRef = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Preference com TODOS os parâmetros possíveis para sandbox
    const body = {
      items: [
        {
          id: externalRef,
          title: "Teste Sandbox Qerbie",
          description: "Pagamento de teste em ambiente sandbox",
          quantity: 1,
          currency_id: "BRL",
          unit_price: amount,
          category_id: "other",
        },
      ],
      payer: {
        email: email,
        name: "Comprador Teste",
        phone: {
          area_code: "11",
          number: "999999999",
        },
        address: {
          zip_code: "12345",
          street_name: "Rua Teste",
          street_number: 1,
          city_name: "São Paulo",
          state_name: "SP",
          country_name: "Brasil",
        },
      },
      back_urls: {
        success: `${appUrl}/dashboard/pagamento?status=success`,
        failure: `${appUrl}/dashboard/pagamento?status=failure`,
        pending: `${appUrl}/dashboard/pagamento?status=pending`,
      },
      auto_return: "approved",
      notification_url: `${appUrl}/api/webhooks/mercadopago`,
      external_reference: externalRef,
      statement_descriptor: "QERBIE",
      marketplace: `MP-MKT-${accessToken.split("-")[1] || "test"}`,
      processing_modes: "aggregator",
      purpose: "onboarding",
    };

    console.log("📦 Enviando preference sandbox:", JSON.stringify(body, null, 2));

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": "Qerbie/1.0",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("❌ Erro da API MP:", res.status, errText);
      return Response.json({
        ok: false,
        status: res.status,
        error: errText,
        debug: {
          request_body: body,
          token_sample: accessToken.substring(0, 20) + "...",
          app_url: appUrl,
        },
      }, { status: res.status });
    }

    const data = await res.json();

    return Response.json({
      ok: true,
      invoice_id: invoiceId,
      preference: data,
      payment_urls: {
        production: data.init_point,
        sandbox: data.sandbox_init_point,
      },
      test_instructions: [
        "1️⃣ Use o SANDBOX link abaixo para testar",
        "2️⃣ Se funcionar em sandbox = conta bloqueada para produção",
        "3️⃣ Se NÃO funcionar nem em sandbox = problema maior na configuração",
      ],
      sandbox_payment_url: data.sandbox_init_point,
      test_url: `https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=${data.id}`,
      params: {
        email,
        amount,
        app_url: appUrl,
      },
    });
  } catch (e) {
    console.error("❌ Erro ao criar preference:", e);
    return Response.json(
      {
        error: "Erro ao criar preference",
        message: String(e),
        debug: {
          accessToken: accessToken ? "presente" : "faltando",
          appUrl,
        },
      },
      { status: 500 }
    );
  }
}
