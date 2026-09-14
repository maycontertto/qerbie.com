import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/lib/auth/actions";

export type DashboardSection = "catalogo" | "atendimento" | "vendas" | "historico";

function SidebarLink({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </Link>
  );
}

// Shell compartilhado (header + sidebar) usado na home do dashboard e em todas
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
    <div className="relative min-h-screen overflow-hidden bg-linear-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-zinc-200/50 blur-3xl dark:bg-zinc-800/40"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -right-16 h-96 w-96 rounded-full bg-zinc-200/40 blur-3xl dark:bg-zinc-800/30"
      />

      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="mx-auto flex max-w-480 items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <Image
                src="/qrbie.png"
                alt="Qerbie"
                width={34}
                height={34}
                priority
                className="h-8 w-8 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900"
              />
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Qerbie</h1>
            </div>

            <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-200">
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
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="relative mx-auto flex w-full max-w-480 gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <aside className="hidden w-64 shrink-0 lg:block">
          <nav className="sticky top-24 rounded-2xl border border-zinc-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
            <p className="px-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              {selectedLabel}
            </p>

            <div className="mt-2 flex flex-col gap-1">
              <SidebarLink
                active={activeSection === "catalogo"}
                href={`/dashboard?category=${encodeURIComponent(selectedKey ?? "")}&section=catalogo`}
                icon="📦"
                label="Catálogo"
              />
              <SidebarLink
                active={activeSection === "atendimento"}
                href={`/dashboard?category=${encodeURIComponent(selectedKey ?? "")}&section=atendimento`}
                icon="🧑‍🤝‍🧑"
                label="Atendimento"
              />
              <SidebarLink
                active={activeSection === "vendas"}
                href={`/dashboard?category=${encodeURIComponent(selectedKey ?? "")}&section=vendas`}
                icon="💰"
                label="Vendas"
              />
              <SidebarLink
                active={activeSection === "historico"}
                href={`/dashboard?category=${encodeURIComponent(selectedKey ?? "")}&section=historico`}
                icon="📊"
                label="Histórico de Vendas"
              />
            </div>

            <hr className="my-4 border-zinc-200 dark:border-zinc-800" />

            <div className="flex flex-col gap-1">
              <Link
                href="/dashboard/pagamento"
                className="rounded-lg px-2.5 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Assinatura / Pagamento
              </Link>
              {isOwner ? (
                <a
                  href="/dashboard/segmento?choose=1"
                  className="rounded-lg px-2.5 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Trocar tipo de negócio
                </a>
              ) : null}
              {isOwner || canBranding ? (
                <a
                  href="/dashboard/branding"
                  className="rounded-lg px-2.5 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Personalizar marca (QR)
                </a>
              ) : null}
            </div>
          </nav>
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
