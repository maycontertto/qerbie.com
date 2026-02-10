export const BILLING_PLAN = {
  amountCents: 2990,
  currency: "BRL",
  trialDays: 30,
  graceDays: 3,
} as const;

export function formatBrlFromCents(cents: number): string {
  const value = Math.round(cents) / 100;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
