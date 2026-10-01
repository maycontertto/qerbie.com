import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type RequestedMenuOptionLine = {
  productId: string;
  optionIds: string[];
};

export type MenuOrderOptionSnapshot = {
  optionId: string;
  groupName: string;
  optionName: string;
  priceModifier: number;
};

export async function resolveMenuOptions(
  admin: SupabaseClient<Database>,
  merchantId: string,
  businessCategory: string,
  items: RequestedMenuOptionLine[],
): Promise<{ snapshots: MenuOrderOptionSnapshot[][] | null; error: "invalid_options" | "options_unavailable" | null }> {
  const productIds = Array.from(new Set(items.map((item) => item.productId)));
  const { data: groups, error: groupsError } = await admin
    .from("product_option_groups")
    .select("id, product_id, name, selection_type, is_required, min_selections, max_selections")
    .eq("merchant_id", merchantId)
    .eq("business_category", businessCategory)
    .in("product_id", productIds);

  if (groupsError) return { snapshots: null, error: "options_unavailable" };
  const groupIds = (groups ?? []).map((group) => group.id);
  const { data: options, error: optionsError } = groupIds.length
    ? await admin
        .from("product_options")
        .select("id, option_group_id, name, price_modifier, is_active")
        .eq("merchant_id", merchantId)
        .eq("business_category", businessCategory)
        .eq("is_active", true)
        .in("option_group_id", groupIds)
    : { data: [], error: null };

  if (optionsError) return { snapshots: null, error: "options_unavailable" };
  const optionsByGroup = new Map<string, Array<{ id: string; option_group_id: string; name: string; price_modifier: number; is_active: boolean }>>();
  for (const option of options ?? []) {
    const groupOptions = optionsByGroup.get(option.option_group_id) ?? [];
    groupOptions.push(option);
    optionsByGroup.set(option.option_group_id, groupOptions);
  }
  const groupsByProduct = new Map<string, typeof groups>();
  for (const group of groups ?? []) {
    const productGroups = groupsByProduct.get(group.product_id) ?? [];
    productGroups.push(group);
    groupsByProduct.set(group.product_id, productGroups);
  }

  const snapshots: MenuOrderOptionSnapshot[][] = [];
  for (const item of items) {
    const productGroups = groupsByProduct.get(item.productId) ?? [];
    const selectedIds = Array.from(new Set(item.optionIds));
    const selectedSnapshots: MenuOrderOptionSnapshot[] = [];
    const acceptedIds = new Set<string>();

    for (const group of productGroups) {
      const selected = (optionsByGroup.get(group.id) ?? []).filter((option) => selectedIds.includes(option.id));
      const minimum = Math.max(group.min_selections, group.is_required ? 1 : 0);
      if (selected.length < minimum || selected.length > group.max_selections) {
        return { snapshots: null, error: "invalid_options" };
      }
      for (const option of selected) {
        acceptedIds.add(option.id);
        selectedSnapshots.push({
          optionId: option.id,
          groupName: group.name,
          optionName: option.name,
          priceModifier: Number(option.price_modifier ?? 0),
        });
      }
    }

    if (acceptedIds.size !== selectedIds.length) return { snapshots: null, error: "invalid_options" };
    snapshots.push(selectedSnapshots);
  }

  return { snapshots, error: null };
}
