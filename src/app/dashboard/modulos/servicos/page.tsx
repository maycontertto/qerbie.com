import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  createMenuCategory,
  createProduct,
  createSuggestedMenuCategories,
} from "@/lib/catalog/actions";
import { DEFAULT_MENU_NAME, DEFAULT_MENU_SLUG } from "@/lib/catalog/templates";
import Link from "next/link";
import { CategorySelect } from "../produtos/CategorySelect";

function makeSlug(base: string): string {
  const normalized = base
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const suffix = Math.random().toString(36).slice(2, 8);
  return `${normalized || "menu"}-${suffix}`;
}

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default async function ServicosModulePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; error?: string; q?: string; catq?: string }>;
}) {
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const canProducts =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_products")
      : false);

  if (!canProducts) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            >
              ← Voltar ao painel
            </Link>
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Serviços
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Você não tem permissão para acessar este módulo.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const supabase = await createClient();

  // Ensure a primary menu exists (products require menu_id)
  let { data: menu } = await supabase
    .from("menus")
    .select("id, name, slug")
    .eq("merchant_id", merchant.id)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!menu) {
    const slug = DEFAULT_MENU_SLUG;
    const { data: inserted } = await supabase
      .from("menus")
      .insert({
        merchant_id: merchant.id,
        name: DEFAULT_MENU_NAME,
        description: null,
        slug,
        is_active: true,
        display_order: 0,
      })
      .select("id, name, slug")
      .maybeSingle();

    menu = inserted ?? null;

    if (!menu) {
      const altSlug = makeSlug(DEFAULT_MENU_SLUG);
      const { data: inserted2 } = await supabase
        .from("menus")
        .insert({
          merchant_id: merchant.id,
          name: DEFAULT_MENU_NAME,
          description: null,
          slug: altSlug,
          is_active: true,
          display_order: 0,
        })
        .select("id, name, slug")
        .maybeSingle();

      menu = inserted2 ?? null;
    }
  }

  if (!menu) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            >
              ← Voltar ao painel
            </Link>
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Serviços
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Não foi possível criar/ler o catálogo principal.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const { category, error, q, catq } = await searchParams;

  const { data: categories } = await supabase
    .from("menu_categories")
    .select("id, name, is_active")
    .eq("merchant_id", merchant.id)
    .eq("menu_id", menu.id)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  function normalize(s: string): string {
    return s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  const categorySearch = (catq ?? "").trim();
  const filteredCategories = !categorySearch
    ? categories
    : (categories ?? []).filter((c) => normalize(c.name).includes(normalize(categorySearch)));

  const activeCategoryId = (category ?? "").trim();

  const { data: services } = await supabase
    .from("products")
    .select("id, name, description, price, is_active, category_id, track_stock, stock_quantity")
    .eq("merchant_id", merchant.id)
    .eq("menu_id", menu.id)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  const nameQuery = (q ?? "").trim();
  const filteredServices = (services ?? []).filter((s) => {
    if (activeCategoryId && String(s.category_id ?? "") !== activeCategoryId) return false;
    if (!nameQuery) return true;
    return normalize(String(s.name ?? "")).includes(normalize(nameQuery));
  });

  const banner =
    error === "invalid_category"
      ? { kind: "error" as const, message: "Categoria inválida." }
      : error === "category_create_failed"
        ? { kind: "error" as const, message: "Falha ao criar categoria." }
        : error === "invalid_product"
          ? { kind: "error" as const, message: "Preencha nome e valor corretamente." }
          : error === "product_create_failed"
            ? { kind: "error" as const, message: "Falha ao criar serviço." }
            : null;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
          <div>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            >
              ← Voltar ao painel
            </Link>
            <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Serviços
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Cadastre procedimentos/exames e organize por especialidades (categorias).
            </p>
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

          <div className="mt-8 grid gap-6 lg:grid-cols-12">
            <section className="lg:col-span-4">
              <div className="rounded-2xl border border-zinc-200 bg-white/60 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/40">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Especialidades (categorias)
                </h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Ex.: Odontologia, Ortopedia, Exames laboratoriais.
                </p>

                <form action={createSuggestedMenuCategories} className="mt-4">
                  <input type="hidden" name="menu_id" value={menu.id} />
                  <input type="hidden" name="redirect_to" value="/dashboard/modulos/servicos" />
                  <button
                    type="submit"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Criar sugestões automáticas
                  </button>
                </form>

                <form action={createMenuCategory} className="mt-4 space-y-3">
                  <input type="hidden" name="menu_id" value={menu.id} />
                  <input type="hidden" name="redirect_to" value="/dashboard/modulos/servicos" />

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Nome
                    </label>
                    <input
                      name="name"
                      type="text"
                      minLength={2}
                      required
                      placeholder="Ex.: Odontologia"
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Descrição (opcional)
                    </label>
                    <input
                      name="description"
                      type="text"
                      placeholder="Ex.: Especialidades e procedimentos"
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    Criar categoria
                  </button>
                </form>

                <div className="mt-5">
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Buscar categoria
                  </label>
                  <form className="mt-1" action="/dashboard/modulos/servicos" method="get">
                    <input
                      name="catq"
                      defaultValue={categorySearch}
                      placeholder="Digite para filtrar"
                      className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  </form>
                </div>

                <div className="mt-4 space-y-2">
                  <Link
                    href="/dashboard/modulos/servicos"
                    className={`block rounded-lg border px-3 py-2 text-sm ${
                      !activeCategoryId
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                        : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    Todas
                  </Link>
                  {(filteredCategories ?? []).map((c) => (
                    <Link
                      key={c.id}
                      href={`/dashboard/modulos/servicos?category=${encodeURIComponent(c.id)}`}
                      className={`block rounded-lg border px-3 py-2 text-sm ${
                        String(c.id) === activeCategoryId
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                          : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {c.name}
                      {!c.is_active && (
                        <span className="ml-2 text-xs text-zinc-400">(inativa)</span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            </section>

            <section className="lg:col-span-8">
              <div className="rounded-2xl border border-zinc-200 bg-white/60 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/40">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Novo serviço
                </h2>

                <form action={createProduct} className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="menu_id" value={menu.id} />
                  <input type="hidden" name="redirect_to" value="/dashboard/modulos/servicos" />

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Nome
                    </label>
                    <input
                      name="name"
                      type="text"
                      required
                      minLength={2}
                      placeholder="Ex.: Consulta (Clínico Geral)"
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Categoria
                    </label>
                    <div className="mt-1">
                      <CategorySelect
                        name="category_id"
                        categories={(categories ?? []).map((c) => ({ id: c.id, name: c.name }))}
                        defaultValue={activeCategoryId}
                        className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Valor
                    </label>
                    <input
                      name="price"
                      type="text"
                      placeholder="Ex.: 150,00"
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Descrição (opcional)
                    </label>
                    <textarea
                      name="description"
                      rows={3}
                      placeholder="Ex.: Inclui avaliação inicial e orientação."
                      className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  </div>

                  {isOwner ? (
                    <div className="sm:col-span-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Estoque (opcional)
                      </p>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                          <input name="track_stock" type="checkbox" className="h-4 w-4" />
                          Controlar estoque deste serviço
                        </label>
                        <div>
                          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                            Quantidade
                          </label>
                          <input
                            name="stock_quantity"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            placeholder="Ex: 20"
                            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                          />
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Apenas controle interno do dono. Não impede vendas se estiver desatualizado.
                      </p>
                    </div>
                  ) : null}

                  <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                      Criar serviço
                    </button>
                  </div>
                </form>
              </div>

              <div className="mt-6 rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Serviços cadastrados
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Clique para editar (valor, descrição e status).
                    </p>
                  </div>

                  <form action="/dashboard/modulos/servicos" method="get">
                    {activeCategoryId && (
                      <input type="hidden" name="category" value={activeCategoryId} />
                    )}
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Buscar serviço
                    </label>
                    <input
                      name="q"
                      defaultValue={nameQuery}
                      placeholder="Digite o nome"
                      className="mt-1 block w-[260px] rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  </form>
                </div>

                {filteredServices.length === 0 ? (
                  <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                    Nenhum serviço encontrado.
                  </p>
                ) : (
                  <div className="mt-4 divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                    {filteredServices.map((s) => (
                      <Link
                        key={s.id}
                        href={`/dashboard/modulos/servicos/${encodeURIComponent(s.id)}`}
                        className="flex items-start justify-between gap-4 bg-white/70 p-4 backdrop-blur hover:bg-white dark:bg-zinc-900/50 dark:hover:bg-zinc-800/70"
                      >
                        <div>
                          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                            {s.name}
                            {!s.is_active && (
                              <span className="ml-2 text-xs font-medium text-zinc-400">
                                (inativo)
                              </span>
                            )}
                            {Boolean((s as { track_stock?: boolean }).track_stock) ? (
                              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                {` • Qtd: ${Number((s as { stock_quantity?: number }).stock_quantity ?? 0)}`}
                              </span>
                            ) : null}
                          </div>
                          {s.description && (
                            <div className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                              {s.description}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          {formatBrl(Number(s.price ?? 0))}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
