import Link from "next/link";

const LAST_UPDATED = "09/02/2026";

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-3xl">
        <Link
          href="/"
          className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
        >
          ← Voltar
        </Link>

        <h1 className="mt-4 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Privacidade — Qerbie
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Última atualização: {LAST_UPDATED}
        </p>

        <section className="prose prose-zinc mt-8 max-w-none dark:prose-invert">
          <p>
            Esta página descreve, de forma objetiva, como o Qerbie trata dados para operar a
            plataforma.
          </p>

          <h2>1. Finalidade</h2>
          <p>
            Usamos dados apenas para fins operacionais: autenticação, atendimento via QR,
            registro de pedidos/filas e gestão do estabelecimento.
          </p>

          <h2>2. Compartilhamento</h2>
          <p>
            Não vendemos dados e não compartilhamos informações para fins comerciais externos.
          </p>

          <h2>3. Dados de clientes finais (QR Code)</h2>
          <p>
            Clientes que acessam via QR usam o Qerbie como interface do estabelecimento. Em
            geral, solicitações e dúvidas sobre pedidos/atendimento devem ser tratadas
            diretamente com o estabelecimento.
          </p>

          <h2>4. Segurança</h2>
          <p>
            Aplicamos medidas técnicas e organizacionais compatíveis com o uso do serviço para
            proteger os dados.
          </p>

          <h2>5. Contato</h2>
          <p>
            Para dúvidas: <a href="mailto:suporte@qerbie.com">suporte@qerbie.com</a>
          </p>
        </section>
      </main>
    </div>
  );
}
