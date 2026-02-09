export interface MerchantBranding {
  displayName: string;
  logoUrl: string | null;
  primaryColor: string | null;
}

export function normalizeHexColor(input: string | null | undefined): string | null {
  if (!input) return null;
  const v = input.trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(v)) return null;
  return v;
}

export function buildMerchantBranding(merchant: {
  name: string;
  brand_display_name?: string | null;
  brand_logo_url?: string | null;
  brand_primary_color?: string | null;
}): MerchantBranding {
  const displayName = (merchant.brand_display_name ?? "").trim() || merchant.name;
  const logoUrl = (merchant.brand_logo_url ?? "").trim() || null;
  const primaryColor = normalizeHexColor(merchant.brand_primary_color);

  return { displayName, logoUrl, primaryColor };
}

export function getButtonStyle(primaryColor: string | null): {
  style?: React.CSSProperties;
  className: string;
} {
  if (!primaryColor) {
    return {
      className:
        "w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200",
    };
  }

  return {
    style: { backgroundColor: primaryColor },
    className:
      "w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90",
  };
}
