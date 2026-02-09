import { uploadProductImage } from "@/lib/catalog/actions";

export function ProductImageUploader({
  productId,
  disabled,
  redirectTo,
}: {
  productId: string;
  disabled?: boolean;
  redirectTo?: "/dashboard/modulos/produtos" | "/dashboard/modulos/servicos";
}) {
  const safeRedirectTo = redirectTo ?? "/dashboard/modulos/produtos";
  return (
    <div className="space-y-2">
      <form
        action={uploadProductImage}
        encType="multipart/form-data"
        className="space-y-2"
      >
        <input type="hidden" name="product_id" value={productId} />
        <input type="hidden" name="redirect_to" value={safeRedirectTo} />

        <div className="flex items-center justify-between gap-3">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Foto do produto
          </label>
          <input
            name="image_file"
            type="file"
            accept="image/*"
            disabled={disabled}
            className="block w-[220px] text-xs text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-zinc-800 disabled:opacity-60 dark:text-zinc-300 dark:file:bg-zinc-50 dark:file:text-zinc-900 dark:hover:file:bg-zinc-200"
          />
        </div>

        <button
          type="submit"
          disabled={disabled}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Enviar imagem
        </button>
      </form>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Dica: se o upload falhar, você ainda pode colar uma URL da imagem no campo “Imagem (URL)”.
      </p>
    </div>
  );
}
