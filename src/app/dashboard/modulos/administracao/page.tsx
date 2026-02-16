import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import type { Json, MerchantMemberRole } from "@/lib/supabase/database.types";
import Link from "next/link";
import { headers } from "next/headers";
import * as QRCode from "qrcode";
import {
  createAttendantAccount,
  removeAttendant,
  updateAttendantRole,
  updateAttendantPermissions,
} from "@/lib/merchant/attendantsActions";

export const dynamic = "force-dynamic";

export default async function AdministracaoModulePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; created_login?: string }>;
}) {
  const { saved, error, created_login } = await searchParams;
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;

  const canManage =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "manage_attendants")
      : false);

  if (!canManage) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-6 text-sm text-zinc-700 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
            Você não tem permissão para acessar Administração &amp; Controle.
          </div>
        </main>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: members } = await supabase
    .from("merchant_members")
    .select("id, user_id, role, display_name, login, avatar_url, job_title, permissions, created_at")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false });

  const banner =
    error === "login_required"
      ? { kind: "error" as const, message: "Informe um login (apelido) para o atendente." }
      : error === "password_required"
        ? { kind: "error" as const, message: "Informe uma senha (mínimo 8 caracteres)." }
        : error === "server_config"
          ? {
              kind: "error" as const,
              message:
                "Configuração do servidor incompleta no runtime. Verifique NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (e redeploy/restart). Diagnóstico: /api/diag/env",
            }
        : error === "login_taken"
          ? { kind: "error" as const, message: "Esse login já está em uso. Escolha outro." }
          : error === "create_account_failed"
            ? { kind: "error" as const, message: "Não foi possível criar a conta agora. Tente novamente." }
            : error === "member_create_failed"
              ? { kind: "error" as const, message: "Conta criada, mas falhou ao vincular na loja. Tente novamente." }
        : saved === "1"
          ? {
              kind: "success" as const,
              message: created_login
                ? `Funcionário criado. Login: ${created_login}`
                : "Salvo.",
            }
          : null;

  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  const origin = host ? `${proto}://${host}` : "";

  const staffLoginPathWithLogin = created_login
    ? `/auth/sign-in?next=${encodeURIComponent("/atendente")}&login=${encodeURIComponent(created_login)}`
    : `/auth/sign-in?next=${encodeURIComponent("/atendente")}`;
  const staffLoginLink = origin ? `${origin}${staffLoginPathWithLogin}` : staffLoginPathWithLogin;
  const staffQr = await QRCode.toDataURL(staffLoginLink, { width: 220, margin: 1 });

  const memberHas = (role: MerchantMemberRole, permissions: Json | null | undefined, perm: string) => {
    return hasMemberPermission(role, permissions, perm);
  };

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
          >
            ← Voltar ao painel
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Administração &amp; Controle
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Gerencie atendentes/gerentes e controle exatamente quais partes do sistema cada um pode acessar.
          </p>
        </div>

        {banner && (
          <div
            className={`mt-6 rounded-2xl border p-4 text-sm ${
              banner.kind === "error"
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
                : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
            }`}
          >
            {banner.message}
          </div>
        )}

        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Login de funcionários
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Abra este link em outro aparelho ou leia o QR para ir direto ao login de atendente.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="rounded-xl border border-zinc-200 bg-white/60 p-3 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
              <div className="font-semibold text-zinc-900 dark:text-zinc-50">Link</div>
              <a
                href={staffLoginLink}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block break-all font-mono text-xs text-zinc-700 underline dark:text-zinc-300"
              >
                {staffLoginLink}
              </a>
              {created_login ? (
                <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Login pré-preenchido: <span className="font-mono">{created_login}</span>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={staffQr} alt="QR Code" className="h-[220px] w-[220px]" />
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Cadastrar funcionário
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Você cria o login e a senha e passa para a pessoa usar no app.
            </p>

            <form action={createAttendantAccount} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Nome
                </label>
                <input
                  name="display_name"
                  placeholder="Ex: Maycon"
                  className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Login (apelido)
                </label>
                <input
                  name="login"
                  required
                  placeholder="Ex: maycon"
                  className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Dica: esse login precisa ser único no sistema. Ex: loja-garcom1.
                </p>

                <div className="mt-4">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Senha
                  </label>
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
                    className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Você pode criar um login para ser usado por mais de uma pessoa no mesmo aparelho.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Nível
                </label>
                <select
                  name="role"
                  defaultValue="staff"
                  className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                >
                  <option value="staff">Atendente</option>
                  <option value="admin">Gerente</option>
                </select>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Gerente pode ter os mesmos acessos do dono, mas você pode restringir por área.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Categoria (atendimento)
                </label>
                <select
                  name="job_title"
                  defaultValue="Atendente"
                  className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                >
                  <option value="Atendente">Atendente</option>
                  <option value="Caixa">Caixa</option>
                  <option value="Recepcionista">Recepcionista</option>
                  <option value="Vendedor">Vendedor</option>
                  <option value="Assistente">Assistente</option>
                  <option value="__other__">Outro (personalizado)</option>
                </select>
                <input
                  name="job_title_custom"
                  placeholder="Se escolheu 'Outro', digite aqui. Ex: Garçom"
                  className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  A função é só para identificação. Os acessos são controlados pelo dono em permissões.
                </p>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Criar login e senha
              </button>
            </form>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Atendentes cadastrados
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Eles podem acessar /atendente para ver/trocar status de pedidos e tirar pedidos.
          </p>

          <div className="mt-4 space-y-3">
            {(members ?? []).length === 0 && (
              <div className="rounded-xl border border-zinc-200 bg-white/60 p-3 text-sm text-zinc-700 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
                Nenhum atendente ainda.
              </div>
            )}

            {(members ?? []).map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                    {m.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>
                        {String(m.display_name ?? m.login ?? "A")
                          .trim()
                          .slice(0, 1)
                          .toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {m.display_name ?? m.login ?? m.user_id}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Login: {m.login ?? "—"} • Papel: {m.role}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Categoria: {m.job_title ?? "—"}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <form action={updateAttendantRole} className="flex items-center gap-2">
                    <input type="hidden" name="member_id" value={m.id} />
                    <select
                      name="role"
                      defaultValue={m.role}
                      className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                    >
                      <option value="staff">Atendente</option>
                      <option value="admin">Gerente</option>
                    </select>
                    <button
                      type="submit"
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Salvar
                    </button>
                  </form>

                  {isOwner ? (
                    <form
                      action={updateAttendantPermissions}
                      className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-800"
                    >
                      <input type="hidden" name="member_id" value={m.id} />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                          <input
                            type="checkbox"
                            name="dashboard_access"
                            defaultChecked={memberHas(m.role, m.permissions, "dashboard_access")}
                          />
                          Painel (/dashboard)
                        </label>
                        <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                          <input
                            type="checkbox"
                            name="dashboard_branding"
                            defaultChecked={memberHas(m.role, m.permissions, "dashboard_branding")}
                          />
                          Marca (QR)
                        </label>
                        <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                          <input
                            type="checkbox"
                            name="dashboard_products"
                            defaultChecked={memberHas(m.role, m.permissions, "dashboard_products")}
                          />
                          Produtos
                        </label>
                        <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                          <input
                            type="checkbox"
                            name="dashboard_orders"
                            defaultChecked={memberHas(m.role, m.permissions, "dashboard_orders")}
                          />
                          Pedidos
                        </label>
                        <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                          <input
                            type="checkbox"
                            name="dashboard_delivery"
                            defaultChecked={memberHas(m.role, m.permissions, "dashboard_delivery")}
                          />
                          Entrega
                        </label>
                        <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                          <input
                            type="checkbox"
                            name="dashboard_support"
                            defaultChecked={memberHas(m.role, m.permissions, "dashboard_support")}
                          />
                          Suporte
                        </label>
                        <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                          <input
                            type="checkbox"
                            name="dashboard_sales"
                            defaultChecked={memberHas(m.role, m.permissions, "dashboard_sales")}
                          />
                          Vendas/Cupons
                        </label>
                        <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                          <input
                            type="checkbox"
                            name="manage_attendants"
                            defaultChecked={memberHas(m.role, m.permissions, "manage_attendants")}
                          />
                          Gerenciar atendentes
                        </label>
                      </div>
                      <button
                        type="submit"
                        className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        Salvar acessos
                      </button>
                    </form>
                  ) : null}

                  <form action={removeAttendant}>
                    <input type="hidden" name="member_id" value={m.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Remover
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
