import { createAdminClient } from "@/lib/supabase/admin";
import { CustomerStart } from "@/app/s/[qrToken]/CustomerStart";
import { buildMerchantBranding } from "@/lib/merchant/branding";
import { CustomerInvalidQr } from "@/app/t/CustomerInvalidQr";

export default async function SalaoStartPage({
  params,
  searchParams,
}: {
  params: Promise<{ qrToken: string }>;
  searchParams: Promise<{ error?: string; quick?: string }>;
}) {
  const { qrToken } = await params;
  const { error, quick } = await searchParams;


  const { data: token } = await createAdminClient()
    .from("beauty_qr_tokens")
    .select("id, label, merchant_id, is_active")
    .eq("qr_token", qrToken)
    .eq("is_active", true)
    .maybeSingle();

  if (!token) {
    return <CustomerInvalidQr backHref={null} />;
  }

  const merchantReader = createAdminClient();
  const { data: merchant } = await merchantReader
    .from("merchants")
    .select(
      "name, brand_display_name, brand_logo_url, brand_primary_color, customer_welcome_message",
    )
    .eq("id", token.merchant_id)
    .maybeSingle();

  const branding = merchant
    ? buildMerchantBranding(merchant)
    : { displayName: "Qerbie", logoUrl: null, primaryColor: null };

  return (
    <CustomerStart
      qrToken={qrToken}
      merchantName={branding.displayName}
      merchantLogoUrl={branding.logoUrl}
      merchantPrimaryColor={branding.primaryColor}
      welcomeMessage={merchant?.customer_welcome_message ?? null}
      tableLabel={token.label}
      error={error ?? null}
      quickMode={quick === "1"}
    />
  );
}
