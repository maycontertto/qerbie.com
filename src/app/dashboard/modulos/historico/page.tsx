import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HistoricoModulePage({
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
          >
            ← Voltar ao painel
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Histórico
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Em breve: histórico do seu negócio (resumo diário/semanal/mensal).
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          A parte de atendentes e controle de acessos foi movida para{" "}
          <Link href="/dashboard/modulos/administracao" className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
            Administração &amp; Controle
          </Link>
          .
        </div>
      </main>
    </div>
  );
}
