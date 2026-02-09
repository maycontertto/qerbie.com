import Link from "next/link";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  createHotelReservation,
  updateHotelReservationStatus,
} from "@/lib/merchant/hotelActions";
import type { HotelReservationStatus } from "@/lib/supabase/database.types";

function statusLabel(s: HotelReservationStatus): string {
  switch (s) {
    case "pending":
      return "Pendente";
    case "confirmed":
      return "Confirmada";
    case "checked_in":
      return "Check-in";
    case "checked_out":
      return "Check-out";
    case "cancelled":
      return "Cancelada";
  }
}

export default async function ReservasModulePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const canOps =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_orders")
      : false);

  if (!canOps) {
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
            <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Reservas</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Você não tem permissão para acessar este módulo.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const supabase = await createClient();

  const [{ data: guests }, { data: roomTypes }, { data: plans }, { data: reservations }] =
    await Promise.all([
      supabase
        .from("merchant_hotel_guests")
        .select("id, full_name, is_active")
        .eq("merchant_id", merchant.id)
        .eq("is_active", true)
        .order("full_name", { ascending: true }),
      supabase
        .from("merchant_hotel_room_types")
        .select("id, name, is_active")
        .eq("merchant_id", merchant.id)
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase
        .from("merchant_hotel_rate_plans")
        .select("id, name, is_active")
        .eq("merchant_id", merchant.id)
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase
        .from("merchant_hotel_reservations")
        .select(
          "id, check_in_date, check_out_date, status, notes, guest_id, room_type_id, rate_plan_id, created_at",
        )
        .eq("merchant_id", merchant.id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  const guestNameById = new Map<string, string>();
  for (const g of guests ?? []) guestNameById.set(g.id, g.full_name);
  const roomNameById = new Map<string, string>();
  for (const r of roomTypes ?? []) roomNameById.set(r.id, r.name);
  const planNameById = new Map<string, string>();
  for (const p of plans ?? []) planNameById.set(p.id, p.name);

  const banner =
    saved === "1"
      ? { kind: "success" as const, message: "Salvo." }
      : error === "invalid"
        ? { kind: "error" as const, message: "Dados inválidos." }
        : error === "save_failed"
          ? { kind: "error" as const, message: "Não foi possível salvar agora. Tente novamente." }
          : null;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
            >
              ← Voltar ao painel
            </Link>
            <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Reservas</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Crie reservas e atualize status (check-in/out).
            </p>
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Dica: cadastre primeiro <Link className="underline" href="/dashboard/modulos/hospedes">Hóspedes</Link> e <Link className="underline" href="/dashboard/modulos/quartos">Quartos</Link>.
          </div>
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

        <div className="mt-8 grid gap-6 lg:grid-cols-[420px_1fr]">
          <aside className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Nova reserva</h2>
            <form action={createHotelReservation} className="mt-4 space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Hóspede
              </label>
              <select
                name="guest_id"
                required
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              >
                <option value="">Selecione</option>
                {(guests ?? []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.full_name}
                  </option>
                ))}
              </select>

              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Tipo de quarto
              </label>
              <select
                name="room_type_id"
                required
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              >
                <option value="">Selecione</option>
                {(roomTypes ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>

              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Plano (opcional)
              </label>
              <select
                name="rate_plan_id"
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              >
                <option value="">Sem plano</option>
                {(plans ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Check-in
                  </label>
                  <input
                    type="date"
                    name="check_in_date"
                    required
                    className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Check-out
                  </label>
                  <input
                    type="date"
                    name="check_out_date"
                    required
                    className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
              </div>

              <textarea
                name="notes"
                rows={3}
                placeholder="Observações (opcional)"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />

              <button
                type="submit"
                className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Criar
              </button>
            </form>
          </aside>

          <section className="space-y-3">
            {reservations?.length ? (
              reservations.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-zinc-200 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {guestNameById.get(r.guest_id) ?? "Hóspede"} • {roomNameById.get(r.room_type_id) ?? "Quarto"}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {r.check_in_date} → {r.check_out_date}
                        {r.rate_plan_id ? ` • ${planNameById.get(r.rate_plan_id) ?? "Plano"}` : ""}
                      </p>
                      {r.notes ? (
                        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{r.notes}</p>
                      ) : null}
                    </div>
                    <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                      {statusLabel(r.status as HotelReservationStatus)}
                    </span>
                  </div>

                  <form action={updateHotelReservationStatus} className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <input type="hidden" name="id" value={r.id} />
                    <select
                      name="status"
                      defaultValue={String(r.status)}
                      className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                    >
                      <option value="pending">Pendente</option>
                      <option value="confirmed">Confirmada</option>
                      <option value="checked_in">Check-in</option>
                      <option value="checked_out">Check-out</option>
                      <option value="cancelled">Cancelada</option>
                    </select>
                    <button
                      type="submit"
                      className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                      Atualizar status
                    </button>
                  </form>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                Nenhuma reserva cadastrada ainda.
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
