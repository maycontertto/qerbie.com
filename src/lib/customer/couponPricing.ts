export type CouponPricingRow = {
  code: string;
  discount_type: string;
  discount_value: number | string;
  minimum_subtotal: number | string;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
};

export function priceCoupon(coupon: CouponPricingRow, subtotal: number, now = new Date()): { discount: number } | null {
  const value = Number(coupon.discount_value);
  const minimum = Number(coupon.minimum_subtotal);
  if (!coupon.is_active || !Number.isFinite(value) || !Number.isFinite(minimum) || subtotal < minimum) return null;
  if (coupon.valid_from && now < new Date(coupon.valid_from)) return null;
  if (coupon.valid_until && now > new Date(coupon.valid_until)) return null;
  const raw = coupon.discount_type === "percent" ? subtotal * value / 100 : coupon.discount_type === "fixed" ? value : NaN;
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return { discount: Math.round(Math.min(subtotal, raw) * 100) / 100 };
}
