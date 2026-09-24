export type BrazilianTaxIdType = "CPF" | "CNPJ";

export function normalizeBrazilianTaxId(value: string): string {
  const cleaned = value.toUpperCase().replace(/[^\dA-Z]/g, "");
  return cleaned.length === 14 ? cleaned : cleaned.replace(/\D/g, "");
}

export function getBrazilianTaxIdType(value: string): BrazilianTaxIdType | null {
  const digits = normalizeBrazilianTaxId(value);
  if (digits.length === 11) return "CPF";
  if (digits.length === 14) return "CNPJ";
  return null;
}

export function isValidBrazilianTaxId(value: string): boolean {
  const digits = normalizeBrazilianTaxId(value);
  const isCpf = /^\d{11}$/.test(digits);
  const isCnpj = /^[A-Z0-9]{12}\d{2}$/.test(digits);
  if ((!isCpf && !isCnpj) || (isCpf && /^(\d)\1+$/.test(digits)) || (isCnpj && /^(.)\1{13}$/.test(digits))) return false;

  const calculate = (base: string, weights: number[]) => {
    const sum = [...base].reduce((total, character, index) => {
      const numericValue = /[A-Z]/.test(character) ? character.charCodeAt(0) - 48 : Number(character);
      return total + numericValue * weights[index];
    }, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  if (isCpf) {
    const first = calculate(digits.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
    const second = calculate(digits.slice(0, 9) + first, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    return digits.endsWith(`${first}${second}`);
  }

  const first = calculate(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculate(digits.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digits.endsWith(`${first}${second}`);
}
