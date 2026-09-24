import { NextResponse } from "next/server";
import { getDashboardContextForApi } from "../_helpers";

export async function GET() {
  const ctx = await getDashboardContextForApi();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!ctx.canSales) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data: registers, error: registersError } = await ctx.supabase
    .from("cash_register_devices")
    .select("id,name,is_active,created_at")
    .eq("merchant_id", ctx.merchant.id)
    .order("created_at", { ascending: true });
  if (registersError) return NextResponse.json({ error: "registers_unavailable" }, { status: 503 });

  if (!ctx.canManage) return NextResponse.json({ ok: true, registers, members: [], report: [] });

  const { data: members } = await ctx.supabase.from("merchant_members")
      .select("id,user_id,display_name,login,job_title,cash_register_device_id,permissions")
      .eq("merchant_id", ctx.merchant.id)
      .order("created_at", { ascending: true });
  const orders: Array<{ id: string; order_number: number; total: number; created_at: string; cash_register_device_id: string | null; cashier_user_id: string | null; completed_by_user_id: string | null; offline_synced_at: string | null; status: string }> = [];
  for (let start = 0; start < 100000; start += 1000) {
    const { data, error } = await ctx.supabase.from("orders")
      .select("id,order_number,total,created_at,cash_register_device_id,cashier_user_id,completed_by_user_id,offline_synced_at,status")
      .eq("merchant_id", ctx.merchant.id)
      .eq("order_type", "takeaway")
      .not("completed_by_user_id", "is", null)
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .range(start, start + 999);
    if (error) return NextResponse.json({ error: "sales_report_unavailable" }, { status: 503 });
    orders.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const registerById = new Map((registers ?? []).map((register) => [register.id, register.name]));
  const memberById = new Map((members ?? []).map((member) => [member.user_id, member.display_name ?? member.login ?? "Funcionário"]));
  const recentOrderIds = orders.slice(0, 100).map((order) => order.id);
  const { data: recentItems } = recentOrderIds.length
    ? await ctx.supabase.from("order_items").select("order_id,product_name,quantity,line_total").in("order_id", recentOrderIds)
    : { data: [] };
  const itemsByOrder = new Map<string, Array<{ name: string; quantity: number; lineTotal: number }>>();
  for (const item of recentItems ?? []) {
    const rows = itemsByOrder.get(item.order_id) ?? [];
    rows.push({ name: item.product_name, quantity: Number(item.quantity ?? 0), lineTotal: Number(item.line_total ?? 0) });
    itemsByOrder.set(item.order_id, rows);
  }
  const groups = new Map<string, { id: string; name: string; sales: number; count: number }>();
  const cashierGroups = new Map<string, { id: string; name: string; sales: number; count: number }>();
  for (const order of orders) {
    const key = order.cash_register_device_id ?? "unassigned";
    const current = groups.get(key) ?? {
      id: key,
      name: key === "unassigned" ? "Sem caixa identificado" : registerById.get(key) ?? "Caixa removido",
      sales: 0,
      count: 0,
    };
    current.sales += Number(order.total ?? 0);
    current.count += 1;
    groups.set(key, current);

    const cashierKey = order.cashier_user_id ?? order.completed_by_user_id ?? "owner";
    const cashier = cashierGroups.get(cashierKey) ?? {
      id: cashierKey,
      name: cashierKey === "owner" || cashierKey === ctx.merchant.owner_user_id ? "Proprietário / usuário" : memberById.get(cashierKey) ?? "Funcionário removido",
      sales: 0,
      count: 0,
    };
    cashier.sales += Number(order.total ?? 0);
    cashier.count += 1;
    cashierGroups.set(cashierKey, cashier);
  }

  return NextResponse.json({
    ok: true,
    registers,
    members: (members ?? []).map((member) => ({ ...member, permissions: member.permissions })),
    report: Array.from(groups.values()).sort((a, b) => b.sales - a.sales),
    cashierReport: Array.from(cashierGroups.values()).sort((a, b) => b.sales - a.sales),
    recentOrders: orders.slice(0, 100).map((order) => ({
      id: order.id,
      orderNumber: order.order_number,
      total: Number(order.total ?? 0),
      createdAt: order.created_at,
      registerName: order.cash_register_device_id ? registerById.get(order.cash_register_device_id) ?? "Caixa removido" : "Sem caixa identificado",
      cashierName: !order.cashier_user_id && !order.completed_by_user_id || order.cashier_user_id === ctx.merchant.owner_user_id || order.completed_by_user_id === ctx.merchant.owner_user_id
        ? "Proprietário / usuário"
        : memberById.get(order.cashier_user_id ?? order.completed_by_user_id ?? "") ?? "Funcionário removido",
      offlineSynced: Boolean(order.offline_synced_at),
      items: itemsByOrder.get(order.id) ?? [],
    })),
  });
}

export async function POST(req: Request) {
  const ctx = await getDashboardContextForApi();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!ctx.canManage) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const action = String(body.action ?? "");
  if (action === "create") {
    const name = String(body.name ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
    if (name.length < 2) return NextResponse.json({ error: "invalid_name" }, { status: 400 });
    const { data, error } = await ctx.supabase.from("cash_register_devices")
      .insert({ merchant_id: ctx.merchant.id, name, created_by_user_id: ctx.user.id })
      .select("id,name,is_active,created_at").maybeSingle();
    if (error) return NextResponse.json({ error: "register_create_failed", detail: error.message }, { status: 409 });
    return NextResponse.json({ ok: true, register: data });
  }

  if (action === "toggle") {
    const registerId = String(body.registerId ?? "");
    const active = body.active === true;
    const { data, error } = await ctx.supabase.from("cash_register_devices")
      .update({ is_active: active, updated_at: new Date().toISOString() })
      .eq("merchant_id", ctx.merchant.id).eq("id", registerId)
      .select("id,name,is_active,created_at").maybeSingle();
    if (error || !data) return NextResponse.json({ error: "register_update_failed" }, { status: 409 });
    return NextResponse.json({ ok: true, register: data });
  }

  if (action === "assign") {
    const memberId = String(body.memberId ?? "");
    const registerId = String(body.registerId ?? "") || null;
    if (registerId) {
      const { data: register } = await ctx.supabase.from("cash_register_devices")
        .select("id").eq("merchant_id", ctx.merchant.id).eq("id", registerId).eq("is_active", true).maybeSingle();
      if (!register) return NextResponse.json({ error: "register_not_found" }, { status: 404 });
    }
    const { data: member, error: memberError } = await ctx.supabase.from("merchant_members")
      .select("id,job_title,permissions").eq("merchant_id", ctx.merchant.id).eq("id", memberId).maybeSingle();
    if (memberError || !member) return NextResponse.json({ error: "member_not_found" }, { status: 404 });
    const permissions = member.permissions && typeof member.permissions === "object" && !Array.isArray(member.permissions)
      ? { ...(member.permissions as Record<string, boolean>), dashboard_sales: Boolean(registerId) }
      : { dashboard_sales: Boolean(registerId) };
    const { error } = await ctx.supabase.from("merchant_members").update({
      cash_register_device_id: registerId,
      job_title: registerId ? "Caixa" : member.job_title,
      permissions,
    }).eq("merchant_id", ctx.merchant.id).eq("id", memberId);
    if (error) return NextResponse.json({ error: "assignment_failed", detail: error.message }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
