import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  CreditCard,
  Package,
  Paintbrush,
  RefreshCw,
  ShoppingCart,
  UsersRound,
} from "lucide-react";
import { signOut } from "@/lib/auth/actions";

export type DashboardSection = "catalogo" | "atendimento" | "vendas" | "historico";

// Shell compartilhado (cabeçalho + navegação superior) usado na home e em todas
// as páginas de módulo/pagamento/branding, mantendo a navegação sempre visível.
export function DashboardShell({
  merchantName,
  userEmail,
  selectedLabel,
  selectedKey,
  isOwner,
  canBranding,
  activeSection,
  children,
}: {
  merchantName: string;
  userEmail: string;
  selectedLabel: string | null;
  selectedKey: string | null;
  isOwner: boolean;
  canBranding: boolean;
  activeSection?: DashboardSection;
  children: ReactNode;
}) {
  return (
    <div className="qerbie-dashboard relative min-h-screen overflow-hidden bg-linear-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-emerald-200/35 blur-3xl dark:bg-emerald-900/20"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -right-16 h-96 w-96 rounded-full bg-zinc-200/40 blur-3xl dark:bg-zinc-800/30"
      />

      <header className="qerbie-dashboard__header sticky top-0 z-50 border-b border-zinc-200 bg-white/85 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mx-auto flex max-w-480 items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <Image
                src="/qrbie.png"
                alt="Qerbie"
                width={34}
                height={34}
                priority
                className="h-9 w-9 rounded-xl border border-emerald-100 bg-emerald-50 p-1.5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950"
              />
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Qerbie</h1>
            </div>

            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3.5 py-1.5 text-sm font-semibold text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/60 dark:text-emerald-100">
              {merchantName}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://wa.me/558496416053"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
            >
              <span className="sm:hidden">Suporte</span>
              <span className="hidden sm:inline">Suporte (WhatsApp)</span>
            </a>
            <span className="hidden text-sm text-zinc-500 dark:text-zinc-400 sm:inline">{userEmail}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-100"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="relative mx-auto w-full max-w-480 px-4 pb-10 pt-5 sm:px-6 sm:pt-6 lg:px-8">
        <nav aria-label="Navegação principal" className="qerbie-dashboard__nav rounded-3xl border border-zinc-200 bg-white/90 p-3 shadow-sm backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/80 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1 sm:px-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">Seu espaço</p>
              <p className="mt-0.5 text-sm font-semibold text-zinc-700 dark:text-zinc-200">{selectedLabel}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/dashboard/pagamento" className="qerbie-dashboard__quick-link">
                <CreditCard aria-hidden="true" />
                <span>Assinatura / Pagamento</span>
              </Link>
              {isOwner ? (
                <Link href="/dashboard/segmento?choose=1" className="qerbie-dashboard__quick-link">
                  <RefreshCw aria-hidden="true" />
                  <span>Trocar tipo</span>
                </Link>
              ) : null}
              {isOwner || canBranding ? (
                <Link href="/dashboard/branding" className="qerbie-dashboard__quick-link">
                  <Paintbrush aria-hidden="true" />
                  <span>Personalizar marca</span>
                </Link>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            {([
              { key: "catalogo", label: "Catálogo", description: "Produtos e serviços", Icon: Package },
              { key: "atendimento", label: "Atendimento", description: "Pedidos e agenda", Icon: UsersRound },
              { key: "vendas", label: "Vendas", description: "Caixa e recebimentos", Icon: ShoppingCart },
              { key: "historico", label: "Histórico de Vendas", description: "Resumo e resultados", Icon: BarChart3 },
            ] as const).map(({ key, label, description, Icon }) => {
              const active = activeSection === key;
              return (
                <Link
                  key={key}
                  href={`/dashboard?category=${encodeURIComponent(selectedKey ?? "")}&section=${key}`}
                  aria-current={active ? "page" : undefined}
                  className={`qerbie-dashboard__section-link ${active ? "is-active" : ""}`}
                >
                  <span className="qerbie-dashboard__section-icon"><Icon aria-hidden="true" /></span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold sm:text-base">{label}</span>
                    <span className="mt-0.5 hidden text-xs text-zinc-500 dark:text-zinc-400 sm:block">{description}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        <main className="dashboard-content min-w-0 pt-5 sm:pt-7">{children}</main>
      </div>
    </div>
  );
}
