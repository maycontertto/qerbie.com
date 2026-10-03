// Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/catalog/import-catalog.mjs [off|cmed|all]
// Requer a migration 20261002000000_product_catalog.sql aplicada. Idempotente (upsert).
import { createClient } from "@supabase/supabase-js";
import { gunzipSync } from "node:zlib";
import { readFileSync, readdirSync } from "node:fs";

const CMED_DATE = "2026-09-24"; // precos validos a partir de 24/09/2026
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function parseCsv(text) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [h, ...d] = rows;
  return d.filter((r) => r.length === h.length).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}
// dados guardados em data/catalog/<nome>/part-NN.b64 (csv.gz em base64, dividido em partes)
const load = (name) => {
  const dir = `data/catalog/${name}`;
  const b64 = readdirSync(dir).filter((f) => f.endsWith(".b64")).sort().map((f) => readFileSync(`${dir}/${f}`, "utf8")).join("");
  return parseCsv(gunzipSync(Buffer.from(b64, "base64")).toString("utf8"));
};
const num = (v) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));

async function upsert(table, rows, onConflict) {
  const keys = onConflict.split(",");
  rows = [...new Map(rows.map((r) => [keys.map((k) => r[k]).join("|"), r])).values()]; // remove duplicadas pela chave
  for (let i = 0; i < rows.length; i += 1000) {
    const { error } = await sb.from(table).upsert(rows.slice(i, i + 1000), { onConflict });
    if (error) throw new Error(`${table} @${i}: ${error.message}`);
    console.log(table, Math.min(i + 1000, rows.length), "/", rows.length);
  }
}

const what = process.argv[2] || "all";
if (what === "off" || what === "all") {
  const rows = load("off_br").map((r) => ({
    ean: r.ean, name: r.name, brand: r.brand || null, category: r.category || null,
    quantity: r.quantity || null, image_url: r.image_url || null,
    source: "openfoodfacts",
    source_updated_at: r.source_updated_at ? new Date(Number(r.source_updated_at) * 1000).toISOString() : null,
    attribution: "Open Food Facts contributors, ODbL 1.0 (https://world.openfoodfacts.org)",
  }));
  await upsert("product_catalog", rows, "ean");
}
if (what === "cmed" || what === "all") {
  const rows = load("cmed").map((r) => ({
    ean: r.ean, registro: r.registro || "", substancia: r.substancia || null, produto: r.produto,
    apresentacao: r.apresentacao || null, laboratorio: r.laboratorio || null, cnpj: r.cnpj || null,
    classe_terapeutica: r.classe_terapeutica || null, tipo_produto: r.tipo_produto || null,
    regime_preco: r.regime_preco || null, tarja: r.tarja || null,
    pf_sem_impostos: num(r.pf_sem_impostos), pmc_sem_impostos: num(r.pmc_sem_impostos), pmc_18: num(r.pmc_18),
    source: "cmed", source_updated_at: CMED_DATE,
  }));
  await upsert("pharmacy_cmed", rows, "ean,registro");
}
