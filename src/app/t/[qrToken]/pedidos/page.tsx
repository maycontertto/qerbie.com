import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { CustomerOrdersShell } from "@/app/t/[qrToken]/pedidos/CustomerOrdersShell";
import { buildMerchantBranding } from "@/lib/merchant/branding";
import { CustomerInvalidQr } from "@/app/t/CustomerInvalidQr";
import { CUSTOMER_PLACE_COOKIE } from "@/lib/customer/constants";

export default async function CustomerOrdersPage({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}) {
  const { qrToken } = await params;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("qerbie_session")?.value ?? "";
  const place = cookieStore.get(CUSTOMER_PLACE_COOKIE)?.value ?? "";

  const { data: table } = await createAdminClient()
    .from("merchant_tables")
    .select("id, label, merchant_id")
    .eq("qr_token", qrToken)
    .eq("is_active", true)
    .maybeSingle();

  if (!table) {
    return <CustomerInvalidQr backHref={null} />;
  }

  const merchantReader = createAdminClient();
  const { data: merchant } = await merchantReader
    .from("merchants")
    .select(
      "name, brand_display_name, brand_logo_url, brand_primary_color, payment_pix_key, payment_pix_description, payment_card_url, payment_card_description, payment_cash_description, payment_disclaimer",
    )
    .eq("id", table.merchant_id)
    .maybeSingle();

  const branding = merchant
    ? buildMerchantBranding(merchant)
    : { displayName: "Qerbie", logoUrl: null as string | null, primaryColor: null as string | null };

  return (
    <CustomerOrdersShell
      qrToken={qrToken}
      branding={{ displayName: branding.displayName, logoUrl: branding.logoUrl }}
      serviceLabel={place ? `${table.label} • ${place}` : table.label}
      sessionToken={sessionToken}
      initialOrders={[]}
      paymentSettings={
        merchant
          ? {
              pixKey: merchant.payment_pix_key ?? null,
              pixDescription: merchant.payment_pix_description ?? null,
              cardUrl: merchant.payment_card_url ?? null,
              cardDescription: merchant.payment_card_description ?? null,
              cashDescription: merchant.payment_cash_description ?? null,
              disclaimer: merchant.payment_disclaimer ?? null,
            }
          : {
              pixKey: null,
              pixDescription: null,
              cardUrl: null,
              cardDescription: null,
              cashDescription: null,
              disclaimer: null,
            }
      }
    />
  );
}
