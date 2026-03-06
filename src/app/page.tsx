import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function HomePage() {
  const supabase = await createClient();
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

        {/* Headline */}
        <h1 className="mt-8 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          Pare de perder dinheiro por desorganização.
        </h1>

        {/* Subheadline */}
        <p className="mt-6 text-lg text-zinc-600 dark:text-zinc-300">
          Organize atendimento, pedidos e operação em um único painel simples e intuitivo.
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

        {/* Benefits */}
        <div className="mt-10 space-y-3 text-base text-zinc-700 dark:text-zinc-300">
          <p>✔ Mais controle do seu negócio</p>
          <p>✔ Menos erros no atendimento</p>
          <p>✔ Processo simples e rápido</p>
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
          <a
            href="#video-apresentacao"
            className="text-sm font-semibold text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-200"
          >
            Saiba mais (assista ao vídeo)
          </a>
        </div>

        {/* Risk Reversal */}
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          30 dias gratuitos. Sem cartão. Sem contrato. Sem risco.
        </p>

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
        </div>
      </footer>
    </div>
  );
}
