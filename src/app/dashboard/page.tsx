import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { signOut } from "@/lib/auth/actions";
import { BUSINESS_CATEGORIES } from "@/lib/merchant/businessCategories";
import { setBusinessCategory } from "@/lib/merchant/actions";
import { getBusinessCategoryLabel } from "@/lib/merchant/helpers";
import { getDashboardModules } from "@/lib/merchant/dashboardModules";
import { HistoryRangePicker } from "./HistoryRangePicker";
import Image from "next/image";
import Link from "next/link";

type DashboardSection = "catalogo" | "atendimento" | "vendas" | "historico";
type HistoryRange = "diario" | "semanal" | "mensal";

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function getHistoryRangeWindow(range: HistoryRange): { fromIso: string; toIso: string } {
  const now = new Date();
  const to = now;

  if (range === "diario") {
    const from = startOfDayUtc(now);
    return { fromIso: from.toISOString(), toIso: to.toISOString() };
  }

  const days = range === "semanal" ? 7 : 30;
  const from = startOfDayUtc(new Date(now.getTime() - days * 24 * 60 * 60 * 1000));
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    saved?: string;
    category?: string;
    choose?: string;
    section?: DashboardSection;
    range?: HistoryRange;
  }>;
}) {
  const { supabase, user, merchant, membership } = await getDashboardUserOrRedirect();
  const { error, saved, category, choose, section, range } = await searchParams;

  const isOwner = user.id === merchant.owner_user_id;

  const can = (perm: string) =>
    isOwner || (membership ? hasMemberPermission(membership.role, membership.permissions, perm) : false);

  const selectedKey = merchant.business_category ?? category ?? null;
  const selectedLabel = getBusinessCategoryLabel(selectedKey);
  const hasCategory = Boolean(selectedLabel);
  const wantsChoose = choose === "1" || choose === "true";
  const showChooser = wantsChoose || !hasCategory;
  const activeSection: DashboardSection = hasCategory
    ? section ?? "catalogo"
    : "catalogo";
  const historyRange: HistoryRange = range ?? "diario";
  const hasExplicitHistoryRange = Boolean(range);

  const modules = getDashboardModules(selectedKey);

  const canSales = isOwner || can("dashboard_sales");

  const history =
    activeSection === "historico" && canSales
      ? await (async () => {
          const { fromIso, toIso } = getHistoryRangeWindow(historyRange);

          const [{ data: orders }, { data: items }, { data: members }] = await Promise.all([
            supabase
              .from("orders")
              .select("id,total,completed_by_user_id")
              .eq("merchant_id", merchant.id)
              .eq("status", "completed")
              .gte("completed_at", fromIso)
              .lt("completed_at", toIso),
            (supabase
              .from("order_items")
              .select("product_name,quantity,orders!inner(completed_at,status)")
              .eq("merchant_id", merchant.id)
              .eq("orders.status", "completed")
              .gte("orders.completed_at", fromIso)
              .lt("orders.completed_at", toIso) as unknown) as Promise<{
              data: Array<{ product_name: string; quantity: number }> | null;
            }>,
            supabase
              .from("merchant_members")
              .select("user_id, display_name, login, role")
              .eq("merchant_id", merchant.id),
          ]);

          const safeOrders = orders ?? [];
          const totalOrders = safeOrders.length;
          const revenue = safeOrders.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
          const avgTicket = totalOrders > 0 ? revenue / totalOrders : 0;

          const memberLabelByUserId = new Map<string, string>();
          for (const m of members ?? []) {
            const label = m.display_name?.trim() || m.login?.trim() || (m.role === "admin" ? "Gerente" : "Atendente");
            memberLabelByUserId.set(m.user_id, label);
          }

          const salesByUserId = new Map<string, { orders: number; total: number }>();
          for (const o of safeOrders) {
            const uid = (o.completed_by_user_id ?? "").trim();
            const prev = salesByUserId.get(uid) ?? { orders: 0, total: 0 };
            salesByUserId.set(uid, {
              orders: prev.orders + 1,
              total: prev.total + Number(o.total ?? 0),
            });
          }

          const salesByAttendant = Array.from(salesByUserId.entries())
            .map(([uid, agg]) => {
              const label =
                uid === merchant.owner_user_id
                  ? "Proprietário"
                  : uid
                    ? (memberLabelByUserId.get(uid) ?? "Atendente")
                    : "Não atribuído";

              return { userId: uid, label, orders: agg.orders, total: agg.total };
            })
            .sort((a, b) => b.total - a.total);

          const qtyByProduct = new Map<string, number>();
          for (const row of items ?? []) {
            const name = String(row.product_name ?? "").trim();
            if (!name) continue;
            const qty = Number(row.quantity ?? 0);
            qtyByProduct.set(name, (qtyByProduct.get(name) ?? 0) + qty);
          }

          const topProducts = Array.from(qtyByProduct.entries())
            .map(([name, quantity]) => ({ name, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);

          return {
            totalOrders,
            revenue,
            avgTicket,
            topProducts,
            salesByAttendant,
          };
        })()
      : null;

  const filterCards = <T extends { href?: string }>(cards: T[]) => {
    return cards.filter((c) => {
      if (isOwner) return true;
      if (!c.href) return true;
      if (c.href.startsWith("/dashboard/modulos/produtos")) return can("dashboard_products");
      if (c.href.startsWith("/dashboard/modulos/servicos")) return can("dashboard_products");
      if (c.href.startsWith("/dashboard/modulos/variacoes")) return can("dashboard_products");
      if (c.href.startsWith("/dashboard/modulos/mesas"))
        return can("dashboard_orders") || can("dashboard_products");
      if (c.href.startsWith("/dashboard/modulos/quartos")) return can("dashboard_products");
      if (c.href.startsWith("/dashboard/modulos/planos")) return can("dashboard_products");
      if (c.href.startsWith("/dashboard/modulos/hotel_servicos")) return can("dashboard_products");
      if (c.href.startsWith("/dashboard/modulos/estoque")) return can("dashboard_products");
      if (c.href.startsWith("/dashboard/modulos/pedidos")) return can("dashboard_orders");
      if (c.href.startsWith("/dashboard/modulos/trocas")) return can("dashboard_orders");
      if (c.href.startsWith("/dashboard/modulos/retirada")) return can("dashboard_orders");
      if (c.href.startsWith("/dashboard/modulos/entregas")) return can("dashboard_orders");
      if (c.href.startsWith("/dashboard/modulos/agenda")) return can("dashboard_orders");
      if (c.href.startsWith("/dashboard/modulos/reservas")) return can("dashboard_orders");
      if (c.href.startsWith("/dashboard/modulos/hospedes")) return can("dashboard_orders");
      if (c.href.startsWith("/dashboard/modulos/housekeeping")) return can("dashboard_orders");
      if (c.href.startsWith("/dashboard/modulos/entrega")) return can("dashboard_delivery");
      if (c.href.startsWith("/dashboard/modulos/suporte")) return can("dashboard_support");
      if (c.href.startsWith("/dashboard/modulos/administracao")) return can("manage_attendants");
      if (c.href.startsWith("/dashboard/modulos/vendas")) return can("dashboard_sales");
      if (c.href.startsWith("/dashboard/modulos/cupons")) return can("dashboard_sales");
      return true;
    });
  };

  const banner =
    error === "invalid_category"
      ? { kind: "error" as const, message: "Categoria inválida." }
      : error === "not_owner"
        ? {
            kind: "error" as const,
            message: "Apenas o proprietário pode alterar o tipo de negócio.",
          }
        : error === "save_failed"
          ? {
              kind: "error" as const,
              message:
                "Não foi possível salvar sua escolha agora. Tente novamente.",
            }
          : saved
            ? { kind: "success" as const, message: "Preferência salva." }
            : null;

  const { data: subscription } = await supabase
    .from("merchant_subscriptions")
    .select("status,trial_ends_at,current_period_end,grace_until,plan_amount_cents")
    .eq("merchant_id", merchant.id)
    .maybeSingle();

  const billingBanner = (() => {
    if (!subscription) return null;

    const now = new Date();
    const trialEndsAt = new Date(subscription.trial_ends_at);
    const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : trialEndsAt;
    const graceUntil = subscription.grace_until
      ? new Date(subscription.grace_until)
      : new Date(periodEnd.getTime() + 3 * 24 * 60 * 60 * 1000);

    const msDay = 24 * 60 * 60 * 1000;
    const daysToTrialEnd = Math.ceil((trialEndsAt.getTime() - now.getTime()) / msDay);
    const daysToGraceEnd = Math.ceil((graceUntil.getTime() - now.getTime()) / msDay);

    if (now > graceUntil) {
      return {
        kind: "error" as const,
        message:
          "Assinatura vencida: acesso funcional bloqueado. Regularize para liberar.",
      };
    }

    if (now >= periodEnd) {
      return {
        kind: "error" as const,
        message: `Assinatura vencida. Carência: ${Math.max(0, daysToGraceEnd)} dia(s).`,
      };
    }

    if (now < trialEndsAt && daysToTrialEnd <= 7) {
      return {
        kind: "success" as const,
        message: `Teste grátis termina em ${Math.max(0, daysToTrialEnd)} dia(s).`,
      };
    }

    return null;
  })();

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-zinc-200/50 blur-3xl dark:bg-zinc-800/40"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 right-[-4rem] h-96 w-96 rounded-full bg-zinc-200/40 blur-3xl dark:bg-zinc-800/30"
      />
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Image
                src="/qrbie.png"
                alt="Qerbie"
                width={28}
                height={28}
                priority
                className="h-7 w-7 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900"
              />
              <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Qerbie</h1>
            </div>

            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-200">
              {merchant.name}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://wa.me/558496416053"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-zinc-900 hover:underline dark:text-zinc-50 sm:text-sm"
            >
              <span className="sm:hidden">Suporte</span>
              <span className="hidden sm:inline">Suporte (WhatsApp)</span>
            </a>
            <span className="hidden text-sm text-zinc-500 dark:text-zinc-400 sm:inline">
              {user.email}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-zinc-200 bg-white/80 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Bem-vindo, {user.user_metadata?.full_name ?? user.email}!
          </h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {hasCategory
              ? "Aqui estão suas seções principais. Vamos evoluir por módulos conforme o seu tipo de negócio."
              : "Selecione o tipo de negócio para abrirmos seu painel com as seções certas."}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/pagamento"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              Assinatura / Pagamento
            </Link>
            {!isOwner ? (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Apenas o proprietário consegue gerar o link de pagamento.
              </span>
            ) : null}
          </div>

          {banner && (
            <div
              className={`mt-6 rounded-lg border p-3 text-sm ${
                banner.kind === "error"
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              }`}
            >
              {banner.message}
            </div>
          )}

          {billingBanner && (
            <div
              className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm ${
                billingBanner.kind === "error"
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              }`}
            >
              <span>{billingBanner.message}</span>
              <Link
                href="/dashboard/pagamento"
                className="rounded-md border border-current/20 bg-white/60 px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-white dark:bg-zinc-900/40 dark:text-zinc-50 dark:hover:bg-zinc-900"
              >
                Pagamento
              </Link>
            </div>
          )}

          {showChooser && (
            <section className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Tipo de negócio
                </h3>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {selectedLabel
                    ? `Selecionado: ${selectedLabel}`
                    : "Você ainda não selecionou."}
                </p>
              </div>

              {!isOwner && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Somente o proprietário pode alterar.
                </span>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {BUSINESS_CATEGORIES.map((c) => {
                const selected = merchant.business_category === c.key;

                return (
                  <form key={c.key} action={setBusinessCategory}>
                    <input type="hidden" name="category" value={c.key} />
                    <button
                      type="submit"
                      disabled={!isOwner}
                      className={`w-full rounded-lg border p-4 text-left transition-colors disabled:opacity-60 ${
                        selected
                          ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800"
                          : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                            {c.label}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            Configurar seções para {c.label.toLowerCase()}.
                          </p>
                        </div>
                        {selected && (
                          <span className="rounded bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold text-white dark:bg-zinc-50 dark:text-zinc-900">
                            ATIVO
                          </span>
                        )}
                      </div>
                    </button>
                  </form>
                );
              })}
            </div>
          </section>
          )}

          {!showChooser && hasCategory && (
            <section className="mt-10">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    Painel — {selectedLabel}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {modules.headerNudge}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {isOwner ? (
                    <>
                      <a
                        href="/dashboard?choose=1"
                        className="text-xs font-medium text-zinc-500 hover:underline dark:text-zinc-400"
                      >
                        Trocar tipo
                      </a>
                      <span className="text-zinc-300 dark:text-zinc-700">•</span>
                    </>
                  ) : null}

                  {isOwner || can("dashboard_branding") ? (
                    <a
                      href="/dashboard/branding"
                      className="text-xs font-medium text-zinc-500 hover:underline dark:text-zinc-400"
                    >
                      Personalizar marca (QR)
                    </a>
                  ) : null}
                </div>
              </div>

              {/* Tabs */}
              <div className="mt-4 flex flex-wrap gap-2">
                <TabLink
                  active={activeSection === "catalogo"}
                  href={`/dashboard?category=${encodeURIComponent(selectedKey ?? "")}&section=catalogo`}
                  label="Catálogo"
                />
                <TabLink
                  active={activeSection === "atendimento"}
                  href={`/dashboard?category=${encodeURIComponent(selectedKey ?? "")}&section=atendimento`}
                  label="Atendimento"
                />
                <TabLink
                  active={activeSection === "vendas"}
                  href={`/dashboard?category=${encodeURIComponent(selectedKey ?? "")}&section=vendas`}
                  label="Vendas"
                />
                <TabLink
                  active={activeSection === "historico"}
                  href={`/dashboard?category=${encodeURIComponent(selectedKey ?? "")}&section=historico`}
                  label="Histórico de Vendas"
                />
              </div>

              {/* Content */}
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {activeSection === "catalogo" &&
                  filterCards(modules.sections.catalogo).map((c) => (
                    <DashboardCard
                      key={c.title}
                      title={c.title}
                      description={c.description}
                      hint={c.hint}
                      href={c.href}
                      ctaLabel={c.ctaLabel}
                    />
                  ))}

                {activeSection === "atendimento" &&
                  filterCards(modules.sections.atendimento).map((c) => (
                    <DashboardCard
                      key={c.title}
                      title={c.title}
                      description={c.description}
                      hint={c.hint}
                      href={c.href}
                      ctaLabel={c.ctaLabel}
                    />
                  ))}

                {activeSection === "vendas" &&
                  filterCards(modules.sections.vendas).map((c) => (
                    <DashboardCard
                      key={c.title}
                      title={c.title}
                      description={c.description}
                      hint={c.hint}
                      href={c.href}
                      ctaLabel={c.ctaLabel}
                    />
                  ))}

                {activeSection === "historico" && (
                  <>
                    <div className="sm:col-span-3 rounded-lg border border-zinc-200 p-5 dark:border-zinc-700">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                            Histórico de Vendas
                          </h4>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            Acompanhe o desempenho do seu negócio por período e entenda seus resultados.
                          </p>
                        </div>

                        <HistoryRangePicker
                          category={selectedKey ?? ""}
                          currentRange={historyRange}
                          hasExplicitRange={hasExplicitHistoryRange}
                        />
                      </div>

                      {!canSales ? (
                        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
                          Você não tem permissão para acessar Histórico de Vendas.
                        </div>
                      ) : (
                        <>
                          <div className="mt-4 grid gap-4 sm:grid-cols-3">
                            <DashboardCard
                              title="Pedidos"
                              description="Total de pedidos no período"
                              hint={String(history?.totalOrders ?? 0)}
                            />
                            <DashboardCard
                              title="Faturamento"
                              description="Total faturado no período"
                              hint={formatBrl(history?.revenue ?? 0)}
                            />
                            <DashboardCard
                              title="Ticket médio"
                              description="Valor médio por pedido"
                              hint={formatBrl(history?.avgTicket ?? 0)}
                            />
                          </div>

                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-700">
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                                  Produtos mais vendidos
                                </h3>
                                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                  Top do período
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                Ranking dos itens mais pedidos no período selecionado.
                              </p>

                              <div className="mt-4 space-y-2">
                                {(history?.topProducts?.length ?? 0) > 0 ? (
                                  history!.topProducts.map((p) => (
                                    <div
                                      key={p.name}
                                      className="flex items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-200"
                                    >
                                      <span className="truncate">{p.name}</span>
                                      <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                                        {p.quantity}
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                    Sem dados no período.
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-700">
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                                  Vendas por atendente
                                </h3>
                                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                  Top do período
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                Total vendido e pedidos concluídos por atendente.
                              </p>

                              <div className="mt-4 space-y-2">
                                {(history?.salesByAttendant?.length ?? 0) > 0 ? (
                                  history!.salesByAttendant.map((a) => (
                                    <div
                                      key={`${a.userId}:${a.label}`}
                                      className="flex items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-200"
                                    >
                                      <div className="min-w-0">
                                        <div className="truncate">{a.label}</div>
                                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                          {a.orders} pedido(s)
                                        </div>
                                      </div>
                                      <div className="shrink-0 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                                        {formatBrl(a.total)}
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                    Sem dados no período.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

function DashboardCard({
  title,
  description,
  hint,
  href,
  ctaLabel,
}: {
  title: string;
  description: string;
  hint: string;
  href?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="group rounded-xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {title}
        </h3>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-200">
          {hint}
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {description}
      </p>

      {href && (
        <div className="mt-4">
          <a
            href={href}
            className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {ctaLabel ?? "Abrir"}
          </a>
        </div>
      )}
    </div>
  );
}

function TabLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <a
      href={href}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
          : "border-zinc-200 bg-white/80 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-800"
      }`}
    >
      {label}
    </a>
  );
}
