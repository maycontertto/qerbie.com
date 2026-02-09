import Link from "next/link";

const LAST_UPDATED = "09/02/2026";

export default function TermosDeUsoPage() {
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
          Termos de Uso — Qerbie
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Última atualização: {LAST_UPDATED}
        </p>

        <section className="prose prose-zinc mt-8 max-w-none dark:prose-invert">
          <p>
            Ao utilizar a plataforma Qerbie, você concorda com os termos abaixo. Caso não
            concorde, recomendamos não utilizar o serviço.
          </p>

          <h2>1. Sobre o Qerbie</h2>
          <p>
            O Qerbie é uma plataforma digital que oferece ferramentas de atendimento, pedidos,
            catálogo e gestão operacional para estabelecimentos comerciais.
          </p>
          <p>O Qerbie não é um sistema fiscal, contábil ou financeiro.</p>

          <h2>2. Responsabilidade do Estabelecimento</h2>
          <p>O estabelecimento é o único responsável por:</p>
          <ul>
            <li>Informações exibidas (preços, produtos, descrições, imagens)</li>
            <li>Atendimento ao cliente</li>
            <li>Entrega, retirada ou consumo no local</li>
            <li>Emissão de notas fiscais</li>
            <li>Cumprimento de obrigações fiscais, tributárias e legais</li>
            <li>Cumprimento de regras sanitárias, comerciais e regulatórias</li>
          </ul>
          <p>O Qerbie não interfere na operação comercial do estabelecimento.</p>

          <h2>3. Pagamentos</h2>
          <p>
            O Qerbie não intermedia pagamentos, salvo quando explicitamente informado.
          </p>
          <p>
            Os pagamentos realizados pelos clientes são feitos diretamente ao estabelecimento,
            por meios definidos por ele.
          </p>
          <p>
            O Qerbie apenas registra informações operacionais relacionadas ao pedido.
          </p>

          <h2>4. Impostos e Tributos</h2>
          <p>O Qerbie não calcula, recolhe ou separa impostos.</p>
          <p>
            Qualquer obrigação tributária é de responsabilidade exclusiva do estabelecimento.
          </p>
          <p>Os valores exibidos na plataforma são informativos e brutos.</p>

          <h2>5. Uso por Clientes Finais</h2>
          <p>Clientes que acessam o sistema via QR Code:</p>
          <ul>
            <li>Não criam vínculo contratual com o Qerbie</li>
            <li>
              Utilizam a plataforma apenas como meio de acesso às informações do
              estabelecimento
            </li>
            <li>
              Devem tratar diretamente com o estabelecimento qualquer questão relacionada a
              pedidos, produtos ou atendimento
            </li>
          </ul>

          <h2>6. Limitação de Responsabilidade</h2>
          <p>O Qerbie não se responsabiliza por:</p>
          <ul>
            <li>Erros de informação fornecidos pelo estabelecimento</li>
            <li>Cancelamentos, atrasos ou falhas no atendimento</li>
            <li>Problemas na entrega ou retirada</li>
            <li>
              Qualidade, validade ou legalidade dos produtos ou serviços oferecidos
            </li>
          </ul>

          <h2>7. Disponibilidade do Serviço</h2>
          <p>
            O Qerbie busca manter a plataforma estável e disponível, mas não garante
            funcionamento ininterrupto ou livre de falhas.
          </p>
          <p>
            Manutenções, atualizações ou indisponibilidades temporárias podem ocorrer.
          </p>

          <h2>8. Privacidade e Dados</h2>
          <p>
            O Qerbie respeita a privacidade dos usuários e utiliza dados apenas para fins
            operacionais da plataforma, conforme a legislação aplicável.
          </p>
          <p>
            Nenhum dado é vendido ou compartilhado para fins comerciais externos.
          </p>

          <h2>9. Alterações nos Termos</h2>
          <p>
            Os termos podem ser atualizados a qualquer momento. Recomendamos a revisão
            periódica.
          </p>

          <h2>10. Contato</h2>
          <p>
            Para dúvidas ou informações: <a href="mailto:suporte@qerbie.com">suporte@qerbie.com</a>
          </p>
        </section>
      </main>
    </div>
  );
}
