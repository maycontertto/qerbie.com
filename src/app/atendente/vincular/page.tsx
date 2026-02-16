import { redeemAttendantInvite } from "@/lib/merchant/attendantsActions";
import { getSessionOrRedirect } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export default async function VincularAtendentePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; code?: string; auto?: string }>;
}) {
  const { error, code, auto } = await searchParams;
  const next = `/atendente/vincular${code ? `?code=${encodeURIComponent(code)}` : ""}`;
  // Ensure logged in, otherwise go sign-in (preserving next).
  await getSessionOrRedirect({ redirectTo: `/auth/sign-in?next=${encodeURIComponent(next)}` });

  if (code && auto === "1" && !error) {
    const fd = new FormData();
    fd.set("code", code);
    await redeemAttendantInvite(fd);
  }

  const message =
    error === "code_required"
      ? "Informe o código."
      : error === "invalid"
        ? "Código inválido."
        : error === "used"
          ? "Esse código já foi usado."
          : error === "failed"
            ? "Não foi possível vincular agora. Tente novamente."
            : null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto max-w-md px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Vincular à loja
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Digite o código que o dono te passou.
        </p>

        {message && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {message}
          </div>
        )}

        <form action={redeemAttendantInvite} className="mt-6 space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Código
            </label>
            <input
              name="code"
              placeholder="Ex: MAYCON-AB12"
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              defaultValue={code ?? ""}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Vincular
          </button>
        </form>

        <div className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          Ainda não tem login e senha? Peça ao dono da loja.
        </div>
      </main>
    </div>
  );
}
