import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { deleteProduct, updateProduct } from "@/lib/catalog/actions";
import { ProductImageUploader } from "@/app/dashboard/modulos/produtos/ProductImageUploader";
import Link from "next/link";
import { CategorySelect } from "../CategorySelect";

export default async function ProductEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const { productId } = await params;
  const { error, saved } = await searchParams;

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

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("merchant_id", merchant.id)
    .maybeSingle();

  if (!product) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <Link
              href="/dashboard/modulos/produtos"
              className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            >
              ← Voltar
            </Link>
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Item não encontrado
            </h1>
          </div>
        </main>
      </div>
    );
  }

  const { data: categories } = await supabase
    .from("menu_categories")
    .select("id, name")
    .eq("merchant_id", merchant.id)
    .eq("menu_id", product.menu_id)
    .order("display_order", { ascending: true });

  const banner =
    error === "save_failed"
      ? {
          kind: "error" as const,
          message: "Não foi possível salvar. Tente novamente.",
        }
      : error === "bucket_missing"
        ? {
            kind: "error" as const,
            message:
              "Não foi possível enviar a imagem porque o bucket 'product-images' não existe no Supabase. Aplique a migração 015_storage_product_images.sql e tente novamente.",
          }
        : error === "image_upload_failed"
          ? {
              kind: "error" as const,
              message: "Falha ao enviar a imagem. Tente novamente.",
            }
          : error === "image_missing"
            ? {
                kind: "error" as const,
                message: "Selecione uma imagem antes de enviar.",
              }
              : error === "image_type"
                ? {
                    kind: "error" as const,
                    message: "Arquivo inválido. Envie uma imagem (PNG/JPG/WebP).",
                  }
            : error === "image_too_large"
              ? {
                  kind: "error" as const,
                  message: "Imagem muito grande. Use um arquivo menor (até 8MB).",
                }
      : saved
        ? { kind: "success" as const, message: "Salvo." }
        : null;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link
                href="/dashboard/modulos/produtos"
                className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
              >
                ← Voltar para produtos
              </Link>
              <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                {product.name}
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Edite foto, descrição e valor.
              </p>
            </div>

            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image_url}
                alt={product.name}
                className="h-20 w-20 rounded-2xl border border-zinc-200 bg-white object-cover dark:border-zinc-800"
              />
            ) : (
              <div className="h-20 w-20 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950" />
            )}
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

          <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <ProductImageUploader
              productId={product.id}
              redirectTo="/dashboard/modulos/produtos"
            />
          </div>

          <form action={updateProduct} className="mt-6 space-y-5">
            <input type="hidden" name="product_id" value={product.id} />
            <input type="hidden" name="redirect_to" value="/dashboard/modulos/produtos" />

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Nome
              </label>
              <input
                name="name"
                type="text"
                defaultValue={product.name}
                required
                minLength={2}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Categoria
              </label>
              <div className="mt-1">
                <CategorySelect
                  name="category_id"
                  categories={(categories ?? []).map((c) => ({ id: c.id, name: c.name }))}
                  defaultValue={product.category_id ?? ""}
                  className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Preço
              </label>
              <input
                name="price"
                type="text"
                defaultValue={Number(product.price ?? 0).toFixed(2).replace(".", ",")}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Descrição
              </label>
              <textarea
                name="description"
                rows={4}
                defaultValue={product.description ?? ""}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Imagem (URL)
              </label>
              <input
                name="image_url"
                type="url"
                defaultValue={product.image_url ?? ""}
                placeholder="https://..."
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  name="is_active"
                  type="checkbox"
                  defaultChecked={product.is_active}
                  className="h-4 w-4"
                />
                Ativo
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  name="is_featured"
                  type="checkbox"
                  defaultChecked={product.is_featured}
                  className="h-4 w-4"
                />
                Destaque
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Salvar
              </button>

              {isOwner && (
                <button
                  type="submit"
                  formAction={deleteProduct}
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
                >
                  Excluir
                </button>
              )}
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
