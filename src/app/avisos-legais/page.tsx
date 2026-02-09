import Link from "next/link";

const LAST_UPDATED = "09/02/2026";

export default function AvisosLegaisPage() {
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
          Avisos Legais — Qerbie
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Última atualização: {LAST_UPDATED}
        </p>

        <section className="prose prose-zinc mt-8 max-w-none dark:prose-invert">
          <h2>1. Natureza da plataforma</h2>
          <p>
            O Qerbie fornece recursos de operação (catálogo, atendimento via QR, pedidos, filas
            e painéis). Não é um sistema fiscal, contábil ou financeiro.
          </p>

          <h2>2. Conteúdo e operação do estabelecimento</h2>
          <p>
            O estabelecimento é o responsável por preços, itens, descrições, atendimento,
            entrega/retirada/consumo no local e cumprimento de normas e obrigações legais.
          </p>

          <h2>3. Pagamentos</h2>
          <p>
            Salvo indicação expressa, o Qerbie não processa pagamentos. Qualquer pagamento é
            feito diretamente ao estabelecimento, pelos meios definidos por ele.
          </p>

          <h2>4. Limitação de responsabilidade</h2>
          <p>
            O Qerbie não se responsabiliza por atrasos, cancelamentos, falhas de atendimento,
            qualidade/validade/legalidade de produtos/serviços, ou informações fornecidas pelo
            estabelecimento.
          </p>

          <h2>5. Contato</h2>
          <p>
            Dúvidas: <a href="mailto:suporte@qerbie.com">suporte@qerbie.com</a>
          </p>
        </section>
      </main>
    </div>
  );
}
