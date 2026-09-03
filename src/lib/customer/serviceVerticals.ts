export type ServiceVerticalKey = "b" | "e" | "g" | "l" | "p" | "s";

interface ServiceVerticalConfig {
  /** Header enviado ao createClient() para a policy RLS de acesso anônimo por QR (ver src/lib/supabase/server.ts). */
  qrHeaderName: string;
  qrTokenTable: string;
  servicesTable: string;
  label: string;
}

/**
 * As verticais de serviço (diferente do restaurante `t`, que vende
 * PRODUTOS via carrinho) compartilham exatamente o mesmo formato de tabela
 * para as páginas com fila/agenda (name, description, price_cents,
 * duration_min, is_active), enquanto a academia usa uma tabela própria de
 * serviços adicionais (name, price_cents, is_active).
 * Por isso um único core (src/lib/customer/serviceAssistantReply.ts)
 * atende todas sem duplicar rota por vertical.
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
  g: {
    qrHeaderName: "x-gym-qr-token",
    qrTokenTable: "gym_qr_tokens",
    servicesTable: "gym_additional_services",
    label: "academia",
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
