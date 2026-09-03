import Link from "next/link";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  createGymStudent,
  recordGymPayment,
  registerGymFaceProfile,
  registerGymFingerprintTemplate,
  resetGymStudentPassword,
  setGymMembershipDueDate,
  updateGymStudentProfile,
} from "@/lib/gym/actions";
import { FaceCaptureField } from "./FaceCaptureField";

function formatBrlCents(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (cents ?? 0) / 100,
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "");
}

function isOverdue(nextDueAt: string | null | undefined): boolean {
  if (!nextDueAt) return false;
  const due = new Date(`${nextDueAt}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return due.getTime() < now.getTime();
}

export default async function AcademiaAlunosPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; password_reset?: string; error?: string }>;
}) {
  const { saved, password_reset, error } = await searchParams;
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const canAccess =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_products") ||
        hasMemberPermission(membership.role, membership.permissions, "dashboard_orders")
      : false);

  if (!canAccess) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <Link href="/dashboard" className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">
              ← Voltar ao painel
            </Link>
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Alunos</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Você não tem permissão para acessar este módulo.</p>
          </div>
        </main>
      </div>
    );
  }

  const supabase = await createClient({}, { withAuth: true });

  const { data: plans } = await supabase
    .from("gym_plans")
    .select("id, name, price_cents")
    .eq("merchant_id", merchant.id)
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false });

  type PlanRow = { id: string; name: string; price_cents: number };
  const planRows = (plans ?? []) as PlanRow[];

  const { data: students } = await supabase
    .from("gym_students")
    .select("id, name, login, phone, address, is_active, updated_at")
    .eq("merchant_id", merchant.id)
    .order("name", { ascending: true })
    .limit(500);

  const studentIds = (students ?? []).map((s) => s.id);

  let memberships: Array<{
    id: string;
    student_id: string;
    plan_id: string | null;
    status: string;
    next_due_at: string | null;
    last_paid_at: string | null;
    updated_at: string;
  }> = [];

  if (studentIds.length) {
    const { data } = await supabase
      .from("gym_memberships")
      .select("id, student_id, plan_id, status, next_due_at, last_paid_at, updated_at")
      .eq("merchant_id", merchant.id)
      .in("student_id", studentIds)
      .order("updated_at", { ascending: false });

    memberships = (data ?? []) as typeof memberships;
  }

  const membershipByStudent = new Map<string, (typeof memberships)[number]>();
  for (const m of memberships) {
    if (!membershipByStudent.has(m.student_id)) membershipByStudent.set(m.student_id, m);
  }

  let checkins: Array<{ student_id: string; checkin_date: string }> = [];
  if (studentIds.length) {
    const { data } = await supabase
      .from("gym_checkins")
      .select("student_id, checkin_date")
      .eq("merchant_id", merchant.id)
      .in("student_id", studentIds)
      .order("checkin_date", { ascending: false })
      .limit(5000);

    checkins = (data ?? []) as typeof checkins;
  }

  const lastCheckinByStudent = new Map<string, string>();
  for (const c of checkins) {
    if (!lastCheckinByStudent.has(c.student_id)) lastCheckinByStudent.set(c.student_id, c.checkin_date);
  }

  const faceImageByStudent = new Map<string, string>();
  const hasFaceByStudent = new Set<string>();
  const hasFingerprintByStudent = new Set<string>();

  if (studentIds.length) {
    const { data: faceProfiles } = await supabase
      .from("gym_face_profiles")
      .select("student_id, image_url, is_active, updated_at")
      .eq("merchant_id", merchant.id)
      .eq("is_active", true)
      .in("student_id", studentIds)
      .order("updated_at", { ascending: false });

    for (const row of faceProfiles ?? []) {
      hasFaceByStudent.add(row.student_id);
      if (row.image_url && !faceImageByStudent.has(row.student_id)) {
        faceImageByStudent.set(row.student_id, row.image_url);
      }
    }

    const { data: fingerprintTemplates } = await supabase
      .from("gym_fingerprint_templates")
      .select("student_id")
      .eq("merchant_id", merchant.id)
      .eq("is_active", true)
      .in("student_id", studentIds);

    for (const row of fingerprintTemplates ?? []) {
      hasFingerprintByStudent.add(row.student_id);
    }
  }

  const planById = new Map<string, PlanRow>();
  for (const p of planRows) planById.set(p.id, p);

  const banner =
    saved === "1"
      ? { kind: "success" as const, message: "Salvo." }
      : password_reset === "1"
        ? { kind: "success" as const, message: "Senha redefinida." }
      : error === "invalid"
        ? { kind: "error" as const, message: "Dados inválidos." }
        : error === "login_taken"
          ? { kind: "error" as const, message: "Esse login já existe." }
        : error === "device_code_taken"
          ? { kind: "error" as const, message: "Esse código do leitor já está em uso por outro aluno." }
        : error === "save_failed"
          ? { kind: "error" as const, message: "Não foi possível salvar agora. Tente novamente." }
          : null;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div>
          <Link href="/dashboard" className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50">
            ← Voltar ao painel
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Alunos</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Cadastro, vencimentos e biometria. Clique no nome de um aluno para ver os detalhes.
          </p>
        </div>

        {banner ? (
          <div
            className={`mt-6 rounded-2xl border p-4 text-sm ${
              banner.kind === "error"
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
                : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
            }`}
          >
            {banner.message}
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Novo aluno</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Apenas usuário e senha são obrigatórios. O resto pode ser preenchido depois.
            </p>
            <form action={createGymStudent} className="mt-4 space-y-3">
              <input type="hidden" name="return_to" value="/dashboard/modulos/academia_alunos" />
              <input
                name="login"
                required
                minLength={2}
                placeholder="Usuário (ex: joao)"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <input
                name="password"
                required
                minLength={1}
                placeholder="Senha"
                type="password"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <input
                name="name"
                placeholder="Nome completo (opcional)"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <input
                name="phone"
                placeholder="Telefone (opcional)"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <input
                name="address"
                placeholder="Endereço (opcional)"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
              <select
                name="plan_id"
                defaultValue=""
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              >
                <option value="">Sem plano (definir depois)</option>
                {(plans ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({formatBrlCents(Number(p.price_cents ?? 0))})
                  </option>
                ))}
              </select>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Vencimento (opcional)</label>
                <input
                  name="next_due_at"
                  type="date"
                  className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Criar
              </button>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                O aluno também pode entrar via QR de cadastro. A biometria (rosto/digital) é cadastrada depois, clicando no nome do aluno.
              </p>
            </form>
          </aside>

          <section className="space-y-3">
              {students?.length ? (
                students.map((s) => {
                  const m = membershipByStudent.get(s.id) ?? null;
                  const p = m?.plan_id ? planById.get(m.plan_id) ?? null : null;
                  const overdue = isOverdue(m?.next_due_at);
                  const photoUrl = faceImageByStudent.get(s.id) ?? null;
                  const hasFace = hasFaceByStudent.has(s.id);
                  const hasFingerprint = hasFingerprintByStudent.has(s.id);

                  return (
                    <details
                      key={s.id}
                      className={`group rounded-2xl border bg-white/70 shadow-sm backdrop-blur dark:bg-zinc-900/60 ${
                        overdue
                          ? "border-red-200 dark:border-red-900/60"
                          : "border-zinc-200 dark:border-zinc-800"
                      }`}
                    >
                      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
                        <div className="flex min-w-0 items-center gap-3">
                          {photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photoUrl}
                              alt={s.name}
                              className="h-10 w-10 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                              {initials(s.name)}
                            </span>
                          )}
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                              {s.name}
                              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{` • ${s.login}`}</span>
                            </h3>
                            <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                              {p ? `Plano: ${p.name} (${formatBrlCents(Number(p.price_cents ?? 0))})` : "Sem plano"}
                              {m?.next_due_at ? ` • Vence: ${m.next_due_at}` : ""}
                              {lastCheckinByStudent.get(s.id) ? ` • Último check-in: ${lastCheckinByStudent.get(s.id)}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {hasFace ? (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800 dark:bg-violet-900 dark:text-violet-200">
                              Rosto
                            </span>
                          ) : null}
                          {hasFingerprint ? (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800 dark:bg-violet-900 dark:text-violet-200">
                              Digital
                            </span>
                          ) : null}
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-medium ${
                              overdue
                                ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                            }`}
                          >
                            {overdue ? "Vencido" : "Em dia"}
                          </span>
                          <span className="text-xs text-zinc-400 transition group-open:rotate-180">▾</span>
                        </div>
                      </summary>

                      <div className="border-t border-zinc-200 p-5 dark:border-zinc-800">
                        <form action={updateGymStudentProfile} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                          <input type="hidden" name="return_to" value="/dashboard/modulos/academia_alunos" />
                          <input type="hidden" name="student_id" value={s.id} />
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Informações pessoais</p>
                          <div className="mt-2 grid gap-2 sm:grid-cols-3">
                            <input
                              name="name"
                              required
                              minLength={2}
                              defaultValue={s.name}
                              placeholder="Nome completo"
                              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                            />
                            <input
                              name="phone"
                              defaultValue={s.phone ?? ""}
                              placeholder="Telefone"
                              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                            />
                            <input
                              name="address"
                              defaultValue={s.address ?? ""}
                              placeholder="Endereço"
                              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                            />
                          </div>
                          <button
                            type="submit"
                            className="mt-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                          >
                            Salvar informações
                          </button>
                        </form>

                    {m ? (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <form action={resetGymStudentPassword} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                          <input type="hidden" name="return_to" value="/dashboard/modulos/academia_alunos" />
                          <input type="hidden" name="student_id" value={s.id} />
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Senha</p>
                          <input
                            name="password"
                            type="password"
                            required
                            minLength={1}
                            placeholder="Nova senha"
                            className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                          />
                          <button
                            type="submit"
                            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                          >
                            Redefinir senha
                          </button>
                          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                            Isso desconecta sessões ativas do aluno.
                          </p>
                        </form>

                        <form action={recordGymPayment} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                          <input type="hidden" name="return_to" value="/dashboard/modulos/academia_alunos" />
                          <input type="hidden" name="membership_id" value={m.id} />
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Pagamento</p>
                          <input
                            name="note"
                            placeholder="Observação (opcional)"
                            className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                          />
                          <button
                            type="submit"
                            className="mt-2 w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                          >
                            Marcar como pago (avançar 1 período)
                          </button>
                        </form>

                        <form action={setGymMembershipDueDate} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                          <input type="hidden" name="return_to" value="/dashboard/modulos/academia_alunos" />
                          <input type="hidden" name="membership_id" value={m.id} />
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Vencimento</p>
                          <input
                            name="next_due_at"
                            type="date"
                            defaultValue={m.next_due_at ?? ""}
                            className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                          />
                          <button
                            type="submit"
                            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                          >
                            Atualizar vencimento
                          </button>
                        </form>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
                        Sem mensalidade associada ainda.
                      </p>
                    )}

                    <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/80 p-4 dark:border-violet-900/60 dark:bg-violet-950/30">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Biometria e foto (opcional)</h4>
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800 dark:bg-violet-900 dark:text-violet-200">
                          acesso profissional
                        </span>
                      </div>

                      <div className="grid gap-3 xl:grid-cols-2">
                        <form action={registerGymFaceProfile} encType="multipart/form-data" className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                          <input type="hidden" name="return_to" value="/dashboard/modulos/academia_alunos" />
                          <input type="hidden" name="student_id" value={s.id} />
                          <input type="hidden" name="face_label" value="principal" />
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Rosto (também usado como foto do perfil)</p>
                          <FaceCaptureField />

                          <button type="submit" className="mt-2 w-full rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">
                            Salvar rosto
                          </button>
                        </form>

                        <form action={registerGymFingerprintTemplate} className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                          <input type="hidden" name="return_to" value="/dashboard/modulos/academia_alunos" />
                          <input type="hidden" name="student_id" value={s.id} />
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Digital</p>
                          <input name="finger_name" defaultValue="indicador" placeholder="Dedo" className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
                          <textarea name="template_text" rows={3} placeholder="Template biométrico" className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
                          <input name="device_user_code" placeholder="Código no leitor USB (opcional)" className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
                          <input name="device_name" placeholder="Nome do leitor (opcional)" className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
                          <button type="submit" className="mt-2 w-full rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">
                            Salvar digital
                          </button>
                        </form>
                      </div>
                    </div>
                      </div>
                    </details>
                  );
                })
              ) : (
              <div className="rounded-2xl border border-zinc-200 bg-white/70 p-6 text-sm text-zinc-600 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
                Nenhum aluno cadastrado ainda.
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
