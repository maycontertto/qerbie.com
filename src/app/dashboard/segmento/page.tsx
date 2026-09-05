import Image from "next/image";
import { redirect } from "next/navigation";
import { getDashboardUserOrRedirect } from "@/lib/auth/guard";
import { setBusinessCategory } from "@/lib/merchant/actions";
import { BUSINESS_CATEGORIES } from "@/lib/merchant/businessCategories";
import { BUSINESS_CATEGORY_EMOJI } from "@/lib/merchant/businessCategoryIcons";
import { getBusinessCategoryLabel } from "@/lib/merchant/helpers";

export default async function ChooseSegmentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; category?: string }>;
}) {
  const { error, category } = await searchParams;
  const { user, merchant } = await getDashboardUserOrRedirect({ allowSuspended: true });
  const isOwner = user.id === merchant.owner_user_id;

  const selectedKey = merchant.business_category ?? category ?? null;
  const selectedLabel = getBusinessCategoryLabel(selectedKey);

  // Já tem segmento definido e não veio de um erro de gravação: nada a fazer aqui.
  if (selectedLabel && !error) {
    redirect("/dashboard");
  }

  const errorMessage =
    error === "invalid_category"
      ? "Categoria inválida. Escolha uma das opções abaixo."
      : error === "not_owner"
        ? "Apenas o proprietário pode escolher o tipo de negócio."
        : error === "save_failed"
          ? "Não foi possível salvar sua escolha agora. Tente novamente."
          : null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-linear-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-brand/10 blur-3xl"
      />

      <main className="relative mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/qrbie.png"
            alt="Qerbie"
            width={44}
            height={44}
            priority
            className="h-11 w-11 rounded-xl border border-zinc-200 bg-white p-1.5 dark:border-zinc-800 dark:bg-zinc-900"
          />
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            Qual tipo de negócio você possui?
          </h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-300 sm:text-base">
            Escolha o segmento de <strong>{merchant.name}</strong> para abrirmos seu
            painel já com as seções certas para o seu dia a dia.
          </p>
        </div>

        {errorMessage && (
          <div className="mx-auto mt-6 max-w-xl rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        {!isOwner && (
          <div className="mx-auto mt-6 max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
            Somente o proprietário da conta pode escolher o tipo de negócio.
          </div>
        )}

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BUSINESS_CATEGORIES.map((c) => {
            const selected = selectedKey === c.key;

            return (
              <form key={c.key} action={setBusinessCategory}>
                <input type="hidden" name="category" value={c.key} />
                <button
                  type="submit"
                  disabled={!isOwner}
                  className={`group flex w-full items-center gap-4 rounded-2xl border p-5 text-left shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                    selected
                      ? "border-brand bg-brand/5 ring-1 ring-brand"
                      : "border-zinc-200 bg-white/80 hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/60"
                  }`}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-2xl dark:bg-zinc-800">
                    {BUSINESS_CATEGORY_EMOJI[c.key]}
                  </span>
                  <span>
                    <span className="block text-base font-semibold text-zinc-900 dark:text-zinc-50">
                      {c.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                      Ir para o painel de {c.label.toLowerCase()}
                    </span>
                  </span>
                </button>
              </form>
            );
          })}
        </div>
      </main>
    </div>
  );
}
