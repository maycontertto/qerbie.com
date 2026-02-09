"use server";

import { redirect } from "next/navigation";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import type {
  HotelReservationStatus,
  HousekeepingTaskStatus,
} from "@/lib/supabase/database.types";

function moneyToNumber(raw: FormDataEntryValue | null): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const normalized = s.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function clampInt(raw: FormDataEntryValue | null, min: number, max: number): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = Math.trunc(Number(s));
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}

async function requireHotelCatalogPermission() {
  const { supabase, user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const canCatalog =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_products")
      : false);
  if (!canCatalog) redirect("/dashboard");
  return { supabase, merchant };
}

async function requireHotelOpsPermission() {
  const { supabase, user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const canOps =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_orders")
      : false);
  if (!canOps) redirect("/dashboard");
  return { supabase, merchant };
}

// ── Quartos (tipos) ─────────────────────────────────────────

export async function createHotelRoomType(formData: FormData): Promise<void> {
  const { supabase, merchant } = await requireHotelCatalogPermission();
  const name = String(formData.get("name") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const description = descriptionRaw ? descriptionRaw.slice(0, 500) : null;
  const capacity = clampInt(formData.get("capacity"), 1, 20) ?? 1;
  const basePrice = moneyToNumber(formData.get("base_price")) ?? 0;

  if (!name || name.length < 2) redirect("/dashboard/modulos/quartos?error=invalid");

  const { error } = await supabase.from("merchant_hotel_room_types").insert({
    merchant_id: merchant.id,
    name: name.slice(0, 120),
    description,
    capacity,
    base_price: basePrice,
    is_active: true,
  });

  if (error) {
    console.error("createHotelRoomType failed", { code: error.code, message: error.message });
    redirect("/dashboard/modulos/quartos?error=save_failed");
  }
  redirect("/dashboard/modulos/quartos?saved=1");
}

export async function updateHotelRoomType(formData: FormData): Promise<void> {
  const { supabase, merchant } = await requireHotelCatalogPermission();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const description = descriptionRaw ? descriptionRaw.slice(0, 500) : null;
  const capacity = clampInt(formData.get("capacity"), 1, 20);
  const basePrice = moneyToNumber(formData.get("base_price"));
  const isActive = formData.get("is_active") === "on";

  if (!id) redirect("/dashboard/modulos/quartos?error=invalid");

  const update: {
    name?: string;
    description?: string | null;
    capacity?: number;
    base_price?: number;
    is_active?: boolean;
  } = { is_active: isActive };

  if (name) update.name = name.slice(0, 120);
  update.description = description;
  if (capacity != null) update.capacity = capacity;
  if (basePrice != null) update.base_price = basePrice;

  const { error } = await supabase
    .from("merchant_hotel_room_types")
    .update(update)
    .eq("merchant_id", merchant.id)
    .eq("id", id);

  if (error) {
    console.error("updateHotelRoomType failed", { code: error.code, message: error.message });
    redirect("/dashboard/modulos/quartos?error=save_failed");
  }
  redirect("/dashboard/modulos/quartos?saved=1");
}

// ── Planos ──────────────────────────────────────────────────

export async function createHotelRatePlan(formData: FormData): Promise<void> {
  const { supabase, merchant } = await requireHotelCatalogPermission();
  const name = String(formData.get("name") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const description = descriptionRaw ? descriptionRaw.slice(0, 500) : null;
  const includesBreakfast = formData.get("includes_breakfast") === "on";
  const nightlyPrice = moneyToNumber(formData.get("nightly_price")) ?? 0;

  if (!name || name.length < 2) redirect("/dashboard/modulos/planos?error=invalid");

  const { error } = await supabase.from("merchant_hotel_rate_plans").insert({
    merchant_id: merchant.id,
    name: name.slice(0, 120),
    description,
    includes_breakfast: includesBreakfast,
    nightly_price: nightlyPrice,
    is_active: true,
  });

  if (error) {
    console.error("createHotelRatePlan failed", { code: error.code, message: error.message });
    redirect("/dashboard/modulos/planos?error=save_failed");
  }
  redirect("/dashboard/modulos/planos?saved=1");
}

export async function updateHotelRatePlan(formData: FormData): Promise<void> {
  const { supabase, merchant } = await requireHotelCatalogPermission();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const description = descriptionRaw ? descriptionRaw.slice(0, 500) : null;
  const includesBreakfast = formData.get("includes_breakfast") === "on";
  const nightlyPrice = moneyToNumber(formData.get("nightly_price"));
  const isActive = formData.get("is_active") === "on";

  if (!id) redirect("/dashboard/modulos/planos?error=invalid");

  const update: {
    name?: string;
    description?: string | null;
    includes_breakfast?: boolean;
    nightly_price?: number;
    is_active?: boolean;
  } = { includes_breakfast: includesBreakfast, is_active: isActive };

  if (name) update.name = name.slice(0, 120);
  update.description = description;
  if (nightlyPrice != null) update.nightly_price = nightlyPrice;

  const { error } = await supabase
    .from("merchant_hotel_rate_plans")
    .update(update)
    .eq("merchant_id", merchant.id)
    .eq("id", id);

  if (error) {
    console.error("updateHotelRatePlan failed", { code: error.code, message: error.message });
    redirect("/dashboard/modulos/planos?error=save_failed");
  }
  redirect("/dashboard/modulos/planos?saved=1");
}

// ── Serviços ────────────────────────────────────────────────

export async function createHotelService(formData: FormData): Promise<void> {
  const { supabase, merchant } = await requireHotelCatalogPermission();
  const name = String(formData.get("name") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const description = descriptionRaw ? descriptionRaw.slice(0, 500) : null;
  const price = moneyToNumber(formData.get("price"));

  if (!name || name.length < 2) redirect("/dashboard/modulos/hotel_servicos?error=invalid");

  const { error } = await supabase.from("merchant_hotel_services").insert({
    merchant_id: merchant.id,
    name: name.slice(0, 120),
    description,
    price,
    is_active: true,
  });

  if (error) {
    console.error("createHotelService failed", { code: error.code, message: error.message });
    redirect("/dashboard/modulos/hotel_servicos?error=save_failed");
  }
  redirect("/dashboard/modulos/hotel_servicos?saved=1");
}

export async function updateHotelService(formData: FormData): Promise<void> {
  const { supabase, merchant } = await requireHotelCatalogPermission();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const description = descriptionRaw ? descriptionRaw.slice(0, 500) : null;
  const price = moneyToNumber(formData.get("price"));
  const isActive = formData.get("is_active") === "on";

  if (!id) redirect("/dashboard/modulos/hotel_servicos?error=invalid");

  const update: { name?: string; description?: string | null; price?: number | null; is_active?: boolean } = {
    is_active: isActive,
  };
  if (name) update.name = name.slice(0, 120);
  update.description = description;
  if (price != null) update.price = price;

  const { error } = await supabase
    .from("merchant_hotel_services")
    .update(update)
    .eq("merchant_id", merchant.id)
    .eq("id", id);

  if (error) {
    console.error("updateHotelService failed", { code: error.code, message: error.message });
    redirect("/dashboard/modulos/hotel_servicos?error=save_failed");
  }
  redirect("/dashboard/modulos/hotel_servicos?saved=1");
}

// ── Hóspedes ────────────────────────────────────────────────

export async function createHotelGuest(formData: FormData): Promise<void> {
  const { supabase, merchant } = await requireHotelOpsPermission();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();

  if (!fullName || fullName.length < 2) redirect("/dashboard/modulos/hospedes?error=invalid");

  const { error } = await supabase.from("merchant_hotel_guests").insert({
    merchant_id: merchant.id,
    full_name: fullName.slice(0, 160),
    phone: phoneRaw ? phoneRaw.slice(0, 40) : null,
    email: emailRaw ? emailRaw.slice(0, 160) : null,
    notes: notesRaw ? notesRaw.slice(0, 1000) : null,
    is_active: true,
  });

  if (error) {
    console.error("createHotelGuest failed", { code: error.code, message: error.message });
    redirect("/dashboard/modulos/hospedes?error=save_failed");
  }
  redirect("/dashboard/modulos/hospedes?saved=1");
}

export async function updateHotelGuest(formData: FormData): Promise<void> {
  const { supabase, merchant } = await requireHotelOpsPermission();
  const id = String(formData.get("id") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();
  const isActive = formData.get("is_active") === "on";

  if (!id) redirect("/dashboard/modulos/hospedes?error=invalid");

  const update: {
    full_name?: string;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
    is_active?: boolean;
  } = {
    is_active: isActive,
    phone: phoneRaw ? phoneRaw.slice(0, 40) : null,
    email: emailRaw ? emailRaw.slice(0, 160) : null,
    notes: notesRaw ? notesRaw.slice(0, 1000) : null,
  };
  if (fullName) update.full_name = fullName.slice(0, 160);

  const { error } = await supabase
    .from("merchant_hotel_guests")
    .update(update)
    .eq("merchant_id", merchant.id)
    .eq("id", id);

  if (error) {
    console.error("updateHotelGuest failed", { code: error.code, message: error.message });
    redirect("/dashboard/modulos/hospedes?error=save_failed");
  }
  redirect("/dashboard/modulos/hospedes?saved=1");
}

// ── Reservas ────────────────────────────────────────────────

export async function createHotelReservation(formData: FormData): Promise<void> {
  const { supabase, merchant } = await requireHotelOpsPermission();
  const guestId = String(formData.get("guest_id") ?? "").trim();
  const roomTypeId = String(formData.get("room_type_id") ?? "").trim();
  const ratePlanIdRaw = String(formData.get("rate_plan_id") ?? "").trim();
  const ratePlanId = ratePlanIdRaw ? ratePlanIdRaw : null;
  const checkIn = String(formData.get("check_in_date") ?? "").trim();
  const checkOut = String(formData.get("check_out_date") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();

  if (!guestId || !roomTypeId || !checkIn || !checkOut) {
    redirect("/dashboard/modulos/reservas?error=invalid");
  }

  const { error } = await supabase.from("merchant_hotel_reservations").insert({
    merchant_id: merchant.id,
    guest_id: guestId,
    room_type_id: roomTypeId,
    rate_plan_id: ratePlanId,
    check_in_date: checkIn,
    check_out_date: checkOut,
    status: "pending",
    notes: notesRaw ? notesRaw.slice(0, 1000) : null,
  });

  if (error) {
    console.error("createHotelReservation failed", { code: error.code, message: error.message });
    redirect("/dashboard/modulos/reservas?error=save_failed");
  }
  redirect("/dashboard/modulos/reservas?saved=1");
}

export async function updateHotelReservationStatus(formData: FormData): Promise<void> {
  const { supabase, merchant } = await requireHotelOpsPermission();
  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim() as HotelReservationStatus;

  const allowed: HotelReservationStatus[] = [
    "pending",
    "confirmed",
    "checked_in",
    "checked_out",
    "cancelled",
  ];
  if (!id || !allowed.includes(status)) {
    redirect("/dashboard/modulos/reservas?error=invalid");
  }

  const { error } = await supabase
    .from("merchant_hotel_reservations")
    .update({ status })
    .eq("merchant_id", merchant.id)
    .eq("id", id);

  if (error) {
    console.error("updateHotelReservationStatus failed", { code: error.code, message: error.message });
    redirect("/dashboard/modulos/reservas?error=save_failed");
  }
  redirect("/dashboard/modulos/reservas?saved=1");
}

// ── Housekeeping ────────────────────────────────────────────

export async function createHousekeepingTask(formData: FormData): Promise<void> {
  const { supabase, merchant } = await requireHotelOpsPermission();
  const title = String(formData.get("title") ?? "").trim();
  const reservationIdRaw = String(formData.get("reservation_id") ?? "").trim();
  const reservationId = reservationIdRaw ? reservationIdRaw : null;
  const dueDateRaw = String(formData.get("due_date") ?? "").trim();
  const dueDate = dueDateRaw ? dueDateRaw : null;
  const notesRaw = String(formData.get("notes") ?? "").trim();

  if (!title || title.length < 2) redirect("/dashboard/modulos/housekeeping?error=invalid");

  const { error } = await supabase.from("merchant_hotel_housekeeping_tasks").insert({
    merchant_id: merchant.id,
    reservation_id: reservationId,
    title: title.slice(0, 160),
    due_date: dueDate,
    status: "open",
    notes: notesRaw ? notesRaw.slice(0, 1000) : null,
  });

  if (error) {
    console.error("createHousekeepingTask failed", { code: error.code, message: error.message });
    redirect("/dashboard/modulos/housekeeping?error=save_failed");
  }
  redirect("/dashboard/modulos/housekeeping?saved=1");
}

export async function updateHousekeepingTaskStatus(formData: FormData): Promise<void> {
  const { supabase, merchant } = await requireHotelOpsPermission();
  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim() as HousekeepingTaskStatus;

  const allowed: HousekeepingTaskStatus[] = ["open", "in_progress", "done", "cancelled"];
  if (!id || !allowed.includes(status)) redirect("/dashboard/modulos/housekeeping?error=invalid");

  const { error } = await supabase
    .from("merchant_hotel_housekeeping_tasks")
    .update({ status })
    .eq("merchant_id", merchant.id)
    .eq("id", id);

  if (error) {
    console.error("updateHousekeepingTaskStatus failed", { code: error.code, message: error.message });
    redirect("/dashboard/modulos/housekeeping?error=save_failed");
  }
  redirect("/dashboard/modulos/housekeeping?saved=1");
}
