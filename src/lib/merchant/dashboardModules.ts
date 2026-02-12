import type { BusinessCategoryKey } from "@/lib/merchant/businessCategories";

export type DashboardSectionKey =
  | "catalogo"
  | "atendimento"
  | "vendas"
  | "historico";

export interface DashboardCardModel {
  title: string;
  description: string;
  hint: string;
  href?: string;
  ctaLabel?: string;
}

export interface DashboardModules {
  headerNudge: string;
  sections: Record<Exclude<DashboardSectionKey, "historico">, DashboardCardModel[]>;
}

const STOCK_CARD: DashboardCardModel = {
  title: "Estoque",
  description: "Controle simples (opcional)",
  hint: "Agora",
  href: "/dashboard/modulos/estoque",
  ctaLabel: "Abrir",
};

const PRODUCTS_CARD: DashboardCardModel = {
  title: "Produtos",
  description: "Cadastro de produtos e preços",
  hint: "Agora",
  href: "/dashboard/modulos/produtos",
  ctaLabel: "Abrir",
};

function withStockInCatalog(modules: DashboardModules): DashboardModules {
  const catalog = modules.sections.catalogo ?? [];
  const alreadyHasStock = catalog.some(
    (card) => card.href === STOCK_CARD.href || card.title.toLowerCase() === "estoque",
  );

  if (alreadyHasStock) return modules;

  return {
    ...modules,
    sections: {
      ...modules.sections,
      catalogo: [...catalog, STOCK_CARD],
    },
  };
}

function withProductsInCatalog(modules: DashboardModules): DashboardModules {
  const catalog = modules.sections.catalogo ?? [];
  const alreadyHasProducts = catalog.some((card) => {
    const href = card.href ?? "";
    return (
      card.title.toLowerCase() === "produtos" ||
      href === PRODUCTS_CARD.href ||
      href.startsWith(`${PRODUCTS_CARD.href}?`)
    );
  });

  if (alreadyHasProducts) return modules;

  return {
    ...modules,
    sections: {
      ...modules.sections,
      catalogo: [...catalog, PRODUCTS_CARD],
    },
  };
}

const GENERIC: DashboardModules = {
  headerNudge: "Módulos iniciais para seu negócio.",
  sections: {
    catalogo: [
      {
        title: "Itens",
        description: "Produtos/serviços, variações e preços",
        hint: "Pronto pra evoluir",
        href: "/dashboard/modulos/itens",
        ctaLabel: "Configurar agora",
      },
      {
        title: "Categorias",
        description: "Organize itens por grupos",
        hint: "Em breve",
        href: "/dashboard/modulos/categorias",
        ctaLabel: "Abrir",
      },
      {
        title: "Estoque",
        description: "Controle simples (opcional)",
        hint: "Em breve",
        href: "/dashboard/modulos/estoque",
        ctaLabel: "Abrir",
      },
    ],
    atendimento: [
      {
        title: "Operação",
        description: "Fluxos de atendimento do seu dia a dia",
        hint: "Em breve",
        href: "/dashboard/modulos/operacao",
        ctaLabel: "Abrir",
      },
      {
        title: "QR Code",
        description: "Fluxo do cliente via QR",
        hint: "Já começou",
        href: "/dashboard/modulos/qr",
        ctaLabel: "Abrir",
      },
      {
        title: "Configurações",
        description: "Regras e preferências",
        hint: "Em breve",
        href: "/dashboard/modulos/configuracoes",
        ctaLabel: "Abrir",
      },
    ],
    vendas: [
      {
        title: "Formas de pagamento",
        description: "Escolha Pix/link/dinheiro e o aviso pro cliente",
        hint: "Agora",
        href: "/dashboard/modulos/vendas",
        ctaLabel: "Configurar",
      },
      {
        title: "Cupons & Promoções",
        description: "Crie campanhas e descontos para aumentar vendas e fidelizar clientes.",
        hint: "Em breve",
        href: "/dashboard/modulos/cupons",
        ctaLabel: "Abrir",
      },
      {
        title: "Administração & Controle",
        description:
          "Cadastre atendentes/gerentes e controle os acessos por área (o dono pode restringir mesmo o gerente).",
        hint: "Agora",
        href: "/dashboard/modulos/administracao",
        ctaLabel: "Abrir",
      },
    ],
  },
};

const RESTAURANTE_BASE: DashboardModules = {
  headerNudge: "Cardápio, pedidos e atendimento por mesa.",
  sections: {
    catalogo: [
      {
        title: "Cardápios (Menus)",
        description: "Estruture seus menus e categorias",
        hint: "Próximo",
        href: "/dashboard/modulos/menus",
        ctaLabel: "Configurar agora",
      },
      {
        title: "Produtos",
        description: "Pratos, bebidas e adicionais",
        hint: "Próximo",
        href: "/dashboard/modulos/produtos",
        ctaLabel: "Configurar agora",
      },
      {
        title: "Estoque",
        description: "Controle simples (opcional)",
        hint: "Agora",
        href: "/dashboard/modulos/estoque",
        ctaLabel: "Abrir",
      },
      {
        title: "Opcionais",
        description: "Borda, tamanho, adicionais",
        hint: "Em breve",
        href: "/dashboard/modulos/opcionais",
        ctaLabel: "Abrir",
      },
    ],
    atendimento: [
      {
        title: "QR Code",
        description: "Mostre um QR para o cliente escanear",
        hint: "Agora",
        href: "/dashboard/modulos/qr",
        ctaLabel: "Abrir",
      },
      {
        title: "Mesas",
        description: "QR por mesa + status",
        hint: "Agora",
        href: "/dashboard/modulos/mesas",
        ctaLabel: "Configurar agora",
      },
      {
        title: "Pedidos (Tempo Real)",
        description: "Fila da cozinha e status",
        hint: "Agora",
        href: "/dashboard/modulos/pedidos",
        ctaLabel: "Abrir",
      },
      {
        title: "Retirada/Entrega",
        description: "Takeaway e delivery (opcional)",
        hint: "Agora",
        href: "/dashboard/modulos/entrega",
        ctaLabel: "Abrir",
      },
    ],
    vendas: [
      {
        title: "Formas de pagamento",
        description: "Escolha Pix/link/dinheiro e o aviso pro cliente",
        hint: "Agora",
        href: "/dashboard/modulos/vendas",
        ctaLabel: "Configurar",
      },
      {
        title: "Cupons & Promoções",
        description: "Crie campanhas e descontos para aumentar vendas e fidelizar clientes.",
        hint: "Em breve",
        href: "/dashboard/modulos/cupons",
        ctaLabel: "Abrir",
      },
      {
        title: "Administração & Controle",
        description:
          "Cadastre atendentes/gerentes e controle os acessos por área (o dono pode restringir mesmo o gerente).",
        hint: "Agora",
        href: "/dashboard/modulos/administracao",
        ctaLabel: "Abrir",
      },
    ],
  },
};

const MERCADO_BASE: DashboardModules = {
  headerNudge: "Catálogo, pedidos, retirada e entrega.",
  sections: {
    catalogo: [
      {
        title: "Produtos",
        description: "Nome, descrição, preço e foto",
        hint: "Agora",
        href: "/dashboard/modulos/produtos",
        ctaLabel: "Abrir",
      },
      {
        title: "Categorias",
        description: "Organize por seções (ex: Bebidas, Higiene)",
        hint: "Agora",
        href: "/dashboard/modulos/produtos",
        ctaLabel: "Abrir",
      },
      {
        title: "Estoque",
        description: "Visão rápida do que está disponível",
        hint: "Agora",
        href: "/dashboard/modulos/estoque",
        ctaLabel: "Abrir",
      },
      {
        title: "Equipe",
        description: "Cadastre atendentes/funcionários e controle acessos",
        hint: "Agora",
        href: "/dashboard/modulos/administracao",
        ctaLabel: "Abrir",
      },
    ],
    atendimento: [
      {
        title: "QR Code",
        description: "Mostre um QR para o cliente escanear",
        hint: "Agora",
        href: "/dashboard/modulos/qr",
        ctaLabel: "Abrir",
      },
      {
        title: "Pedidos",
        description: "Recebido → Em separação → Pronto → Finalizado",
        hint: "Agora",
        href: "/dashboard/modulos/pedidos",
        ctaLabel: "Abrir",
      },
      {
        title: "Retirada",
        description: "Pedidos para retirada (clique e retire)",
        hint: "Agora",
        href: "/dashboard/modulos/retirada",
        ctaLabel: "Abrir",
      },
      {
        title: "Entrega",
        description: "Pedidos para entrega e status",
        hint: "Agora",
        href: "/dashboard/modulos/entregas",
        ctaLabel: "Abrir",
      },
    ],
    vendas: [
      {
        title: "Cupons & Promoções",
        description: "Crie campanhas e descontos para aumentar vendas e fidelizar clientes.",
        hint: "Em breve",
        href: "/dashboard/modulos/cupons",
        ctaLabel: "Abrir",
      },
      {
        title: "Administração & Controle",
        description:
          "Cadastre atendentes/gerentes e controle os acessos por área (o dono pode restringir mesmo o gerente).",
        hint: "Agora",
        href: "/dashboard/modulos/administracao",
        ctaLabel: "Abrir",
      },
    ],
  },
};

const BARBEARIA_BASE: DashboardModules = {
  headerNudge: "Serviços, equipe, agenda e fila da barbearia.",
  sections: {
    catalogo: [
      {
        title: "Serviços",
        description: "Cortes, barba e adicionais",
        hint: "Agora",
        href: "/dashboard/modulos/barbearia_servicos",
        ctaLabel: "Abrir",
      },
      STOCK_CARD,
    ],
    atendimento: [
      {
        title: "Recepção (Fila)",
        description: "Filas por barbeiro/serviço",
        hint: "Agora",
        href: "/dashboard/modulos/recepcao",
        ctaLabel: "Abrir",
      },
      {
        title: "Agenda",
        description: "Horários e confirmações",
        hint: "Agora",
        href: "/dashboard/modulos/agenda",
        ctaLabel: "Abrir",
      },
      {
        title: "QR da barbearia",
        description: "Portal do cliente (fila/agendamento)",
        hint: "Agora",
        href: "/dashboard/modulos/barbearia_qr",
        ctaLabel: "Abrir",
      },
      {
        title: "Equipe",
        description: "Permissões e acessos",
        hint: "Agora",
        href: "/dashboard/modulos/administracao",
        ctaLabel: "Abrir",
      },
    ],
    vendas: [
      {
        title: "Formas de pagamento",
        description: "Pix/link/dinheiro e aviso pro cliente",
        hint: "Agora",
        href: "/dashboard/modulos/vendas",
        ctaLabel: "Configurar",
      },
    ],
  },
};

const ESTETICA_BASE: DashboardModules = {
  headerNudge: "Organize atendimentos, profissionais e pagamentos em um único painel.",
  sections: {
    catalogo: [
      {
        title: "Serviços",
        description: "Procedimentos, valores e duração",
        hint: "Agora",
        href: "/dashboard/modulos/estetica_servicos",
        ctaLabel: "Abrir",
      },
      STOCK_CARD,
    ],
    atendimento: [
      {
        title: "Profissionais",
        description: "Equipe e especialidades",
        hint: "Agora",
        href: "/dashboard/modulos/estetica_profissionais",
        ctaLabel: "Abrir",
      },
      {
        title: "Recepção (Fila)",
        description: "Chegada e atendimento por ordem",
        hint: "Agora",
        href: "/dashboard/modulos/recepcao",
        ctaLabel: "Abrir",
      },
      {
        title: "Agenda",
        description: "Horários e confirmações",
        hint: "Agora",
        href: "/dashboard/modulos/agenda",
        ctaLabel: "Abrir",
      },
      {
        title: "QR da estética",
        description: "Portal do cliente (procedimentos/agendamento)",
        hint: "Agora",
        href: "/dashboard/modulos/estetica_qr",
        ctaLabel: "Abrir",
      },
      {
        title: "Equipe",
        description: "Permissões e acessos",
        hint: "Agora",
        href: "/dashboard/modulos/administracao",
        ctaLabel: "Abrir",
      },
    ],
    vendas: [
      {
        title: "Formas de pagamento",
        description: "Pix/link/dinheiro e aviso pro cliente",
        hint: "Agora",
        href: "/dashboard/modulos/vendas",
        ctaLabel: "Configurar",
      },
    ],
  },
};

const SALAO_BASE: DashboardModules = {
  headerNudge: "Organize serviços, profissionais e atendimentos em um único painel.",
  sections: {
    catalogo: [
      {
        title: "Serviços",
        description: "Cortes, cores, tratamentos e valores",
        hint: "Agora",
        href: "/dashboard/modulos/salao_servicos",
        ctaLabel: "Abrir",
      },
      STOCK_CARD,
    ],
    atendimento: [
      {
        title: "Profissionais",
        description: "Equipe e serviços por profissional",
        hint: "Agora",
        href: "/dashboard/modulos/salao_profissionais",
        ctaLabel: "Abrir",
      },
      {
        title: "Recepção (Fila)",
        description: "Chegada e atendimento por ordem",
        hint: "Agora",
        href: "/dashboard/modulos/recepcao",
        ctaLabel: "Abrir",
      },
      {
        title: "Agenda",
        description: "Horários e confirmações",
        hint: "Agora",
        href: "/dashboard/modulos/agenda",
        ctaLabel: "Abrir",
      },
      {
        title: "QR do salão",
        description: "Portal do cliente (serviços/agendamento)",
        hint: "Agora",
        href: "/dashboard/modulos/salao_qr",
        ctaLabel: "Abrir",
      },
      {
        title: "Equipe",
        description: "Permissões e acessos",
        hint: "Agora",
        href: "/dashboard/modulos/administracao",
        ctaLabel: "Abrir",
      },
    ],
    vendas: [
      {
        title: "Formas de pagamento",
        description: "Pix/link/dinheiro e aviso pro cliente",
        hint: "Agora",
        href: "/dashboard/modulos/vendas",
        ctaLabel: "Configurar",
      },
    ],
  },
};

const PETSHOP_BASE: DashboardModules = {
  headerNudge: "Serviços, profissionais e atendimento do pet em um só lugar.",
  sections: {
    catalogo: [
      {
        title: "Serviços",
        description: "Banho, tosa, consulta, vacina e valores",
        hint: "Agora",
        href: "/dashboard/modulos/pet_servicos",
        ctaLabel: "Abrir",
      },
      {
        title: "Produtos",
        description: "Rações, petiscos e acessórios",
        hint: "Agora",
        href: "/dashboard/modulos/produtos",
        ctaLabel: "Abrir",
      },
      STOCK_CARD,
    ],
    atendimento: [
      {
        title: "Profissionais",
        description: "Equipe e serviços por profissional",
        hint: "Agora",
        href: "/dashboard/modulos/pet_profissionais",
        ctaLabel: "Abrir",
      },
      {
        title: "Recepção (Fila)",
        description: "Chegada e atendimento por ordem",
        hint: "Agora",
        href: "/dashboard/modulos/recepcao",
        ctaLabel: "Abrir",
      },
      {
        title: "Agenda",
        description: "Horários e confirmações",
        hint: "Agora",
        href: "/dashboard/modulos/agenda",
        ctaLabel: "Abrir",
      },
      {
        title: "Histórico do pet",
        description: "Preferências e ocorrências operacionais (sem prontuário)",
        hint: "Agora",
        href: "/dashboard/modulos/pet_historico",
        ctaLabel: "Abrir",
      },
      {
        title: "QR do pet shop",
        description: "Portal do cliente (serviços/agendamento)",
        hint: "Agora",
        href: "/dashboard/modulos/pet_qr",
        ctaLabel: "Abrir",
      },
      {
        title: "Equipe",
        description: "Permissões e acessos",
        hint: "Agora",
        href: "/dashboard/modulos/administracao",
        ctaLabel: "Abrir",
      },
    ],
    vendas: [
      {
        title: "Formas de pagamento",
        description: "Pix/link/dinheiro e aviso pro cliente",
        hint: "Agora",
        href: "/dashboard/modulos/vendas",
        ctaLabel: "Configurar",
      },
    ],
  },
};

const LAVAJATO_BASE: DashboardModules = {
  headerNudge: "Organize serviços, equipe e atendimento do seu lava jato em um único painel simples.",
  sections: {
    catalogo: [
      {
        title: "Serviços",
        description: "Lavagens, estética e pacotes",
        hint: "Agora",
        href: "/dashboard/modulos/lava_servicos",
        ctaLabel: "Abrir",
      },
      STOCK_CARD,
    ],
    atendimento: [
      {
        title: "Equipe",
        description: "Funcionários e serviços por função",
        hint: "Agora",
        href: "/dashboard/modulos/lava_profissionais",
        ctaLabel: "Abrir",
      },
      {
        title: "Recepção (Fila)",
        description: "Ordem de chegada e atendimento",
        hint: "Agora",
        href: "/dashboard/modulos/recepcao",
        ctaLabel: "Abrir",
      },
      {
        title: "Agenda",
        description: "Horários e confirmações (opcional)",
        hint: "Agora",
        href: "/dashboard/modulos/agenda",
        ctaLabel: "Abrir",
      },
      {
        title: "Histórico",
        description: "Atendimentos por veículo",
        hint: "Agora",
        href: "/dashboard/modulos/lava_historico",
        ctaLabel: "Abrir",
      },
      {
        title: "QR do lava jato",
        description: "Portal do cliente (fila/agendamento)",
        hint: "Agora",
        href: "/dashboard/modulos/lava_qr",
        ctaLabel: "Abrir",
      },
      {
        title: "Equipe (Permissões)",
        description: "Acessos e papéis",
        hint: "Agora",
        href: "/dashboard/modulos/administracao",
        ctaLabel: "Abrir",
      },
    ],
    vendas: [
      {
        title: "Formas de pagamento",
        description: "Pix/link/dinheiro e aviso pro cliente",
        hint: "Agora",
        href: "/dashboard/modulos/vendas",
        ctaLabel: "Configurar",
      },
    ],
  },
};

const CASA_RACAO_BASE: DashboardModules = {
  headerNudge: "Gestão simples de produtos, clientes e vendas em um só lugar.",
  sections: {
    catalogo: [
      {
        title: "Produtos",
        description: "Rações, suplementos, sementes e acessórios",
        hint: "Agora",
        href: "/dashboard/modulos/produtos",
        ctaLabel: "Abrir",
      },
      {
        title: "Variações (Peso)",
        description: "1kg, 5kg, 15kg, 25kg, 40kg",
        hint: "Agora",
        href: "/dashboard/modulos/variacoes",
        ctaLabel: "Abrir",
      },
      {
        title: "Relatórios",
        description: "Resumo de operação e indicadores",
        hint: "Agora",
        href: "/dashboard/modulos/relatorios",
        ctaLabel: "Abrir",
      },
      STOCK_CARD,
    ],
    atendimento: [
      {
        title: "Venda rápida (Caixa)",
        description: "Pedidos e vendas assistidas",
        hint: "Agora",
        href: "/dashboard/modulos/pedidos",
        ctaLabel: "Abrir",
      },
      {
        title: "Retirada",
        description: "Pedidos para retirada (separação)",
        hint: "Agora",
        href: "/dashboard/modulos/retirada",
        ctaLabel: "Abrir",
      },
      {
        title: "Entregas",
        description: "Pedidos para entrega e status",
        hint: "Agora",
        href: "/dashboard/modulos/entregas",
        ctaLabel: "Abrir",
      },
      {
        title: "Recepção (Separação)",
        description: "Em separação → Pronto → Finalizado (opcional)",
        hint: "Agora",
        href: "/dashboard/modulos/recepcao",
        ctaLabel: "Abrir",
      },
      {
        title: "Agenda",
        description: "Entregas programadas e recorrência (opcional)",
        hint: "Agora",
        href: "/dashboard/modulos/agenda",
        ctaLabel: "Abrir",
      },
      {
        title: "QR da casa de ração",
        description: "Cliente consulta catálogo e faz pedidos",
        hint: "Agora",
        href: "/dashboard/modulos/qr",
        ctaLabel: "Abrir",
      },
      {
        title: "Equipe",
        description: "Permissões de caixa/estoque/relatórios",
        hint: "Agora",
        href: "/dashboard/modulos/administracao",
        ctaLabel: "Abrir",
      },
    ],
    vendas: [
      {
        title: "Vendas & Formas de pagamento",
        description: "Pix/link/dinheiro e avisos pro cliente",
        hint: "Agora",
        href: "/dashboard/modulos/vendas",
        ctaLabel: "Abrir",
      },
      {
        title: "Trocas",
        description: "Cancelamentos e devoluções (opcional)",
        hint: "Agora",
        href: "/dashboard/modulos/trocas",
        ctaLabel: "Abrir",
      },
    ],
  },
};

const ACAITERIA_SORVETERIA_BASE: DashboardModules = {
  headerNudge: "Controle de pedidos, estoque e vendas em um só lugar.",
  sections: {
    catalogo: [
      {
        title: "Produtos",
        description: "Açaí, sorvetes, milkshakes, combos e adicionais",
        hint: "Agora",
        href: "/dashboard/modulos/produtos",
        ctaLabel: "Abrir",
      },
      {
        title: "Variações (Tamanhos)",
        description: "300ml, 500ml, 700ml, 1L e sabores",
        hint: "Agora",
        href: "/dashboard/modulos/variacoes",
        ctaLabel: "Abrir",
      },
      STOCK_CARD,
      {
        title: "Relatórios",
        description: "Resumo e indicadores de vendas",
        hint: "Agora",
        href: "/dashboard/modulos/relatorios",
        ctaLabel: "Abrir",
      },
    ],
    atendimento: [
      {
        title: "Modo Caixa (Pedido rápido)",
        description: "Montagem, adicionais e observações",
        hint: "Agora",
        href: "/dashboard/modulos/pedidos",
        ctaLabel: "Abrir",
      },
      {
        title: "Recepção / Fila de preparo",
        description: "Recebido → Em preparo → Pronto → Entregue",
        hint: "Agora",
        href: "/dashboard/modulos/recepcao",
        ctaLabel: "Abrir",
      },
      {
        title: "Retirada",
        description: "Pedidos para retirada (opcional)",
        hint: "Agora",
        href: "/dashboard/modulos/retirada",
        ctaLabel: "Abrir",
      },
      {
        title: "Entregas",
        description: "Pedidos para entrega e status (opcional)",
        hint: "Agora",
        href: "/dashboard/modulos/entregas",
        ctaLabel: "Abrir",
      },
      {
        title: "Agenda (Encomendas)",
        description: "Reservas e pedidos programados (opcional)",
        hint: "Agora",
        href: "/dashboard/modulos/agenda",
        ctaLabel: "Abrir",
      },
      {
        title: "QR da açaíteria",
        description: "Cliente acessa cardápio e faz pedidos",
        hint: "Agora",
        href: "/dashboard/modulos/qr",
        ctaLabel: "Abrir",
      },
      {
        title: "Equipe",
        description: "Permissões de caixa/relatórios/estoque",
        hint: "Agora",
        href: "/dashboard/modulos/administracao",
        ctaLabel: "Abrir",
      },
    ],
    vendas: [
      {
        title: "Vendas & Formas de pagamento",
        description: "Pix/link/dinheiro e avisos pro cliente",
        hint: "Agora",
        href: "/dashboard/modulos/vendas",
        ctaLabel: "Abrir",
      },
      {
        title: "Histórico de Vendas",
        description: "Pedidos finalizados e ticket médio",
        hint: "Agora",
        href: "/dashboard/modulos/historico",
        ctaLabel: "Abrir",
      },
      {
        title: "Trocas",
        description: "Cancelamentos e devoluções (opcional)",
        hint: "Agora",
        href: "/dashboard/modulos/trocas",
        ctaLabel: "Abrir",
      },
    ],
  },
};

const ACADEMIAS_BASE: DashboardModules = {
  headerNudge: "Alunos, planos e controle mensal da academia.",
  sections: {
    catalogo: [
      {
        title: "Planos",
        description: "Mensalidades e valores",
        hint: "Agora",
        href: "/dashboard/modulos/academia_planos",
        ctaLabel: "Abrir",
      },
      {
        title: "Modalidades",
        description: "Musculação, funcional, etc.",
        hint: "Agora",
        href: "/dashboard/modulos/academia_modalidades",
        ctaLabel: "Abrir",
      },
      {
        title: "Serviços adicionais",
        description: "Avaliação, personal, extras",
        hint: "Agora",
        href: "/dashboard/modulos/academia_servicos",
        ctaLabel: "Abrir",
      },
    ],
    atendimento: [
      {
        title: "QR de cadastro",
        description: "Cliente entra pelo QR e vê instruções de pagamento",
        hint: "Agora",
        href: "/dashboard/modulos/academia_qr",
        ctaLabel: "Abrir",
      },
      {
        title: "Formas de pagamento",
        description: "Pix/link/dinheiro e aviso para o aluno",
        hint: "Agora",
        href: "/dashboard/modulos/vendas",
        ctaLabel: "Configurar",
      },
      {
        title: "Alunos",
        description: "Status, vencimentos e controle",
        hint: "Agora",
        href: "/dashboard/modulos/academia_alunos",
        ctaLabel: "Abrir",
      },
      {
        title: "Renovações",
        description: "Quem está vencendo/vencido",
        hint: "Agora",
        href: "/dashboard/modulos/academia_renovacoes",
        ctaLabel: "Abrir",
      },
      {
        title: "Equipe",
        description: "Cadastre atendentes/gerentes e controle acessos",
        hint: "Agora",
        href: "/dashboard/modulos/administracao",
        ctaLabel: "Abrir",
      },
    ],
    vendas: [
      {
        title: "Histórico & Faturamento",
        description: "Pagamentos registrados e totais",
        hint: "Agora",
        href: "/dashboard/modulos/academia_financeiro",
        ctaLabel: "Abrir",
      },
      {
        title: "Administração & Controle",
        description:
          "Cadastre atendentes/gerentes e controle os acessos por área (o dono pode restringir mesmo o gerente).",
        hint: "Agora",
        href: "/dashboard/modulos/administracao",
        ctaLabel: "Abrir",
      },
    ],
  },
};

const FARMACIA_BASE: DashboardModules = {
  headerNudge: "Catálogo, pedidos e atendimento rápido.",
  sections: {
    catalogo: [
      {
        title: "Produtos",
        description: "Medicamentos, higiene, perfumaria",
        hint: "Próximo",
        href: "/dashboard/modulos/produtos",
        ctaLabel: "Configurar agora",
      },
      {
        title: "Estoque",
        description: "Controle simples (opcional)",
        hint: "Agora",
        href: "/dashboard/modulos/estoque",
        ctaLabel: "Abrir",
      },
      {
        title: "Categorias",
        description: "Organize por linha/necessidade",
        hint: "Agora",
        href: "/dashboard/modulos/categorias",
        ctaLabel: "Abrir",
      },
      {
        title: "Restrições",
        description: "Regras por item (opcional)",
        hint: "Agora",
        href: "/dashboard/modulos/restricoes",
        ctaLabel: "Abrir",
      },
    ],
    atendimento: [
      {
        title: "QR Code",
        description: "Mostre um QR para o cliente escanear",
        hint: "Agora",
        href: "/dashboard/modulos/qr",
        ctaLabel: "Abrir",
      },
      {
        title: "Pedidos",
        description: "Separação, status e retirada",
        hint: "Em breve",
        href: "/dashboard/modulos/pedidos",
        ctaLabel: "Abrir",
      },
      {
        title: "Entrega",
        description: "Endereços e taxa (opcional)",
        hint: "Agora",
        href: "/dashboard/modulos/entrega",
        ctaLabel: "Abrir",
      },
      {
        title: "Suporte & Contato",
        description: "WhatsApp e canais (opcional)",
        hint: "Agora",
        href: "/dashboard/modulos/suporte",
        ctaLabel: "Configurar agora",
      },
    ],
    vendas: [
      {
        title: "Formas de pagamento",
        description: "Escolha Pix/link/dinheiro e o aviso pro cliente",
        hint: "Agora",
        href: "/dashboard/modulos/vendas",
        ctaLabel: "Configurar",
      },
      {
        title: "Cupons & Promoções",
        description: "Crie campanhas e descontos para aumentar vendas e fidelizar clientes.",
        hint: "Em breve",
        href: "/dashboard/modulos/cupons",
        ctaLabel: "Abrir",
      },
      {
        title: "Administração & Controle",
        description:
          "Cadastre atendentes/gerentes e controle os acessos por área (o dono pode restringir mesmo o gerente).",
        hint: "Agora",
        href: "/dashboard/modulos/administracao",
        ctaLabel: "Abrir",
      },
    ],
  },
};

const CLINICA_BASE: DashboardModules = {
  headerNudge: "Serviços, profissionais e fluxo de recepção.",
  sections: {
    catalogo: [
      {
        title: "Serviços",
        description: "Procedimentos, especialidades e valores",
        hint: "Próximo",
        href: "/dashboard/modulos/servicos",
        ctaLabel: "Configurar agora",
      },
      {
        title: "Profissionais",
        description: "Equipe e disponibilidade",
        hint: "Em breve",
        href: "/dashboard/modulos/profissionais",
        ctaLabel: "Abrir",
      },
      {
        title: "Convênios",
        description: "Tabelas e regras (opcional)",
        hint: "Em breve",
        href: "/dashboard/modulos/convenios",
        ctaLabel: "Abrir",
      },
    ],
    atendimento: [
      {
        title: "QR Code",
        description: "Mostre um QR para o cliente escanear",
        hint: "Agora",
        href: "/dashboard/modulos/qr",
        ctaLabel: "Abrir",
      },
      {
        title: "Agenda",
        description: "Horários e marcações",
        hint: "Agora",
        href: "/dashboard/modulos/agenda",
        ctaLabel: "Abrir",
      },
      {
        title: "Recepção",
        description: "Fila de atendimento",
        hint: "Agora",
        href: "/dashboard/modulos/recepcao",
        ctaLabel: "Abrir",
      },
      {
        title: "Prontuário",
        description: "Registro por paciente (opcional)",
        hint: "Em breve",
        href: "/dashboard/modulos/prontuario",
        ctaLabel: "Abrir",
      },
    ],
    vendas: [
      {
        title: "Formas de pagamento",
        description: "Escolha Pix/link/dinheiro e o aviso pro cliente",
        hint: "Agora",
        href: "/dashboard/modulos/vendas",
        ctaLabel: "Configurar",
      },
      {
        title: "Cupons & Promoções",
        description: "Crie campanhas e descontos para aumentar vendas e fidelizar clientes.",
        hint: "Em breve",
        href: "/dashboard/modulos/cupons",
        ctaLabel: "Abrir",
      },
      {
        title: "Administração & Controle",
        description:
          "Cadastre atendentes/gerentes e controle os acessos por área (o dono pode restringir mesmo o gerente).",
        hint: "Agora",
        href: "/dashboard/modulos/administracao",
        ctaLabel: "Abrir",
      },
    ],
  },
};

const HOTEIS_BASE: DashboardModules = {
  headerNudge: "Reservas, ocupação e operação do hotel.",
  sections: {
    catalogo: [
      {
        title: "Quartos",
        description: "Tipos, preços e capacidade",
        hint: "Agora",
        href: "/dashboard/modulos/quartos",
        ctaLabel: "Abrir",
      },
      {
        title: "Planos",
        description: "Diária, café incluso, etc.",
        hint: "Agora",
        href: "/dashboard/modulos/planos",
        ctaLabel: "Abrir",
      },
      {
        title: "Restaurante",
        description: "Pratos, bebidas e categorias (opcional)",
        hint: "Agora",
        href: "/dashboard/modulos/produtos",
        ctaLabel: "Abrir",
      },
      {
        title: "Serviços",
        description: "Room service, lavanderia e extras (opcional)",
        hint: "Agora",
        href: "/dashboard/modulos/hotel_servicos",
        ctaLabel: "Abrir",
      },
    ],
    atendimento: [
      {
        title: "QR Code",
        description: "Mostre um QR para o cliente escanear",
        hint: "Agora",
        href: "/dashboard/modulos/qr",
        ctaLabel: "Abrir",
      },
      {
        title: "Reservas",
        description: "Check-in/out e status",
        hint: "Agora",
        href: "/dashboard/modulos/reservas",
        ctaLabel: "Abrir",
      },
      {
        title: "Hóspedes",
        description: "Cadastros e preferências",
        hint: "Agora",
        href: "/dashboard/modulos/hospedes",
        ctaLabel: "Abrir",
      },
      {
        title: "Housekeeping",
        description: "Limpeza, manutenção e equipe (opcional)",
        hint: "Agora",
        href: "/dashboard/modulos/housekeeping",
        ctaLabel: "Abrir",
      },
      {
        title: "Equipe",
        description: "Cadastre gerente/funcionários e controle acessos",
        hint: "Agora",
        href: "/dashboard/modulos/administracao",
        ctaLabel: "Abrir",
      },
    ],
    vendas: [
      {
        title: "Formas de pagamento",
        description: "Escolha Pix/link/dinheiro e o aviso pro cliente",
        hint: "Agora",
        href: "/dashboard/modulos/vendas",
        ctaLabel: "Configurar",
      },
      {
        title: "Cupons & Promoções",
        description: "Crie campanhas e descontos para aumentar vendas e fidelizar clientes.",
        hint: "Em breve",
        href: "/dashboard/modulos/cupons",
        ctaLabel: "Abrir",
      },
      {
        title: "Administração & Controle",
        description:
          "Cadastre atendentes/gerentes e controle os acessos por área (o dono pode restringir mesmo o gerente).",
        hint: "Agora",
        href: "/dashboard/modulos/administracao",
        ctaLabel: "Abrir",
      },
    ],
  },
};

const LOJA_BASE: DashboardModules = {
  headerNudge: "Catálogo de produtos e vendas.",
  sections: {
    catalogo: [
      {
        title: "Produtos",
        description: "Tamanhos, cores e preços",
        hint: "Agora",
        href: "/dashboard/modulos/produtos",
        ctaLabel: "Abrir",
      },
      {
        title: "Variações",
        description: "Grade e estoque (opcional)",
        hint: "Agora",
        href: "/dashboard/modulos/variacoes",
        ctaLabel: "Abrir",
      },
      {
        title: "Categorias",
        description: "Coleções e vitrine",
        hint: "Agora",
        href: "/dashboard/modulos/produtos",
        ctaLabel: "Abrir",
      },
    ],
    atendimento: [
      {
        title: "QR Code",
        description: "Mostre um QR para o cliente escanear",
        hint: "Agora",
        href: "/dashboard/modulos/qr",
        ctaLabel: "Abrir",
      },
      {
        title: "Pedidos",
        description: "Separação e status",
        hint: "Agora",
        href: "/dashboard/modulos/pedidos",
        ctaLabel: "Abrir",
      },
      {
        title: "Trocas",
        description: "Fluxo de devolução (opcional)",
        hint: "Agora",
        href: "/dashboard/modulos/trocas",
        ctaLabel: "Abrir",
      },
      {
        title: "Entrega",
        description: "Frete e prazos (opcional)",
        hint: "Agora",
        href: "/dashboard/modulos/entrega",
        ctaLabel: "Abrir",
      },
      {
        title: "Equipe",
        description: "Cadastre gerente/funcionários e controle acessos",
        hint: "Agora",
        href: "/dashboard/modulos/administracao",
        ctaLabel: "Abrir",
      },
    ],
    vendas: [
      {
        title: "Formas de pagamento",
        description: "Escolha Pix/link/dinheiro e o aviso pro cliente",
        hint: "Agora",
        href: "/dashboard/modulos/vendas",
        ctaLabel: "Configurar",
      },
      {
        title: "Cupons & Promoções",
        description: "Crie campanhas e descontos para aumentar vendas e fidelizar clientes.",
        hint: "Em breve",
        href: "/dashboard/modulos/cupons",
        ctaLabel: "Abrir",
      },
      {
        title: "Administração & Controle",
        description:
          "Cadastre atendentes/gerentes e controle os acessos por área (o dono pode restringir mesmo o gerente).",
        hint: "Agora",
        href: "/dashboard/modulos/administracao",
        ctaLabel: "Abrir",
      },
    ],
  },
};

export function getDashboardModules(
  categoryKey: BusinessCategoryKey | string | null | undefined,
): DashboardModules {
  let modules: DashboardModules;

  switch (categoryKey) {
    case "acaiteria_sorveteria":
    case "acaiteria":
    case "sorveteria":
      modules = ACAITERIA_SORVETERIA_BASE;
      break;
    case "academias":
      modules = ACADEMIAS_BASE;
      break;
    case "barbearia":
      modules = BARBEARIA_BASE;
      break;
    case "clinica_estetica":
      modules = ESTETICA_BASE;
      break;
    case "salao_de_beleza":
      modules = SALAO_BASE;
      break;
    case "pet_shop":
      modules = PETSHOP_BASE;
      break;
    case "lava_jato":
      modules = LAVAJATO_BASE;
      break;
    case "casa_de_racao":
    case "casa_racao":
      modules = CASA_RACAO_BASE;
      break;
    case "restaurante":
      modules = RESTAURANTE_BASE;
      break;
    case "pizzaria":
      modules = {
        ...RESTAURANTE_BASE,
        headerNudge: "Cardápio, pedidos e produção de pizzaria.",
        sections: {
          ...RESTAURANTE_BASE.sections,
          catalogo: [
            {
              title: "Pizzas",
              description: "Tamanhos, sabores e bordas",
              hint: "Agora",
              href: "/dashboard/modulos/produtos?preset=pizzas",
              ctaLabel: "Cadastrar",
            },
            {
              title: "Combos",
              description: "Promoções e combos",
              hint: "Agora",
              href: "/dashboard/modulos/produtos?preset=combos",
              ctaLabel: "Cadastrar",
            },
            {
              title: "Adicionais",
              description: "Bebidas e extras",
              hint: "Agora",
              href: "/dashboard/modulos/produtos?preset=adicionais",
              ctaLabel: "Cadastrar",
            },
          ],
          atendimento: [
            ...RESTAURANTE_BASE.sections.atendimento,
            {
              title: "Equipe",
              description: "Cadastre atendentes/gerentes e controle acessos",
              hint: "Agora",
              href: "/dashboard/modulos/administracao",
              ctaLabel: "Abrir",
            },
          ],
        },
      };
      break;
    case "bares":
      modules = {
        ...RESTAURANTE_BASE,
        headerNudge: "Bebidas, comandas e pedidos rápidos.",
        sections: {
          ...RESTAURANTE_BASE.sections,
          catalogo: [
            {
              title: "Bebidas",
              description: "Drinks, cervejas e doses",
              hint: "Agora",
              href: "/dashboard/modulos/produtos?preset=bebidas",
              ctaLabel: "Cadastrar",
            },
            {
              title: "Petiscos",
              description: "Cozinha e porções",
              hint: "Agora",
              href: "/dashboard/modulos/produtos?preset=petiscos",
              ctaLabel: "Cadastrar",
            },
            {
              title: "Combos",
              description: "Promoções e combos",
              hint: "Agora",
              href: "/dashboard/modulos/produtos?preset=combos",
              ctaLabel: "Cadastrar",
            },
          ],
          vendas: [
            {
              title: "Formas de pagamento",
              description: "Escolha Pix/link/dinheiro e o aviso pro cliente",
              hint: "Agora",
              href: "/dashboard/modulos/vendas",
              ctaLabel: "Configurar",
            },
            ...RESTAURANTE_BASE.sections.vendas,
          ],
        },
      };
      break;
    case "mercado":
      modules = MERCADO_BASE;
      break;
    case "conveniencia":
      modules = {
        ...MERCADO_BASE,
        headerNudge: "Operação rápida (24h), catálogo e pedidos.",
        sections: {
          ...MERCADO_BASE.sections,
          vendas: [
            {
              title: "Formas de pagamento",
              description: "Escolha Pix/link/dinheiro e o aviso pro cliente",
              hint: "Agora",
              href: "/dashboard/modulos/vendas",
              ctaLabel: "Configurar",
            },
            ...MERCADO_BASE.sections.vendas,
          ],
        },
      };
      break;
    case "farmacia":
      modules = FARMACIA_BASE;
      break;
    case "clinica":
    case "consultorio":
      modules = CLINICA_BASE;
      break;
    case "hoteis":
      modules = HOTEIS_BASE;
      break;
    case "loja_roupas":
    case "loja_calcados":
      modules = LOJA_BASE;
      break;
    default:
      modules = GENERIC;
      break;
  }

  return withStockInCatalog(withProductsInCatalog(modules));
}
