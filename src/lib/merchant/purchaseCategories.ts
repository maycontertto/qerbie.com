import type { BusinessCategoryKey } from "@/lib/merchant/businessCategories";

export const PURCHASE_ENTRY_CATEGORY_KEYS = ["mercado", "acaiteria_sorveteria", "bares", "restaurante"] as const satisfies BusinessCategoryKey[];

export function supportsPurchaseEntries(category: string | null | undefined): category is (typeof PURCHASE_ENTRY_CATEGORY_KEYS)[number] {
  return PURCHASE_ENTRY_CATEGORY_KEYS.includes(category as (typeof PURCHASE_ENTRY_CATEGORY_KEYS)[number]);
}