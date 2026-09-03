export type ServiceVerticalKey = "b" | "e" | "l" | "p" | "s";

interface ServiceVerticalConfig {
  /** Header enviado ao createClient() para a policy RLS de acesso anônimo por QR (ver src/lib/supabase/server.ts). */
  qrHeaderName: string;
  qrTokenTable: string;
  servicesTable: string;
  label: string;
}

/**
 * As 5 verticais de serviço (diferente do restaurante `t`, que vende
 * PRODUTOS via carrinho) compartilham exatamente o mesmo formato de tabela
 * de serviço (name, description, price_cents, duration_min, is_active) —
 * ver integrations/supabase/schema/035_barbearias.sql..039_lavajato.sql.
 * Por isso um único core (src/lib/customer/serviceAssistantReply.ts)
 * atende todas, em vez de duplicar 5 vezes.
 */
export const SERVICE_VERTICALS: Record<ServiceVerticalKey, ServiceVerticalConfig> = {
  b: {
    qrHeaderName: "x-barbershop-qr-token",
    qrTokenTable: "barbershop_qr_tokens",
    servicesTable: "barbershop_services",
    label: "barbearia",
  },
  e: {
    qrHeaderName: "x-aesthetic-qr-token",
    qrTokenTable: "aesthetic_qr_tokens",
    servicesTable: "aesthetic_services",
    label: "clínica de estética",
  },
  l: {
    qrHeaderName: "x-carwash-qr-token",
    qrTokenTable: "carwash_qr_tokens",
    servicesTable: "carwash_services",
    label: "lava-jato",
  },
  p: {
    qrHeaderName: "x-pet-qr-token",
    qrTokenTable: "pet_qr_tokens",
    servicesTable: "pet_services",
    label: "pet shop",
  },
  s: {
    qrHeaderName: "x-beauty-qr-token",
    qrTokenTable: "beauty_qr_tokens",
    servicesTable: "beauty_services",
    label: "salão de beleza",
  },
};

export function isServiceVerticalKey(value: string): value is ServiceVerticalKey {
  return Object.prototype.hasOwnProperty.call(SERVICE_VERTICALS, value);
}
