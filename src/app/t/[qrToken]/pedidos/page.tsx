import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { CustomerOrdersShell } from "@/app/t/[qrToken]/pedidos/CustomerOrdersShell";
import { buildMerchantBranding } from "@/lib/merchant/branding";
import { CustomerInvalidQr } from "@/app/t/CustomerInvalidQr";
import { CUSTOMER_PLACE_COOKIE } from "@/lib/customer/constants";

type OrderItem = { product_name: string; quantity: number; unit_price: number; line_total: number; options: Array<{ option_group_name: string; option_name: string; price_modifier: number }> };
type CustomerOrderRow = {
  id: string;
  order_number: number;
  status: "pending" | "confirmed" | "preparing" | "ready" | "delivered" | "completed" | "cancelled";
  created_at: string;
  customer_notes: string | null;
  total: number | null;
  order_type: "dine_in" | "takeaway" | "delivery";
  delivery_address: string | null;
  delivery_fee: number | null;
  delivery_eta_minutes: number | null;
  items: OrderItem[];
};

export default async function CustomerOrdersPage({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}) {
  const { qrToken } = await params;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("qerbie_session")?.value ?? "";
  const place = cookieStore.get(CUSTOMER_PLACE_COOKIE)?.value ?? "";
  const supabase = await createClient({ "x-session-token": sessionToken });

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
      "name, business_category, brand_display_name, brand_logo_url, brand_primary_color, payment_pix_key, payment_pix_description, payment_card_url, payment_card_description, payment_cash_description, payment_disclaimer",
    )
    .eq("id", table.merchant_id)
    .maybeSingle();

  const branding = merchant
    ? buildMerchantBranding(merchant)
    : { displayName: "Qerbie", logoUrl: null as string | null, primaryColor: null as string | null };

  const { data: orders } = sessionToken
    ? await supabase
        .from("orders")
        .select("id, order_number, status, created_at, customer_notes, total, order_type, delivery_address, delivery_fee, delivery_eta_minutes")
        .eq("merchant_id", table.merchant_id)
        .eq("session_token", sessionToken)
        .eq("business_category", merchant?.business_category ?? "")
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [] };
  const orderIds = (orders ?? []).map((order) => order.id);
  const { data: orderItems } = orderIds.length
    ? await supabase
        .from("order_items")
        .select("id, order_id, product_name, quantity, unit_price, line_total")
        .eq("merchant_id", table.merchant_id)
        .in("order_id", orderIds)
    : { data: [] };
  const orderItemIds = (orderItems ?? []).map((item) => item.id);
  const { data: orderItemOptions } = orderItemIds.length
    ? await merchantReader
        .from("order_item_options")
        .select("order_item_id, option_group_name, option_name, price_modifier")
        .eq("merchant_id", table.merchant_id)
        .in("order_item_id", orderItemIds)
    : { data: [] };
  const optionsByItemId = new Map<string, Array<{ order_item_id: string; option_group_name: string; option_name: string; price_modifier: number }>>();
  for (const option of orderItemOptions ?? []) {
    const options = optionsByItemId.get(option.order_item_id) ?? [];
    options.push(option);
    optionsByItemId.set(option.order_item_id, options);
  }
  const itemsByOrderId = new Map<string, OrderItem[]>();
  for (const item of orderItems ?? []) {
    const items = itemsByOrderId.get(item.order_id) ?? [];
    items.push({
      product_name: item.product_name,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
      line_total: Number(item.line_total),
      options: (optionsByItemId.get(item.id) ?? []).map((option) => ({
        option_group_name: option.option_group_name,
        option_name: option.option_name,
        price_modifier: Number(option.price_modifier),
      })),
    });
    itemsByOrderId.set(item.order_id, items);
  }
  const initialOrders: CustomerOrderRow[] = (orders ?? []).map((order) => ({
    ...order,
    delivery_fee: order.delivery_fee == null ? null : Number(order.delivery_fee),
    total: order.total == null ? null : Number(order.total),
    items: itemsByOrderId.get(order.id) ?? [],
  }));

  return (
    <CustomerOrdersShell
      qrToken={qrToken}
      branding={{ displayName: branding.displayName, logoUrl: branding.logoUrl }}
      serviceLabel={place ? `${table.label} • ${place}` : table.label}
      sessionToken={sessionToken}
      initialOrders={initialOrders}
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
