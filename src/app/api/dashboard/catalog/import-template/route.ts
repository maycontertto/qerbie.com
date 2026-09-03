import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { hasMemberPermission } from "@/lib/auth/guard";

async function getProductsContext() {
  const supabase = await createClient({}, { withAuth: true });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: ownedMerchant } = await supabase
    .from("merchants")
    .select("id, owner_user_id")
    .eq("owner_user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (ownedMerchant) {
    return { supabase, merchantId: ownedMerchant.id };
  }

  const { data: membership } = await supabase
    .from("merchant_members")
    .select("merchant_id, role, permissions")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const merchantId = membership?.merchant_id ?? "";
  if (!merchantId || !membership) return null;

  const canDashboard = hasMemberPermission(membership.role, membership.permissions, "dashboard_access");
  const canProducts = hasMemberPermission(membership.role, membership.permissions, "dashboard_products");
  if (!canDashboard || !canProducts) return null;

  return { supabase, merchantId };
}

function buildTemplateRows(categoryName: string | null) {
  const defaultCategory = categoryName ?? "Categoria exemplo";

  return [
    {
      nome: "Produto exemplo 1",
      codigo_de_barras: "7890000000011",
      codigo_interno: "SKU-001",
      categoria: defaultCategory,
      unidade: "un",
      preco: "19,90",
      custo: "12,40",
      estoque: "20",
      controlar_estoque: "sim",
      ativo: "sim",
    },
    {
      nome: "Produto exemplo 2",
      codigo_de_barras: "",
      codigo_interno: "SKU-002",
      categoria: defaultCategory,
      unidade: "caixa",
      preco: "42,00",
      custo: "31,50",
      estoque: "8",
      controlar_estoque: "sim",
      ativo: "sim",
    },
  ];
}

function toCsv(rows: Array<Record<string, string>>): string {
  const headers = Object.keys(rows[0] ?? {});
  const escapeCell = (value: string) => {
    const raw = String(value ?? "");
    if (/[";,\n]/.test(raw)) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  };

  return [
    headers.join(";"),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header] ?? "")).join(";")),
  ].join("\n");
}

export async function GET(req: Request) {
  const ctx = await getProductsContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") ?? "xlsx").trim().toLowerCase();

  const { data: categories } = await ctx.supabase
    .from("menu_categories")
    .select("name")
    .eq("merchant_id", ctx.merchantId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1);

  const sampleRows = buildTemplateRows(categories?.[0]?.name ?? null);

  if (format === "csv") {
    const csv = toCsv(sampleRows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="modelo-importacao-produtos.csv"',
      },
    });
  }

  const worksheet = XLSX.utils.json_to_sheet(sampleRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Produtos");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-importacao-produtos.xlsx"',
    },
  });
}
