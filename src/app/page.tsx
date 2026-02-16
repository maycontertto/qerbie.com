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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-zinc-50 to-white px-4 dark:from-zinc-950 dark:to-zinc-900">
      {/* Background Effects */}
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

      <div className="relative z-10 mx-auto w-full max-w-3xl py-16 sm:py-20 text-center">

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
