import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasMemberPermission } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

async function canLookupProducts() {
  const supabase = await createClient({}, { withAuth: true });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: owned } = await supabase
    .from("merchants")
    .select("id")
    .eq("owner_user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (owned) return true;

  const { data: member } = await supabase
    .from("merchant_members")
    .select("merchant_id, role, permissions")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return Boolean(
    member &&
    hasMemberPermission(member.role, member.permissions, "dashboard_access") &&
    hasMemberPermission(member.role, member.permissions, "dashboard_products"),
  );
}

export async function GET(request: Request) {
  if (!(await canLookupProducts())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const code = new URL(request.url).searchParams.get("code")?.trim() ?? "";
  if (!/^\d{8,14}$/.test(code)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  const url = new URL(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`);
  url.searchParams.set("fields", "status,product_name,product_name_pt,brands,quantity,categories,categories_tags,image_front_url");

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Qerbie/1.0 (https://www.qerbie.com)" },
      signal: AbortSignal.timeout(7000),
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!response.ok) {
      return NextResponse.json({ error: "provider_unavailable" }, { status: 502 });
    }

    const payload = await response.json() as {
      status?: number;
      product?: {
        product_name?: string;
        product_name_pt?: string;
        brands?: string;
        quantity?: string;
        categories?: string;
        categories_tags?: string[];
        image_front_url?: string;
      };
    };

    if (payload.status !== 1 || !payload.product) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const product = payload.product;
    const name = product.product_name_pt?.trim() || product.product_name?.trim() || "";
    if (!name) return NextResponse.json({ error: "incomplete_product" }, { status: 404 });

    return NextResponse.json({
      name,
      brand: product.brands?.split(",")[0]?.trim() || null,
      quantity: product.quantity?.trim() || null,
      category: product.categories?.split(",")[0]?.trim() || product.categories_tags?.[0]?.split(":").pop() || null,
      imageUrl: product.image_front_url || null,
      source: "Open Food Facts",
    }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch {
    return NextResponse.json({ error: "provider_unavailable" }, { status: 502 });
  }
}
