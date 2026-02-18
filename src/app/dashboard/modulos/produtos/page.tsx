import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  createMenuCategory,
  createProduct,
  createSuggestedMenuCategories,
} from "@/lib/catalog/actions";
import { DEFAULT_MENU_NAME, DEFAULT_MENU_SLUG } from "@/lib/catalog/templates";
import { CategorySelect } from "./CategorySelect";

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

export default async function ProdutosModulePage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    error?: string;
    q?: string;
    catq?: string;
    preset?: string;
    created?: string;
    removed?: string;
  }>;
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
            <a
              href="/dashboard"
              className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            >
              ← Voltar ao painel
            </a>
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Produtos
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

    // If slug collided, retry with randomized slug.
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
            <a
              href="/dashboard"
              className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            >
              ← Voltar ao painel
            </a>
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Produtos
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Não foi possível criar/ler o menu principal.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const { category, error, q, catq, preset, created, removed } = await searchParams;

  const presetKey = (preset ?? "").trim().toLowerCase();
  const presetCategoryName =
    presetKey === "bebidas"
      ? "Bebidas"
      : presetKey === "petiscos"
        ? "Petiscos"
        : presetKey === "combos"
          ? "Combos"
          : presetKey === "pizzas"
            ? "Pizzas"
            : presetKey === "adicionais"
              ? "Adicionais"
              : "";

  if (!category && presetCategoryName) {
    const { data: existingPreset } = await supabase
      .from("menu_categories")
      .select("id")
      .eq("merchant_id", merchant.id)
      .eq("menu_id", menu.id)
      .eq("name", presetCategoryName)
      .maybeSingle();

    const presetCategoryId = existingPreset?.id
      ? String(existingPreset.id)
      : (
          await supabase
            .from("menu_categories")
            .insert({
              merchant_id: merchant.id,
              menu_id: menu.id,
              name: presetCategoryName,
              description: null,
              is_active: true,
              display_order: 0,
            })
            .select("id")
            .maybeSingle()
        ).data?.id;

    if (presetCategoryId) {
      redirect(`/dashboard/modulos/produtos?category=${encodeURIComponent(String(presetCategoryId))}`);
    }
  }

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

  const selectedCategoryId =
    category ?? (categories && categories.length > 0 ? categories[0].id : "");

  let productsQuery = supabase
    .from("products")
    .select("id, name, price, image_url, is_active, track_stock, stock_quantity")
    .eq("merchant_id", merchant.id)
    .eq("menu_id", menu.id);

  if (selectedCategoryId) {
    productsQuery = productsQuery.eq("category_id", selectedCategoryId);
  }

  const itemQuery = (q ?? "").trim();
  if (itemQuery) {
    productsQuery = productsQuery.ilike("name", `%${itemQuery}%`);
  }

  const { data: products } = await productsQuery
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  const banner =
    error === "invalid_category"
      ? "Categoria inválida."
      : error === "invalid_product"
        ? "Produto inválido."
        : error === "category_create_failed"
          ? "Falha ao criar categoria."
          : error === "product_create_failed"
            ? "Falha ao criar produto."
            : error === "image_type"
              ? "Arquivo inválido. Envie uma imagem (PNG/JPG/WebP)."
              : error === "image_too_large"
                ? "Imagem muito grande. Use um arquivo menor (até 12MB)."
            : null;

  const successBanner =
    created
      ? "Item cadastrado. Pronto para cadastrar outro."
      : removed
        ? "Item removido."
        : null;

  const returnTo = `/dashboard/modulos/produtos?category=${encodeURIComponent(String(selectedCategoryId ?? ""))}`
    + (itemQuery ? `&q=${encodeURIComponent(itemQuery)}` : "")
    + (categorySearch ? `&catq=${encodeURIComponent(categorySearch)}` : "");

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <a
              href="/dashboard"
              className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            >
              ← Voltar ao painel
            </a>
            <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Catálogo de itens
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Crie categorias (ex: Medicamentos) e depois cadastre itens com foto,
              descrição e valor.
            </p>
          </div>

          <a
            href="/dashboard/branding"
            className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
          >
            Personalizar marca (QR)
          </a>
        </div>

        {banner && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {banner}
          </div>
        )}

        {successBanner && !banner ? (
          <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            {successBanner}
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Sidebar */}
          <aside className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Categorias
                </h2>
                <form action={createSuggestedMenuCategories}>
                  <input type="hidden" name="menu_id" value={menu.id} />
                  <button
                    type="submit"
                    className="text-xs font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
                  >
                    Adicionar sugestões
                  </button>
                </form>
              </div>

              <form method="get" className="mt-3">
                <input type="hidden" name="category" value={selectedCategoryId} />
                {itemQuery ? <input type="hidden" name="q" value={itemQuery} /> : null}
                <input
                  name="catq"
                  defaultValue={categorySearch}
                  placeholder="Buscar categoria"
                  className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
              </form>

              <div className="mt-3 space-y-1">
                {filteredCategories?.length ? (
                  filteredCategories.map((c) => {
                    const active = c.id === selectedCategoryId;
                    return (
                      <a
                        key={c.id}
                        href={`/dashboard/modulos/produtos?category=${encodeURIComponent(c.id)}${
                          itemQuery ? `&q=${encodeURIComponent(itemQuery)}` : ""
                        }${categorySearch ? `&catq=${encodeURIComponent(categorySearch)}` : ""}`}
                        className={`block rounded-lg px-3 py-2 text-sm ${
                          active
                            ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                            : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {c.name}
                      </a>
                    );
                  })
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Nenhuma categoria ainda.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Nova categoria
              </h3>
              <form action={createMenuCategory} className="mt-3 space-y-3">
                <input type="hidden" name="menu_id" value={menu.id} />
                <input
                  name="name"
                  type="text"
                  required
                  minLength={2}
                  placeholder="Ex: Medicamentos"
                  className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
                <input
                  name="description"
                  type="text"
                  placeholder="Opcional"
                  className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
                <button
                  type="submit"
                  className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Criar categoria
                </button>
              </form>
            </div>
          </aside>

          {/* Main */}
          <section className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Novo item</h2>

              <form
                action={createProduct}
                encType="multipart/form-data"
                className="mt-4 grid gap-3 sm:grid-cols-2"
              >
                <input type="hidden" name="menu_id" value={menu.id} />
                <input type="hidden" name="redirect_to" value="/dashboard/modulos/produtos" />
                <input type="hidden" name="return_to" value={returnTo} />

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    Nome do item
                  </label>
                  <input
                    name="name"
                    type="text"
                    required
                    minLength={2}
                    placeholder="Ex: Ibuprofeno 400mg"
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    Código de barras
                  </label>
                  <input
                    name="barcode"
                    type="text"
                    inputMode="numeric"
                    placeholder="Opcional (para usar no Caixa)"
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    Categoria
                  </label>
                  <div className="mt-1">
                    <CategorySelect
                      name="category_id"
                      categories={(categories ?? []).map((c) => ({ id: c.id, name: c.name }))}
                      defaultValue={selectedCategoryId}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    Preço
                  </label>
                  <input
                    name="price"
                    type="text"
                    placeholder="Ex: 19,90"
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    Descrição
                  </label>
                  <textarea
                    name="description"
                    rows={3}
                    placeholder="Opcional"
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    Imagem (URL)
                  </label>
                  <input
                    name="image_url"
                    type="url"
                    placeholder="Opcional (você pode fazer upload na tela do item)"
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    Foto (arquivo do dispositivo)
                  </label>
                  <input
                    name="image_file"
                    type="file"
                    accept="image/*"
                    className="mt-1 block w-full text-xs text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-zinc-800 dark:text-zinc-300 dark:file:bg-zinc-50 dark:file:text-zinc-900 dark:hover:file:bg-zinc-200"
                  />
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Se você enviar um arquivo aqui, ele substitui a URL.
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Restrições (farmácia)
                  </p>
                  <div className="mt-2 flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                      <input name="requires_prescription" type="checkbox" className="h-4 w-4" />
                      Exige receita
                    </label>
                    <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                      <input name="requires_document" type="checkbox" className="h-4 w-4" />
                      Exige documento
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Se marcado, o cliente verá um aviso no cardápio (não bloqueia pedidos).
                  </p>
                </div>

                {isOwner ? (
                  <div className="sm:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Estoque (opcional)
                    </p>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                        <input name="track_stock" type="checkbox" className="h-4 w-4" />
                        Controlar estoque deste item
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

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    Criar item
                  </button>
                </div>
              </form>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Itens
                </h2>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Clique no nome para editar
                </span>
              </div>

              <form method="get" className="mt-3 grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="category" value={selectedCategoryId} />
                {categorySearch ? <input type="hidden" name="catq" value={categorySearch} /> : null}
                <input
                  name="q"
                  defaultValue={itemQuery}
                  placeholder="Buscar item pelo nome"
                  className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Buscar
                </button>
              </form>

              {!products?.length ? (
                <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                  {itemQuery ? "Nenhum item encontrado para essa busca." : "Nenhum item nesta categoria."}
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
                  {products.map((p) => (
                    <li key={p.id} className="py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <a
                            href={`/dashboard/modulos/produtos/${encodeURIComponent(p.id)}`}
                            className="block truncate text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
                          >
                            {p.name}
                          </a>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            R$ {Number(p.price ?? 0).toFixed(2)} • {p.is_active ? "Ativo" : "Inativo"}
                            {Boolean((p as { track_stock?: boolean }).track_stock)
                              ? ` • Qtd: ${Number((p as { stock_quantity?: number }).stock_quantity ?? 0)}`
                              : ""}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <a
                            href={`/dashboard/modulos/produtos/${encodeURIComponent(p.id)}`}
                            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                          >
                            Editar
                          </a>

                          {isOwner ? (
                            <form action={deleteProduct}>
                              <input type="hidden" name="product_id" value={p.id} />
                              <input
                                type="hidden"
                                name="redirect_to"
                                value="/dashboard/modulos/produtos"
                              />
                              <input type="hidden" name="return_to" value={returnTo} />
                              <button
                                type="submit"
                                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900/40"
                              >
                                Remover
                              </button>
                            </form>
                          ) : null}

                          {p.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.image_url}
                              alt={p.name}
                              className="h-12 w-12 shrink-0 rounded-lg border border-zinc-200 bg-white object-cover dark:border-zinc-800"
                            />
                          ) : (
                            <div className="h-12 w-12 shrink-0 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950" />
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
