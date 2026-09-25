import { createAdminClient } from "@/lib/supabase/admin";
import { buildMerchantBranding } from "@/lib/merchant/branding";
import { CustomerMenuShell } from "@/app/t/[qrToken]/menu/CustomerMenuShell";
import { cookies } from "next/headers";
import { CUSTOMER_PLACE_COOKIE, CUSTOMER_SESSION_COOKIE } from "@/lib/customer/constants";
import { CustomerInvalidQr } from "@/app/t/CustomerInvalidQr";

export default async function CustomerMenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ qrToken: string }>;
  searchParams: Promise<{ menu?: string }>;
}) {
  const { qrToken } = await params;
  const { menu: menuParam } = await searchParams;
  const cookieStore = await cookies();
  const hasSession = Boolean(cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value);
  const place = cookieStore.get(CUSTOMER_PLACE_COOKIE)?.value ?? "";

  const { data: table } = await createAdminClient()
    .from("merchant_tables")
    .select("merchant_id, label")
    .eq("qr_token", qrToken)
    .eq("is_active", true)
    .maybeSingle();

  if (!table) {
    return <CustomerInvalidQr backHref={`/t/${encodeURIComponent(qrToken)}`} />;
  }

  const merchantReader = createAdminClient();
  const { data: merchant } = await merchantReader
    .from("merchants")
    .select("id, name, business_category, brand_display_name, brand_logo_url, brand_primary_color, customer_welcome_message, delivery_enabled, delivery_fee, delivery_note, delivery_eta_minutes, support_whatsapp_url, support_hours, support_email, support_phone, payment_pix_key, payment_pix_description, payment_card_url, payment_card_description, payment_cash_description, payment_disclaimer")
    .eq("id", table.merchant_id)
    .maybeSingle();

  const branding = merchant
    ? buildMerchantBranding(merchant)
    : { displayName: "Qerbie", logoUrl: null, primaryColor: null };

  const deliverySettings = merchant
    ? {
        enabled: Boolean(merchant.delivery_enabled),
        fee: merchant.delivery_fee,
        note: merchant.delivery_note,
        etaMinutes: merchant.delivery_eta_minutes,
      }
    : { enabled: false, fee: null, note: null, etaMinutes: null };

  const supportContact = merchant
    ? {
        whatsappUrl: merchant.support_whatsapp_url,
        hours: merchant.support_hours,
        email: merchant.support_email,
        phone: merchant.support_phone,
      }
    : { whatsappUrl: null, hours: null, email: null, phone: null };

  const { data: menus } = await merchantReader
    .from("menus")
    .select("id, name, description, slug")
    .eq("merchant_id", table.merchant_id)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  const activeMenuId =
    menuParam && menus?.some((m) => m.id === menuParam)
      ? menuParam
      : menus?.[0]?.id ?? null;

  const { data: categories } = activeMenuId
    ? await merchantReader
        .from("menu_categories")
        .select("id, name, description")
        .eq("merchant_id", table.merchant_id)
        .eq("menu_id", activeMenuId)
        .eq("is_active", true)
        .order("display_order", { ascending: true })
    : {
        data: [] as Array<{ id: string; name: string; description: string | null }>,
      };

  const { data: products } = activeMenuId
    ? await merchantReader
        .from("products")
        .select(
          "id, category_id, name, description, price, image_url, is_featured, requires_prescription, requires_document",
        )
        .eq("merchant_id", table.merchant_id)
        .eq("menu_id", activeMenuId)
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false })
    : {
        data: [] as Array<{
          id: string;
          category_id: string | null;
          name: string;
          description: string | null;
          price: number | null;
          image_url: string | null;
          is_featured: boolean;
          requires_prescription: boolean;
          requires_document: boolean;
        }>,
      };

  return (
    <CustomerMenuShell
      qrToken={qrToken}
      tableLabel={place ? `${table.label} • ${place}` : table.label}
      branding={branding}
      welcomeMessage={merchant?.customer_welcome_message ?? null}
      hasSession={hasSession}
      menus={(menus ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
      }))}
      activeMenuId={activeMenuId}
      categories={categories ?? []}
      products={products ?? []}
      deliverySettings={deliverySettings}
      supportContact={supportContact}
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
