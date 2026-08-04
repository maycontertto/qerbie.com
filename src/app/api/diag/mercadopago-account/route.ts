export const dynamic = "force-dynamic";

export async function GET() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!accessToken) {
    return Response.json({ error: "Token não configurado" }, { status: 400 });
  }

  try {
    // Pega informações da conta
    const accountRes = await fetch("https://api.mercadopago.com/v1/accounts/search", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let accountData = null;
    if (accountRes.ok) {
      accountData = await accountRes.json();
    }

    // Pega informações do usuário
    const userRes = await fetch("https://api.mercadopago.com/v1/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let userData = null;
    if (userRes.ok) {
      userData = await userRes.json();
    }

    // Tenta criar uma preferência de teste
    const testPreference = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            id: "test-item",
            title: "Teste",
            quantity: 1,
            currency_id: "BRL",
            unit_price: 10,
          },
        ],
        external_reference: `diag-${Date.now()}`,
        payer: {
          email: "test@example.com",
        },
      }),
    });

    const prefData = await testPreference.json();

    return Response.json({
      ok: true,
      token_valid: !!accessToken,
      account: accountData,
      user: userData ? {
        id: userData.id,
        email: userData.email,
        type: userData.type,
        status: userData.status,
        site_id: userData.site_id,
        country_id: userData.country_id,
      } : null,
      preference_creation: {
        success: testPreference.ok,
        status: testPreference.status,
        data: prefData,
      },
      instructions: [
        "1. Acesse: https://www.mercadopago.com.br/settings/account",
        "2. Verifique se está tudo ativado:",
        "   - Conta verificada ✓",
        "   - Email confirmado ✓",
        "   - Dados pessoais completos ✓",
        "   - Banco conectado ✓",
        "   - Não há alertas de segurança",
        "3. Vá em Integração > Credenciais de Produção",
        "4. Teste com token de SANDBOX primeiro",
      ],
    });
  } catch (e) {
    return Response.json({
      error: "Erro ao conectar",
      message: String(e),
    }, { status: 500 });
  }
}
