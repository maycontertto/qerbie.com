import { getMerchantMemberOrRedirect } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { uploadMyAvatar } from "@/lib/merchant/attendantsActions";

export const dynamic = "force-dynamic";

export default async function AtendenteHomePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; avatar_saved?: string; error?: string }>;
}) {
  const { saved, avatar_saved, error } = await searchParams;
  const { user, merchant } = await getMerchantMemberOrRedirect();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("merchant_members")
    .select("display_name, login, avatar_url")
    .eq("merchant_id", merchant.id)
    .eq("user_id", user.id)
    .maybeSingle();

  const message =
    error === "avatar_missing"
      ? "Selecione uma imagem."
      : error === "avatar_type"
        ? "Arquivo inválido. Envie uma imagem."
        : error === "avatar_too_large"
          ? "Imagem muito grande (máx. 3MB)."
          : error === "bucket_missing"
            ? "Bucket 'member-avatars' não existe no Supabase (aplique a migração 022)."
            : error === "avatar_upload_failed"
              ? "Falha ao enviar a foto. Tente novamente."
              : null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              Atendimento
            </h1>
            <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {merchant.name}
            </span>
          </div>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {user.email}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {saved === "1" && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
            Vinculado com sucesso.
          </div>
        )}

        {avatar_saved === "1" && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
            Foto atualizada.
          </div>
        )}

        {message && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {message}
          </div>
        )}

        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-50 text-sm font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>
                    {String(profile?.display_name ?? profile?.login ?? user.email ?? "A")
                      .trim()
                      .slice(0, 1)
                      .toUpperCase()}
                  </span>
                )}
              </div>

              <div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {profile?.display_name ?? profile?.login ?? "Atendente"}
                </div>
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Loja: {merchant.name}
                </div>
              </div>
            </div>

            <form action={uploadMyAvatar} encType="multipart/form-data" className="flex items-center gap-2">
              <input
                name="avatar"
                type="file"
                accept="image/*"
                className="text-sm text-zinc-700 dark:text-zinc-300"
                required
              />
              <button
                type="submit"
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Enviar foto
              </button>
            </form>
          </div>
        </section>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <a
            href="/atendente/pedidos"
            className="rounded-2xl border border-zinc-200 bg-white p-5 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Pedidos
            </div>
            <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Ver e atualizar status dos pedidos.
            </div>
          </a>

          <a
            href="/atendente/tirar-pedido"
            className="rounded-2xl border border-zinc-200 bg-white p-5 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Tirar pedido
            </div>
            <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Abrir o cardápio por mesa e fazer o pedido.
            </div>
          </a>
        </div>

        <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
          Dica: o painel principal (/dashboard) é exclusivo do proprietário.
        </p>
      </main>
    </div>
  );
}
