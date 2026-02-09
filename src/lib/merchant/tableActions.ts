"use server";

import { redirect } from "next/navigation";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";

async function requireTablesAccess() {
  const { supabase, user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const ok =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_products")
          ? true
          : hasMemberPermission(membership.role, membership.permissions, "dashboard_orders")
      : false);
  if (!ok) {
    redirect("/dashboard");
  }
  return { supabase, merchant };
}

function safeReturnTo(raw: FormDataEntryValue | null): string {
  const v = typeof raw === "string" ? raw : "";
  if (v === "/dashboard/modulos/mesas" || v === "/dashboard/modulos/produtos") return v;
  return "/dashboard/modulos/produtos";
}

function parsePositiveInt(input: FormDataEntryValue | null, fallback: number): number {
  const n = Number(typeof input === "string" ? input : "");
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(99, Math.trunc(n));
}

function makeQrToken(): string {
  // Short, URL-safe token.
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

type ServiceKind = "mesa" | "balcao" | "fila" | "atendimento_rapido" | "outro";

function normalizeServiceKind(raw: FormDataEntryValue | null): ServiceKind {
  const v = typeof raw === "string" ? raw : "";
  if (v === "balcao" || v === "fila" || v === "atendimento_rapido" || v === "outro") return v;
  return "mesa";
}

function kindLabel(kind: ServiceKind): string {
  switch (kind) {
    case "mesa":
      return "Mesa";
    case "balcao":
      return "Balcão";
    case "fila":
      return "Fila";
    case "atendimento_rapido":
      return "Atendimento rápido";
    case "outro":
      return "Atendimento";
  }
}

function parseSuffixNumber(prefix: string, label: string): number | null {
  const p = prefix.trim();
  const s = label.trim();
  if (!p) return null;
  if (!s.toLowerCase().startsWith(p.toLowerCase())) return null;
  const rest = s.slice(p.length).trim();
  if (!rest) return null;
  if (!/^\d+$/.test(rest)) return null;
  const n = Number(rest);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(999, Math.trunc(n));
}

type SupabaseClientLike = Awaited<ReturnType<typeof requireTablesAccess>>["supabase"];

async function nextAutoLabel(
  supabase: SupabaseClientLike,
  merchantId: string,
  prefix: string,
): Promise<string> {
  const { data } = await supabase
    .from("merchant_tables")
    .select("label")
    .eq("merchant_id", merchantId)
    .ilike("label", `${prefix}%`)
    .limit(200);

  const labels = (data ?? []).map((r) => String(r.label ?? "")).filter(Boolean);
  let maxN = 0;
  for (const l of labels) {
    const n = parseSuffixNumber(prefix, l);
    if (n && n > maxN) maxN = n;
  }
  const next = Math.min(999, Math.max(1, maxN + 1));
  return `${prefix} ${next}`;
}

export async function createMerchantTable(formData: FormData): Promise<void> {
  const label = (formData.get("label") as string | null)?.trim() ?? "";
  const kind = normalizeServiceKind(formData.get("kind"));
  const capacity = parsePositiveInt(formData.get("capacity"), 4);
  const returnTo = safeReturnTo(formData.get("return_to"));

  const { supabase, merchant } = await requireTablesAccess();

  const safeLabel = label || (await nextAutoLabel(supabase, merchant.id, kindLabel(kind)));

  // Retry token generation a few times to avoid rare collisions.
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const qrToken = makeQrToken();

    const { error } = await supabase.from("merchant_tables").insert({
      merchant_id: merchant.id,
      label: safeLabel,
      qr_token: qrToken,
      capacity,
      is_active: true,
      display_order: 0,
    });

    if (!error) {
      redirect(`${returnTo}?qr=${encodeURIComponent(qrToken)}`);
    }

    lastError = error.message;
    // If label is duplicated, stop retrying; user needs to change label.
    if (lastError.toLowerCase().includes("merchant_tables_merchant_label_ux")) {
      break;
    }
  }

  redirect(`${returnTo}?error=table_create_failed`);
}

export async function createQuickServiceTable(formData: FormData): Promise<void> {
  const capacity = parsePositiveInt(formData.get("capacity"), 1);
  const returnTo = safeReturnTo(formData.get("return_to"));
  const { supabase, merchant } = await requireTablesAccess();

  let lastError: string | null = null;
  const prefix = kindLabel("atendimento_rapido");
  const safeLabel = await nextAutoLabel(supabase, merchant.id, prefix);

  for (let attempt = 0; attempt < 3; attempt++) {
    const qrToken = makeQrToken();

    const { error } = await supabase.from("merchant_tables").insert({
      merchant_id: merchant.id,
      label: safeLabel,
      qr_token: qrToken,
      capacity,
      status: "available",
      is_active: true,
      display_order: 0,
    });

    if (!error) {
      redirect(`${returnTo}?qr=${encodeURIComponent(qrToken)}`);
    }

    lastError = error.message;
    if (lastError.toLowerCase().includes("merchant_tables_merchant_label_ux")) {
      break;
    }
  }

  redirect(`${returnTo}?error=table_create_failed`);
}

export async function cancelMerchantTable(formData: FormData): Promise<void> {
  const tableId = (formData.get("table_id") as string | null)?.trim() ?? "";
  const returnTo = safeReturnTo(formData.get("return_to"));
  if (!tableId) {
    redirect(`${returnTo}?error=invalid_table`);
  }

  const { supabase, merchant } = await requireTablesAccess();
  const { error } = await supabase
    .from("merchant_tables")
    .update({ is_active: false, status: "inactive" })
    .eq("merchant_id", merchant.id)
    .eq("id", tableId);

  if (error) {
    redirect(`${returnTo}?error=table_cancel_failed`);
  }

  redirect(returnTo);
}

export async function ensureDemoTable(formData: FormData): Promise<void> {
  const labelRaw = (formData.get("label") as string | null)?.trim() ?? "";
  const capacity = parsePositiveInt(formData.get("capacity"), 2);
  const returnTo = safeReturnTo(formData.get("return_to"));

  const { supabase, merchant } = await requireTablesAccess();

  const { data: existing } = await supabase
    .from("merchant_tables")
    .select("qr_token")
    .eq("merchant_id", merchant.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing?.qr_token) {
    redirect(`${returnTo}?qr=${encodeURIComponent(existing.qr_token)}`);
  }

  const baseLabel = labelRaw || "Mesa Teste";
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 6; attempt++) {
    const qrToken = makeQrToken();
    const label = attempt === 0 ? baseLabel : `${baseLabel} ${attempt + 1}`;

    const { error } = await supabase.from("merchant_tables").insert({
      merchant_id: merchant.id,
      label,
      qr_token: qrToken,
      capacity,
      is_active: true,
      display_order: 0,
    });

    if (!error) {
      redirect(`${returnTo}?qr=${encodeURIComponent(qrToken)}`);
    }

    lastError = error.message;

    // If it's a token collision, just loop again and generate another.
    if (lastError.toLowerCase().includes("merchant_tables_qr_token_ux")) {
      continue;
    }

    // If label is duplicated, try a new label on next attempt.
    if (lastError.toLowerCase().includes("merchant_tables_merchant_label_ux")) {
      continue;
    }

    break;
  }

  redirect(`${returnTo}?error=demo_table_failed`);
}
