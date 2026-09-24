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

function buildTemplateRows(categoryName: string | null): Array<Record<string, string>> {
  const defaultCategory = categoryName ?? "Categoria exemplo";

  return [
    {
      nome: "Exemplo: Leite integral 1 L",
      descricao: "Apague esta linha e preencha com seus produtos",
      codigo_de_barras: "",
      codigo_interno: "",
      categoria: defaultCategory,
      unidade: "un",
      preco: "19,90",
      custo: "",
      estoque: "0",
      controlar_estoque: "sim",
      ativo: "sim",
      ncm: "",
      cest: "",
      cfop_saida: "",
      origem: "",
      cst_icms: "",
      csosn: "",
      aliquota_icms: "",
      cst_pis: "",
      aliquota_pis: "",
      cst_cofins: "",
      aliquota_cofins: "",
      cst_ipi: "",
      aliquota_ipi: "",
    },
    {
      nome: "Exemplo: Café 500 g",
      descricao: "",
      codigo_de_barras: "",
      codigo_interno: "",
      categoria: defaultCategory,
      unidade: "caixa",
      preco: "",
      custo: "",
      estoque: "0",
      controlar_estoque: "sim",
      ativo: "sim",
      ncm: "",
      cest: "",
      cfop_saida: "",
      origem: "",
      cst_icms: "",
      csosn: "",
      aliquota_icms: "",
      cst_pis: "",
      aliquota_pis: "",
      cst_cofins: "",
      aliquota_cofins: "",
      cst_ipi: "",
      aliquota_ipi: "",
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
        "Content-Disposition": 'attachment; filename="modelo-importacao-estoque-qerbie.csv"',
      },
    });
  }

  const worksheet = XLSX.utils.json_to_sheet(sampleRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Produtos");
  const instructions = XLSX.utils.aoa_to_sheet([
    ["Como importar o estoque no Qerbie"],
    ["1. Apague as linhas de exemplo; mantenha os cabeçalhos na primeira linha."],
    ["2. Preencha ao menos o nome do produto. Os campos fiscais são opcionais."],
    ["3. Use uma linha para cada produto. Preserve códigos de barras como texto para manter zeros à esquerda."],
    ["4. A categoria informada será criada automaticamente se ainda não existir."],
    ["5. Revise a prévia no Qerbie antes de confirmar a importação."],
    ["6. NCM, CEST, CFOP, CST e alíquotas variam conforme produto, regime e operação; confira com a contabilidade."],
    ["O modelo não importa XML nem lança notas fiscais. Esse fluxo será tratado separadamente."],
  ]);
  XLSX.utils.book_append_sheet(workbook, instructions, "Instruções");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="modelo-importacao-estoque-qerbie.xlsx"',
    },
  });
}
