type MercadoPagoPreferenceResponse = {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
};

export async function createMercadoPagoCheckoutPreference(input: {
  accessToken: string;
  title: string;
  amount: number;
  externalReference: string;
  payerEmail?: string | null;
  notificationUrl?: string;
  successUrl?: string;
  failureUrl?: string;
}): Promise<{ preferenceId: string; paymentUrl: string }>{
  const url = "https://api.mercadopago.com/checkout/preferences";

  const body: Record<string, unknown> = {
    items: [
      {
        title: input.title,
        quantity: 1,
        currency_id: "BRL",
        unit_price: Number(input.amount),
      },
    ],
    external_reference: input.externalReference,
    statement_descriptor: "QERBIE",
  };

  if (input.payerEmail) {
    body.payer = { email: input.payerEmail };
  }

  if (input.notificationUrl) {
    body.notification_url = input.notificationUrl;
  }

  if (input.successUrl || input.failureUrl) {
    body.back_urls = {
      ...(input.successUrl ? { success: input.successUrl } : null),
      ...(input.failureUrl ? { failure: input.failureUrl } : null),
    };
    body.auto_return = "approved";
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Mercado Pago preference failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as MercadoPagoPreferenceResponse;
  const paymentUrl = data.init_point ?? data.sandbox_init_point;
  if (!data.id || !paymentUrl) {
    throw new Error("Mercado Pago preference missing id/init_point");
  }

  return { preferenceId: data.id, paymentUrl };
}

type MercadoPagoPayment = {
  id: number;
  status: string;
  external_reference?: string | null;
  transaction_amount?: number | null;
  date_approved?: string | null;
};

export async function fetchMercadoPagoPayment(input: {
  accessToken: string;
  paymentId: string;
}): Promise<MercadoPagoPayment> {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(input.paymentId)}`,
    {
      headers: { Authorization: `Bearer ${input.accessToken}` },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Mercado Pago payment fetch failed: ${res.status} ${text}`);
  }

  return (await res.json()) as MercadoPagoPayment;
}
