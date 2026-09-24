"use client";

import { useRef, useState } from "react";
import { createQuickProduct } from "@/lib/catalog/actions";
import { BarcodeScannerField } from "./BarcodeScannerField";
import { CategorySelect } from "./CategorySelect";

type Category = { id: string; name: string };
type LookupProduct = { name: string; brand: string | null; quantity: string | null; category: string | null; imageUrl: string | null; source: string };

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export function QuickProductForm({
  menuId,
  returnTo,
  categories,
  defaultCategoryId,
  isOwner,
}: {
  menuId: string;
  returnTo: string;
  categories: Category[];
  defaultCategoryId: string;
  isOwner: boolean;
}) {
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState("");
  const [unitLabel, setUnitLabel] = useState("un");
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "found" | "not_found" | "error">("idle");
  const [lookupDetails, setLookupDetails] = useState<LookupProduct | null>(null);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookupSequence = useRef(0);

  function lookupProduct(code: string) {
    const normalizedCode = code.trim();
    const sequence = ++lookupSequence.current;
    setBarcode(normalizedCode);
    setLookupDetails(null);
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    if (!/^\d{8,14}$/.test(normalizedCode)) {
      setLookupState("idle");
      return;
    }

    lookupTimer.current = setTimeout(async () => {
      setLookupState("loading");
      try {
        const response = await fetch(`/api/dashboard/catalog/barcode?code=${encodeURIComponent(normalizedCode)}`);
        if (sequence !== lookupSequence.current) return;
        if (response.status === 404) {
          setLookupState("not_found");
          return;
        }
        if (!response.ok) throw new Error("lookup_failed");
        const product = await response.json() as LookupProduct;
        if (sequence !== lookupSequence.current) return;
        setName(product.name);
        setLookupDetails(product);
        if (product.category) {
          const matchedCategory = categories.find((category) => {
            const a = normalize(category.name);
            const b = normalize(product.category ?? "");
            return a === b || a.includes(b) || b.includes(a);
          });
          if (matchedCategory) setCategoryId(matchedCategory.id);
        }
        setLookupState("found");
      } catch {
        if (sequence === lookupSequence.current) setLookupState("error");
      }
    }, 400);
  }

  const inputClass = "mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800";

  return (
    <form action={createQuickProduct} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <input type="hidden" name="menu_id" value={menuId} />
      <input type="hidden" name="redirect_to" value="/dashboard/modulos/produtos" />
      <input type="hidden" name="return_to" value={returnTo} />

      <div className="sm:col-span-2 xl:col-span-2">
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Nome do item</label>
        <input name="name" type="text" required minLength={2} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Leite integral 1 L" className={inputClass} />
      </div>

      <BarcodeScannerField
        name="barcode"
        label="Código de barras"
        placeholder="Leia ou digite o código"
        value={barcode}
        onValueChange={lookupProduct}
        helperText="Ao ler o código, buscamos os dados do produto automaticamente."
      />
      <div className="sm:col-span-2 xl:col-span-4" aria-live="polite">
        {lookupState === "loading" ? <p className="text-xs text-zinc-600 dark:text-zinc-300">Buscando produto pelo código de barras…</p> : null}
        {lookupState === "not_found" ? <p className="text-xs text-amber-800 dark:text-amber-200">Produto não encontrado na base. Você pode preencher o cadastro manualmente.</p> : null}
        {lookupState === "error" ? <p className="text-xs text-amber-800 dark:text-amber-200">Não foi possível consultar a base agora. Você ainda pode cadastrar o produto manualmente.</p> : null}
        {lookupState === "found" && lookupDetails ? (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
            {lookupDetails.imageUrl ? <img src={lookupDetails.imageUrl} alt="" className="h-12 w-12 rounded-md bg-white object-contain" /> : null}
            <p>Dados encontrados em <a href="https://world.openfoodfacts.org/" target="_blank" rel="noreferrer" className="underline">{lookupDetails.source}</a>{lookupDetails.brand ? ` · ${lookupDetails.brand}` : ""}{lookupDetails.quantity ? ` · ${lookupDetails.quantity}` : ""}. Confira o nome e complete preço e estoque.</p>
          </div>
        ) : null}
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Código interno</label>
        <input name="internal_code" type="text" placeholder="Opcional" className={inputClass} />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Categoria</label>
        <div className="mt-1"><CategorySelect name="category_id" categories={categories} value={categoryId} onValueChange={setCategoryId} /></div>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Unidade</label>
        <select name="unit_label" value={unitLabel} onChange={(event) => setUnitLabel(event.target.value)} className={inputClass}>
          <option value="un">Unidade</option><option value="kg">Kg</option><option value="g">g</option><option value="m">Metro (m)</option><option value="m2">Metro² (m²)</option><option value="m3">Metro³ (m³)</option><option value="l">Litro (L)</option><option value="saco">Saco</option><option value="caixa">Caixa</option><option value="pacote">Pacote</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Preço de venda</label>
        <input name="price" type="text" placeholder="Ex: 19,90" className={inputClass} />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Custo atual</label>
        <input name="cost_price" type="text" placeholder="Ex: 12,40" className={inputClass} />
      </div>
      {isOwner ? <>
        <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"><input name="track_stock" type="checkbox" defaultChecked className="h-4 w-4" />Controlar estoque</label>
        <div><label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Estoque inicial</label><input name="stock_quantity" type="number" inputMode="decimal" min={0} placeholder="Ex: 20" className={inputClass} /></div>
      </> : null}
      <div className="sm:col-span-2 xl:col-span-4 flex justify-end">
        <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400">Criar item rápido</button>
      </div>
    </form>
  );
}
