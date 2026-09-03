import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

function FeatureIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

interface FeatureCardModel {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const FEATURE_CARDS: FeatureCardModel[] = [
  {
    title: "QR Code inteligente",
    description: "Cardápio, mesas, fila ou agenda — o QR se adapta ao tipo do seu negócio.",
    icon: (
      <FeatureIcon>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="3" height="3" rx="0.5" />
        <rect x="18" y="18" width="3" height="3" rx="0.5" />
      </FeatureIcon>
    ),
  },
  {
    title: "Pedidos & Caixa em tempo real",
    description: "Status ao vivo dos pedidos e um PDV com leitor de código de barras.",
    icon: (
      <FeatureIcon>
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </FeatureIcon>
    ),
  },
  {
    title: "Estoque & Compras",
    description: "Entrada de nota, reposição em lote e controle simples de disponibilidade.",
    icon: (
      <FeatureIcon>
        <path d="M3 7l9-4 9 4-9 4-9-4Z" />
        <path d="M3 7v10l9 4 9-4V7M12 11v10" />
      </FeatureIcon>
    ),
  },
  {
    title: "Agenda & Fila",
    description: "Horários, confirmações e fila de espera para barbearia, salão, clínica, pet e lava-jato.",
    icon: (
      <FeatureIcon>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </FeatureIcon>
    ),
  },
  {
    title: "Pagamentos flexíveis",
    description: "Pix, cartão ou dinheiro, com aviso automático combinando com o cliente.",
    icon: (
      <FeatureIcon>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </FeatureIcon>
    ),
  },
  {
    title: "Equipe & Permissões",
    description: "Cadastre atendentes e gerentes e controle o que cada um pode acessar.",
    icon: (
      <FeatureIcon>
        <circle cx="9" cy="8" r="3" />
        <path d="M2.5 20c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6" />
        <circle cx="17.5" cy="9" r="2.3" />
        <path d="M15.8 20c0-2.4.6-4.1 2.2-5.3" />
      </FeatureIcon>
    ),
  },
  {
    title: "Assistente de IA para você",
    description: "Pergunte sobre vendas, estoque e agenda por chat, sem precisar abrir relatórios.",
    icon: (
      <FeatureIcon>
        <path d="M12 3v3M12 18v3M4.5 12h3M16.5 12h3M6.5 6.5l2.1 2.1M15.4 15.4l2.1 2.1M6.5 17.5l2.1-2.1M15.4 8.6l2.1-2.1" />
        <circle cx="12" cy="12" r="2.2" />
      </FeatureIcon>
    ),
  },
  {
    title: "Assistente de IA pro cliente",
    description: "Tira dúvidas do cardápio ou dos serviços sozinho, a qualquer hora do dia.",
    icon: (
      <FeatureIcon>
        <path d="M21 12c0 4.418-4.03 8-9 8-1.06 0-2.077-.163-3.02-.463L3 21l1.36-4.083C3.5 15.61 3 13.87 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" />
      </FeatureIcon>
    ),
  },
];

interface SegmentCardModel {
  emoji: string;
  title: string;
  description: string;
}

const SEGMENT_CARDS: SegmentCardModel[] = [
  {
    emoji: "🍽️",
    title: "Restaurantes, pizzarias, bares & açaiterias",
    description: "Cardápio digital por QR Code, mesas, pedidos em tempo real, retirada e entrega.",
  },
  {
    emoji: "🛒",
    title: "Mercados, farmácias, conveniências & lojas",
    description: "Catálogo de produtos, estoque, compras e caixa com leitor de código de barras.",
  },
  {
    emoji: "💇",
    title: "Barbearias, salões & clínicas de estética",
    description: "Agenda de horários, fila de espera e ficha de serviços por profissional.",
  },
  {
    emoji: "🐾",
    title: "Pet shops & lava-jatos",
    description: "Fila, agenda e catálogo de serviços sob medida pro seu tipo de atendimento.",
  },
  {
    emoji: "🏨",
    title: "Hotéis",
    description: "Reservas, ocupação e operação do dia a dia em um único painel.",
  },
  {
    emoji: "🏋️",
    title: "Academias & consultórios",
    description: "Alunos ou pacientes, planos e controle mensal sem planilha.",
  },
];

export default async function HomePage() {
  const supabase = await createClient({}, { withAuth: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: owned } = await supabase
      .from("merchants")
      .select("id")
      .eq("owner_user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (owned) {
      redirect("/dashboard");
    }

    const { data: membership } = await supabase
      .from("merchant_members")
      .select("merchant_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membership) {
      redirect("/atendente");
    }

    redirect("/dashboard");
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-start overflow-hidden bg-linear-to-b from-zinc-50 to-white px-4 dark:from-zinc-950 dark:to-zinc-900">
      {/* Background Effects */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl dark:bg-accent/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-brand/10 blur-3xl dark:bg-brand/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20 dark:opacity-15"
        style={{ backgroundImage: 'url("/qerbie fundo.png")' }}
      />

      <div className="relative z-10 mx-auto w-full max-w-4xl py-16 sm:py-20 text-center">

        {/* Logo */}
        <div className="text-4xl font-extrabold tracking-tight text-brand sm:text-5xl">
          Qerbie
        </div>

        {/* Badge */}
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-4 py-1 text-xs font-semibold text-zinc-700 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-200">
          ✔ Teste grátis por 30 dias
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {[
            "Restaurante",
            "Mercado",
            "Farmácia",
            "Salão de Beleza",
            "Barbearia",
            "Clínica de Estética",
            "Pet Shop",
            "Lava-Jato",
            "Hotel",
            "e mais",
          ].map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-zinc-200 bg-white/70 px-3 py-1 dark:border-zinc-800 dark:bg-zinc-900/60"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Headline */}
        <h1 className="mt-8 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          Vendas, atendimento, agenda e estoque do seu negócio em um só lugar.
        </h1>

        {/* Subheadline */}
        <p className="mt-6 text-lg text-zinc-600 dark:text-zinc-300">
          Cardápio ou catálogo digital via QR Code, pedidos em tempo real, fila, agenda e um assistente de IA que ajuda você a gerenciar e atende seus clientes sozinho — tudo pensado pro seu tipo de negócio.
        </p>

        <p className="mt-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Feito para restaurantes, mercados, farmácias, salões, clínicas, barbearias, pet shops, lava-jatos, hotéis, academias e muito mais.
        </p>

        {/* Video */}
        <div
          id="video-apresentacao"
          className="mt-10 rounded-2xl border border-zinc-200 bg-white/70 p-3 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/50"
        >
          <div className="aspect-video overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <video
              className="h-full w-full"
              controls
              preload="metadata"
              playsInline
              aria-label="Vídeo de apresentação do Qerbie"
            >
              <source
                src="/pagina%20inicial/qerbie%20finalizado%20app.mp4"
                type="video/mp4"
              />
              Seu navegador não suporta vídeo HTML5.
            </video>
          </div>

          <div className="mt-4">
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              Assista e entenda em poucos segundos
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Uma visão rápida de como o Qerbie ajuda seu comércio a reduzir erros,
              ganhar agilidade e ter mais controle no atendimento e nos pedidos.
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="mt-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            Tudo incluído
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            O que você recebe ao criar sua conta
          </h2>
        </div>
        <div className="mt-8 grid gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
          {FEATURE_CARDS.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-zinc-200 bg-white/75 p-4 text-sm text-zinc-700 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand dark:bg-brand/15">
                {feature.icon}
              </div>
              <p className="mt-3 font-semibold text-zinc-900 dark:text-zinc-50">{feature.title}</p>
              <p className="mt-1">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/auth/sign-up"
            className="cta-primary rounded-xl bg-brand px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-brandHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
          >
            Criar conta grátis agora
          </Link>

          <Link
            href="/auth/sign-in"
            className="rounded-xl border border-zinc-300 bg-white px-8 py-4 text-lg font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Já tenho conta
          </Link>
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
            <a
              href="#video-apresentacao"
              className="font-semibold text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-200"
            >
              Saiba mais (assista ao vídeo)
            </a>
            <Link
              href="/aulas"
              className="font-semibold text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-200"
            >
              Ver aulas de uso
            </Link>
          </div>
        </div>

        {/* Risk Reversal */}
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          30 dias gratuitos. Sem cartão. Sem contrato. Sem risco.
        </p>

        {/* Segments */}
        <div className="mt-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            Feito sob medida
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            Um Qerbie para cada tipo de negócio
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
            Ao criar sua conta você escolhe o segmento, e o painel já vem com os módulos certos para o seu dia a dia.
          </p>
        </div>
        <div className="mt-8 grid gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
          {SEGMENT_CARDS.map((segment) => (
            <div
              key={segment.title}
              className="rounded-2xl border border-zinc-200 bg-white/75 p-4 text-sm text-zinc-700 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300"
            >
              <span className="text-2xl" aria-hidden>
                {segment.emoji}
              </span>
              <p className="mt-3 font-semibold text-zinc-900 dark:text-zinc-50">{segment.title}</p>
              <p className="mt-1">{segment.description}</p>
            </div>
          ))}
        </div>

        <section className="mt-14 rounded-3xl border border-zinc-200 bg-white/75 p-6 text-left shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                Como funciona
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Crie sua conta e comece a operar em poucos passos.
              </h2>
            </div>
            <Link
              href="/auth/sign-up"
              className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brandHover"
            >
              Começar agora
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950/60">
              <p className="text-sm font-semibold text-brand">1. Crie sua conta</p>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                Entre grátis e escolha o tipo de negócio para começar com a estrutura certa.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950/60">
              <p className="text-sm font-semibold text-brand">2. Cadastre ou importe</p>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                Use cadastro rápido, planilha, nota fiscal ou leitor para colocar a operação dentro da plataforma.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950/60">
              <p className="text-sm font-semibold text-brand">3. Use no dia a dia</p>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                Acompanhe vendas, estoque, compras e tarefas com mais clareza e menos erro.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-zinc-200 bg-white/75 p-6 text-left shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            Por que criar conta agora
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/40">
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                Você já encontra o vídeo comercial e vai ter aulas práticas para aprender a usar.
              </p>
              <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">
                Isso reduz o medo de começar e acelera a implantação no seu negócio.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950/60">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Comece sem compromisso e veja se faz sentido para a sua rotina.
              </p>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                Teste grátis por 30 dias, sem cartão, com acesso imediato e suporte por WhatsApp.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Se o seu objetivo é organizar a empresa e ganhar agilidade, a melhor forma de avaliar é criando sua conta agora.
            </p>
            <Link
              href="/auth/sign-up"
              className="rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brandHover"
            >
              Criar conta grátis
            </Link>
          </div>
        </section>

      </div>

      {/* Minimal Footer */}
      <footer className="absolute bottom-4 left-4 text-xs text-zinc-500 dark:text-zinc-400">
        © {new Date().getFullYear()} Qerbie
      </footer>

      <footer className="fixed bottom-3 right-3 z-40">
        <div className="rounded-lg border border-zinc-200 bg-white/90 px-3 py-2 text-xs text-zinc-600 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-300">
          <a
            href="https://wa.me/558496416053"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
          >
            Suporte (WhatsApp)
          </a>
          <span className="mx-2 text-zinc-300 dark:text-zinc-700">·</span>
          <Link href="/termos" className="font-medium hover:underline">
            Termos
          </Link>
          <span className="mx-2 text-zinc-300 dark:text-zinc-700">·</span>
          <Link href="/privacidade" className="font-medium hover:underline">
            Privacidade
          </Link>
          <span className="mx-2 text-zinc-300 dark:text-zinc-700">·</span>
          <Link href="/avisos-legais" className="font-medium hover:underline">
            Avisos
          </Link>
          <span className="mx-2 text-zinc-300 dark:text-zinc-700">·</span>
          <Link href="/aulas" className="font-medium hover:underline">
            Aulas
          </Link>
        </div>
      </footer>
    </div>
  );
}
