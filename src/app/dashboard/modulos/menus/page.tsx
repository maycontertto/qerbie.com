import Link from "next/link";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { createMenu, updateMenu } from "@/lib/catalog/menuActions";
import { createMenuCategory } from "@/lib/catalog/actions";

export const dynamic = "force-dynamic";

export default async function MenusPage({ searchParams }: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const canManage = isOwner || (membership
    ? hasMemberPermission(membership.role, membership.permissions, "dashboard_products")
    : false);
  if (!canManage) return <main className="mx-auto max-w-3xl p-6"><h1 className="text-2xl font-bold">Cardápios</h1><p className="mt-2">Você não tem permissão para acessar este módulo.</p></main>;

  const supabase = await createClient({}, { withAuth: true });
  const { data: menus } = await supabase.from("menus")
    .select("id,name,description,slug,is_active,display_order,created_at")
    .eq("merchant_id", merchant.id)
    .order("display_order", { ascending: true }).order("created_at", { ascending: true });
  const menuIds = (menus ?? []).map((menu) => menu.id);
  const [{ data: categories }, { data: products }] = menuIds.length
    ? await Promise.all([
        supabase.from("menu_categories").select("id,menu_id,name,is_active")
          .eq("merchant_id", merchant.id).in("menu_id", menuIds).order("display_order", { ascending: true }),
        supabase.from("products").select("id,menu_id,is_active")
          .eq("merchant_id", merchant.id).in("menu_id", menuIds),
      ])
    : [{ data: [] }, { data: [] }];

  const banner = error === "invalid"
    ? "Confira se o nome do cardápio tem pelo menos 2 caracteres."
    : error === "save_failed"
      ? "Não foi possível salvar. Tente novamente."
      : saved === "1" ? "Alterações salvas." : "";

  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><Link href="/dashboard" className="text-sm font-medium hover:underline">← Voltar ao painel</Link>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand">Catálogo</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Cardápios e categorias</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">Organize cardápios por horário, canal ou tipo de atendimento. Cada cardápio pode ter suas próprias categorias e produtos.</p>
      </div>
      <Link href="/dashboard/modulos/produtos" className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">Abrir produtos</Link>
    </header>

    {banner && <p role="status" className={`rounded-xl border p-3 text-sm ${error ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100" : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"}`}>{banner}</p>}

    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold">Novo cardápio</h2>
      <form action={createMenu} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]">
        <input name="name" required minLength={2} maxLength={120} placeholder="Ex.: Almoço" aria-label="Nome do cardápio" className="rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
        <input name="description" maxLength={500} placeholder="Descrição (opcional)" aria-label="Descrição" className="rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
        <button className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brandHover">Criar cardápio</button>
      </form>
    </section>

    {!menus?.length ? <section className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700"><h2 className="text-lg font-semibold">Seu primeiro cardápio</h2><p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Crie um cardápio acima para organizar categorias e começar a adicionar produtos.</p></section> : <div className="grid gap-5 lg:grid-cols-2">
      {menus.map((menu) => {
        const menuCategories = (categories ?? []).filter((category) => category.menu_id === menu.id);
        const menuProducts = (products ?? []).filter((product) => product.menu_id === menu.id);
        return <article key={menu.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <form action={updateMenu} className="space-y-3">
            <input type="hidden" name="menu_id" value={menu.id} />
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold">{menu.name}</h2><p className="mt-1 text-xs text-zinc-500">{menuProducts.length} produtos · {menuCategories.length} categorias · /{menu.slug}</p></div>
              <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" name="is_active" defaultChecked={menu.is_active} className="h-4 w-4" />Publicado</label></div>
            <input name="name" required minLength={2} maxLength={120} defaultValue={menu.name} aria-label={`Nome do cardápio ${menu.name}`} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
            <input name="description" maxLength={500} defaultValue={menu.description ?? ""} placeholder="Descrição" aria-label="Descrição do cardápio" className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
            <button className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">Salvar cardápio</button>
          </form>

          <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <h3 className="text-sm font-semibold">Categorias</h3>
            {menuCategories.length ? <ul className="mt-2 flex flex-wrap gap-2">{menuCategories.map((category) => <li key={category.id} className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{category.name}{!category.is_active ? " · oculta" : ""}</li>)}</ul> : <p className="mt-2 text-sm text-zinc-500">Ainda sem categorias.</p>}
            <form action={createMenuCategory} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
              <input type="hidden" name="menu_id" value={menu.id} />
              <input type="hidden" name="redirect_to" value="/dashboard/modulos/menus" />
              <input name="name" required minLength={2} maxLength={120} placeholder="Ex.: Pratos principais" aria-label="Nome da categoria" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
              <input name="description" maxLength={500} placeholder="Descrição (opcional)" aria-label="Descrição da categoria" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
              <button className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">Adicionar categoria</button>
            </form>
            <Link href={`/dashboard/modulos/produtos?menu=${encodeURIComponent(menu.id)}`} className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">Gerenciar produtos deste cardápio →</Link>
          </div>
        </article>;
      })}
    </div>}
  </main>;
}
