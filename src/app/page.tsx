import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-zinc-50 to-white px-4 dark:from-zinc-950 dark:to-zinc-900">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl dark:bg-accent/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 right-[-4rem] h-80 w-80 rounded-full bg-brand/10 blur-3xl dark:bg-brand/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20 dark:opacity-15"
        style={{ backgroundImage: 'url("/qerbie fundo.png")' }}
      />

      <div className="relative z-10 mx-auto w-full max-w-5xl py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">

          <div className="mx-auto flex items-center justify-center text-4xl font-extrabold tracking-tight text-brand sm:text-5xl">
            Qerbie
          </div>

          <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-3 py-1 text-xs font-semibold text-zinc-700 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-200">
            <span className="inline-block h-2 w-2 rounded-full bg-accent" />
            Teste grátis por 30 dias
          </div>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            Modernize seu atendimento com QR Code.
            <span className="block text-zinc-600 dark:text-zinc-300">
              Cardápio digital, pedidos em tempo real e organização completa — no celular ou no computador.
            </span>
          </h1>

          <p className="mt-6 text-lg text-zinc-600 dark:text-zinc-400">
            A Qerbie é a forma mais simples de organizar seu restaurante.
            Crie seu cardápio digital, gere QR Code para mesas ou atendimento rápido e comece
            a receber pedidos instantaneamente.
            Use pelo celular ou pelo computador — você escolhe como trabalhar.
          </p>

          <p className="mt-3 text-sm font-semibold text-accent">
            Ideal para restaurantes, lanchonetes, pizzarias, cafeterias e comércios locais.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/auth/sign-up"
              className="rounded-lg px-6 py-3 text-sm font-semibold text-white shadow-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
              style={{ backgroundColor: "#22C55E" }}
            >
              Começar agora — teste grátis por 30 dias
            </Link>

            <Link
              href="/auth/sign-in"
              className="rounded-lg border border-zinc-300 bg-white px-6 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Já tenho conta
            </Link>
          </div>

          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
            Sem instalação. Configure em minutos e comece a atender.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2">

          <div className="rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Tudo que você precisa para organizar seu atendimento
            </p>
            <ul className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
              <li>✔ Monte seu cardápio digital em minutos</li>
              <li>✔ Adicione variações, tamanhos e opcionais facilmente</li>
              <li>✔ Gere QR Code para mesas ou atendimento rápido</li>
              <li>✔ Receba pedidos instantaneamente na cozinha</li>
              <li>✔ Organize retirada, entrega e fluxo operacional</li>
              <li>✔ Use no celular ou no computador, sem complicação</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Por que seus clientes gostam
            </p>
            <ul className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
              <li>✔ Acessa o cardápio pelo QR sem baixar aplicativo</li>
              <li>✔ Faz pedidos rápidos direto do celular</li>
              <li>✔ Acompanha o pedido e reduz confusão no atendimento</li>
              <li>✔ Experiência moderna que valoriza seu estabelecimento</li>
            </ul>
          </div>

        </div>
      </div>

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
          <span className="hidden text-zinc-500 dark:text-zinc-400 sm:inline">
            © {new Date().getFullYear()} Qerbie
          </span>
          <span className="mx-2 hidden text-zinc-300 dark:text-zinc-700 sm:inline">·</span>
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
        </div>
      </footer>
    </div>
  );
}
