"use client";

import { useEffect, useMemo, useState } from "react";
import { useCustomerLanguage } from "@/app/t/CustomerLanguagePicker";
import { tCustomer } from "@/lib/customer/i18n";

type Menu = {
  id: string;
  name: string;
  description: string | null;
};

type Category = {
  id: string;
  name: string;
  description: string | null;
};

type Product = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number | null;
  image_url: string | null;
  is_featured: boolean;
  requires_prescription: boolean;
  requires_document: boolean;
};

type CartItem = {
  productId: string;
  name: string;
  price: number;
  imageUrl: string | null;
  quantity: number;
  requiresPrescription: boolean;
  requiresDocument: boolean;
};

type DeliverySettings = {
  enabled: boolean;
  fee: number | null;
  note: string | null;
  etaMinutes: number | null;
};

type PaymentSettings = {
  pixKey: string | null;
  pixDescription: string | null;
  cardUrl: string | null;
  cardDescription: string | null;
  cashDescription: string | null;
  disclaimer: string | null;
};

function formatBRL(value: number, lang: string): string {
  const locale = lang === "en" ? "en-US" : lang === "es" ? "es-ES" : "pt-BR";
  return new Intl.NumberFormat(locale, { style: "currency", currency: "BRL" }).format(value);
}

function cartStorageKey(qrToken: string, menuId: string): string {
  return `qerbie_cart:${qrToken}:${menuId}`;
}

function safeParseCart(raw: string | null): { items: CartItem[]; notes: string } {
  if (!raw) return { items: [], notes: "" };
  try {
    const parsed = JSON.parse(raw) as { items?: unknown; notes?: unknown };
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const normalizedItems: CartItem[] = items
      .map((i) => {
        const obj = i as Record<string, unknown>;
        const productId = String(obj.productId ?? "");
        const name = String(obj.name ?? "");
        const price = Number(obj.price ?? 0);
        const imageUrl = (obj.imageUrl ?? null) as string | null;
        const requiresPrescription = Boolean(obj.requiresPrescription ?? false);
        const requiresDocument = Boolean(obj.requiresDocument ?? false);
        const quantity = Number(obj.quantity ?? 0);
        if (!productId || !name) return null;
        if (!Number.isFinite(price) || price < 0) return null;
        if (!Number.isFinite(quantity) || quantity < 1) return null;
        return {
          productId,
          name,
          price,
          imageUrl,
          quantity: Math.min(99, Math.trunc(quantity)),
          requiresPrescription,
          requiresDocument,
        } satisfies CartItem;
      })
      .filter(Boolean) as CartItem[];

    return {
      items: normalizedItems,
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
    };
  } catch {
    return { items: [], notes: "" };
  }
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function CustomerMenuBrowser({
  qrToken,
  tableLabel,
  menus,
  activeMenuId,
  categories,
  products,
  primaryColor,
  deliverySettings,
  paymentSettings,
}: {
  qrToken: string;
  tableLabel: string;
  menus: Menu[];
  activeMenuId: string;
  categories: Category[];
  products: Product[];
  primaryColor: string | null;
  deliverySettings: DeliverySettings;
  paymentSettings: PaymentSettings;
}) {
  const { lang } = useCustomerLanguage();

  const [query, setQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<
    "__all__" | "__uncategorized__" | string
  >("__all__");
  const [hasSession, setHasSession] = useState<boolean>(true);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [customerNotes, setCustomerNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<"dine_in" | "delivery">("dine_in");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<string[]>([]);
  const [selectedSavedAddress, setSelectedSavedAddress] = useState<string>("");
  const [saveAddress, setSaveAddress] = useState(true);
  const [success, setSuccess] = useState<
    | null
    | { orderNumber: number; total: number; table: string }
  >(null);

  useEffect(() => {
    const cookie = document.cookie || "";
    setHasSession(/(?:^|; )qerbie_session=/.test(cookie));

    const key = cartStorageKey(qrToken, activeMenuId);
    const { items, notes } = safeParseCart(localStorage.getItem(key));
    setCartItems(items);
    setCustomerNotes(notes);
    setSubmitError(null);
    setSuccess(null);

    const addrKey = `qerbie_addresses:${qrToken}`;
    try {
      const parsed = JSON.parse(localStorage.getItem(addrKey) ?? "[]") as unknown;
      const list = Array.isArray(parsed) ? parsed : [];
      const normalized = list
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter((x) => x.length >= 5)
        .slice(0, 5);
      setSavedAddresses(normalized);
    } catch {
      setSavedAddresses([]);
    }

    if (!deliverySettings.enabled) {
      setOrderType("dine_in");
    }
  }, [qrToken, activeMenuId, deliverySettings.enabled]);

  useEffect(() => {
    if (!deliverySettings.enabled && orderType !== "dine_in") {
      setOrderType("dine_in");
    }
  }, [deliverySettings.enabled, orderType]);

  useEffect(() => {
    const key = cartStorageKey(qrToken, activeMenuId);
    localStorage.setItem(key, JSON.stringify({ items: cartItems, notes: customerNotes }));
  }, [qrToken, activeMenuId, cartItems, customerNotes]);

  const filteredProducts = useMemo(() => {
    const q = normalize(query);
    if (!q) return products;

    return products.filter((p) => {
      const hay = normalize(`${p.name} ${p.description ?? ""}`);
      return hay.includes(q);
    });
  }, [products, query]);

  const isSpecialCare = (p: Product): boolean =>
    Boolean(p.requires_prescription || p.requires_document);

  const specialCareProducts = useMemo(
    () => filteredProducts.filter(isSpecialCare),
    [filteredProducts],
  );

  const regularProducts = useMemo(
    () => filteredProducts.filter((p) => !isSpecialCare(p)),
    [filteredProducts],
  );

  const visibleProducts = useMemo(() => {
    if (selectedCategoryId === "__all__") return regularProducts;
    if (selectedCategoryId === "__uncategorized__") {
      return regularProducts.filter((p) => !p.category_id);
    }
    return regularProducts.filter((p) => p.category_id === selectedCategoryId);
  }, [regularProducts, selectedCategoryId]);

  const visibleSpecialCareProducts = useMemo(() => {
    if (selectedCategoryId === "__all__") return specialCareProducts;
    if (selectedCategoryId === "__uncategorized__") {
      return specialCareProducts.filter((p) => !p.category_id);
    }
    return specialCareProducts.filter((p) => p.category_id === selectedCategoryId);
  }, [specialCareProducts, selectedCategoryId]);

  const featured = useMemo(
    () => visibleProducts.filter((p) => p.is_featured),
    [visibleProducts],
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of visibleProducts) {
      const key = p.category_id ?? "__uncategorized__";
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return map;
  }, [visibleProducts]);

  const hasUncategorized = useMemo(
    () => (byCategory.get("__uncategorized__") ?? []).length > 0,
    [byCategory],
  );

  const buttonStyle = primaryColor
    ? ({ backgroundColor: primaryColor } as const)
    : undefined;

  const cartCount = useMemo(
    () => cartItems.reduce((sum, i) => sum + i.quantity, 0),
    [cartItems],
  );

  const cartSubtotal = useMemo(() => {
    const total = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    return Math.round(total * 100) / 100;
  }, [cartItems]);

  const deliveryFee = useMemo(() => {
    const fee = Number(deliverySettings.fee ?? 0);
    if (!Number.isFinite(fee) || fee < 0) return 0;
    return Math.round(fee * 100) / 100;
  }, [deliverySettings.fee]);

  const cartTotal = useMemo(() => {
    if (orderType !== "delivery") return cartSubtotal;
    return Math.round((cartSubtotal + deliveryFee) * 100) / 100;
  }, [cartSubtotal, deliveryFee, orderType]);

  const hasSpecialCareInCart = useMemo(
    () => cartItems.some((i) => i.requiresPrescription || i.requiresDocument),
    [cartItems],
  );

  const paymentMethods = useMemo(() => {
    const methods: Array<
      | { kind: "pix"; title: string; description: string; key: string }
      | { kind: "link"; title: string; description: string; url: string }
      | { kind: "cash"; title: string; description: string }
    > = [];

    const pixKey = (paymentSettings.pixKey ?? "").trim();
    if (pixKey) {
      methods.push({
        kind: "pix",
        title: "Pix",
        description: paymentSettings.pixDescription?.trim() || "Use a chave abaixo para pagar via Pix.",
        key: pixKey,
      });
    }

    const cardUrl = (paymentSettings.cardUrl ?? "").trim();
    if (cardUrl) {
      methods.push({
        kind: "link",
        title: "Link (cartão/checkout)",
        description: paymentSettings.cardDescription?.trim() || "Abra o link abaixo para pagar.",
        url: cardUrl,
      });
    }

    const cash = (paymentSettings.cashDescription ?? "").trim();
    if (cash) {
      methods.push({ kind: "cash", title: "Dinheiro", description: cash });
    }

    return methods;
  }, [paymentSettings]);

  const paymentDisclaimer =
    paymentSettings.disclaimer?.trim() ||
    "A Qerbie não processa pagamentos. Combine o pagamento diretamente com o estabelecimento.";

  const moneyTotal = useMemo(() => formatBRL(cartTotal, lang), [cartTotal, lang]);

  const ui = useMemo(
    () => ({
      beforeOrder: tCustomer(lang, "before_order"),
      sendOrderRequiresName: tCustomer(lang, "send_order_requires_name"),
      typeYourNameCta: tCustomer(lang, "type_your_name_cta"),
      menu: tCustomer(lang, "menu"),
      search: tCustomer(lang, "search"),
      searchPlaceholder: tCustomer(lang, "search_placeholder"),
      others: tCustomer(lang, "others"),
      highlights: tCustomer(lang, "highlights"),
      top: tCustomer(lang, "top"),
      addToCart: tCustomer(lang, "add_to_cart"),
      noneFound: tCustomer(lang, "none_found"),
      noItemsHere: tCustomer(lang, "no_items_here"),
      viewCart: tCustomer(lang, "view_cart", { count: cartCount, total: moneyTotal }),
      cart: tCustomer(lang, "cart"),
      close: tCustomer(lang, "close"),
      orderSent: tCustomer(lang, "order_sent"),
      trackOrder: tCustomer(lang, "track_order"),
      ok: tCustomer(lang, "ok"),
      missingStep: tCustomer(lang, "type_missing_step"),
      emptyCart: tCustomer(lang, "empty_cart"),
      orderType: tCustomer(lang, "order_type"),
      table: tCustomer(lang, "table"),
      delivery: tCustomer(lang, "delivery"),
      savedAddresses: tCustomer(lang, "delivery_saved_addresses"),
      deliveryAddress: tCustomer(lang, "delivery_address"),
      deliveryAddressPlaceholder: tCustomer(lang, "delivery_address_placeholder"),
      select: tCustomer(lang, "select"),
      saveAddressOnDevice: tCustomer(lang, "save_address_on_device"),
      estimatedTime: tCustomer(lang, "estimated_time"),
      notes: tCustomer(lang, "notes"),
      notesPlaceholder: tCustomer(lang, "notes_placeholder"),
      total: tCustomer(lang, "total"),
      submitting: tCustomer(lang, "submitting"),
      submitOrder: tCustomer(lang, "submit_order"),
    }),
    [cartCount, lang, moneyTotal],
  );

  function addToCart(p: Product) {
    if (!hasSession) {
      window.location.href = `/t/${encodeURIComponent(qrToken)}`;
      return;
    }

    const price = Number(p.price ?? 0);
    if (!Number.isFinite(price) || price < 0) return;

    setCartItems((prev) => {
      const idx = prev.findIndex((x) => x.productId === p.id);
      if (idx === -1) {
        return [
          ...prev,
          {
            productId: p.id,
            name: p.name,
            price,
            imageUrl: p.image_url,
            quantity: 1,
            requiresPrescription: Boolean(p.requires_prescription),
            requiresDocument: Boolean(p.requires_document),
          },
        ];
      }

      const next = [...prev];
      next[idx] = { ...next[idx], quantity: Math.min(99, next[idx].quantity + 1) };
      return next;
    });
    setCartOpen(true);
  }

  function inc(productId: string) {
    setCartItems((prev) =>
      prev.map((i) =>
        i.productId === productId
          ? { ...i, quantity: Math.min(99, i.quantity + 1) }
          : i,
      ),
    );
  }

  function dec(productId: string) {
    setCartItems((prev) => {
      const item = prev.find((i) => i.productId === productId);
      if (!item) return prev;
      if (item.quantity <= 1) return prev.filter((i) => i.productId !== productId);
      return prev.map((i) =>
        i.productId === productId ? { ...i, quantity: i.quantity - 1 } : i,
      );
    });
  }

  function remove(productId: string) {
    setCartItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  async function submitOrder() {
    setSubmitError(null);
    setSubmitting(true);

    if (orderType === "delivery") {
      if (!deliverySettings.enabled) {
        setSubmitError(tCustomer(lang, "delivery_unavailable"));
        setSubmitting(false);
        return;
      }

      const addr = deliveryAddress.trim();
      if (addr.length < 5) {
        setSubmitError(tCustomer(lang, "delivery_address_required"));
        setSubmitting(false);
        return;
      }
    }

    try {
      const res = await fetch(`/api/t/${encodeURIComponent(qrToken)}/orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          menuId: activeMenuId,
          orderType,
          deliveryAddress: orderType === "delivery" ? deliveryAddress.trim() : null,
          customerNotes: customerNotes.trim() || null,
          items: cartItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        }),
      });

      const json = (await res.json()) as unknown;
      const parsed = (json ?? {}) as { error?: unknown; orderNumber?: unknown; total?: unknown; table?: unknown };
      if (!res.ok) {
        const code = String(parsed?.error ?? "unknown");
        if (code === "missing_session") {
          setSubmitError(tCustomer(lang, "session_missing"));
        } else if (code === "empty_cart") {
          setSubmitError(tCustomer(lang, "empty_cart"));
        } else if (code === "delivery_disabled") {
          setSubmitError(tCustomer(lang, "delivery_unavailable"));
        } else if (code === "delivery_address_missing") {
          setSubmitError(tCustomer(lang, "delivery_address_required"));
        } else {
          setSubmitError(tCustomer(lang, "could_not_continue"));
        }
        return;
      }

      setSuccess({
        orderNumber: Number(parsed.orderNumber ?? 0),
        total: Number(parsed.total ?? 0),
        table: String(parsed.table ?? tableLabel),
      });

      if (orderType === "delivery" && saveAddress) {
        const addrKey = `qerbie_addresses:${qrToken}`;
        const addr = deliveryAddress.trim();
        try {
          const next = [addr, ...savedAddresses.filter((x) => x !== addr)].slice(0, 5);
          localStorage.setItem(addrKey, JSON.stringify(next));
          setSavedAddresses(next);
        } catch {
          // ignore
        }
      }
      setCartItems([]);
      setCustomerNotes("");
      setDeliveryAddress("");
      setSelectedSavedAddress("");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : tCustomer(lang, "could_not_continue"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {ui.menu}
            </p>
            <div className="mt-1">
              <select
                value={activeMenuId}
                onChange={(e) => {
                  const next = e.target.value;
                  const url = new URL(window.location.href);
                  url.searchParams.set("menu", next);
                  window.location.href = url.toString();
                }}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              >
                {menus.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="min-w-[220px] flex-1 sm:max-w-xs">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {ui.search}
            </p>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={ui.searchPlaceholder}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategoryId("__all__")}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              selectedCategoryId === "__all__"
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            }`}
          >
            Todos
          </button>

          {categories.map((c) => {
            const hasItems = (byCategory.get(c.id) ?? []).length > 0;
            if (!hasItems) return null;

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategoryId(c.id)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  selectedCategoryId === c.id
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                }`}
              >
                {c.name}
              </button>
            );
          })}

          {hasUncategorized ? (
            <button
              type="button"
              onClick={() => setSelectedCategoryId("__uncategorized__")}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                selectedCategoryId === "__uncategorized__"
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              }`}
            >
              {ui.others}
            </button>
          ) : null}
        </div>
      </div>

      {success ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Pagamento
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {paymentDisclaimer}
          </p>

          {paymentMethods.length ? (
            <div className="mt-3 space-y-3">
              {paymentMethods.map((m) => (
                <div
                  key={m.kind}
                  className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {m.title}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {m.description}
                  </div>

                  {m.kind === "pix" ? (
                    <div className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
                      {m.key}
                    </div>
                  ) : null}

                  {m.kind === "link" ? (
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                      Abrir link de pagamento
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
              O estabelecimento ainda não configurou formas de pagamento por aqui.
            </div>
          )}
        </div>
      ) : null}

      {featured.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {ui.highlights}
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {featured.slice(0, 6).map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {p.name}
                    </p>
                    {(p.requires_prescription || p.requires_document) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {p.requires_prescription && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                            {tCustomer(lang, "restriction_badge_prescription")}
                          </span>
                        )}
                        {p.requires_document && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                            {tCustomer(lang, "restriction_badge_document")}
                          </span>
                        )}
                      </div>
                    )}
                    {p.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                        {p.description}
                      </p>
                    ) : null}
                    <p className="mt-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">
                      {formatBRL(Number(p.price ?? 0), lang)}
                    </p>
                  </div>
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-14 w-14 shrink-0 rounded-xl border border-zinc-200 bg-white object-cover dark:border-zinc-800"
                    />
                  ) : (
                    <div className="h-14 w-14 shrink-0 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900" />
                  )}
                </div>
                <button
                  type="button"
                  style={buttonStyle}
                  className="mt-3 w-full rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  onClick={() => addToCart(p)}
                >
                  {ui.addToCart}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {visibleSpecialCareProducts.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                {tCustomer(lang, "restriction_title")}
              </h2>
              <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-100/80">
                {tCustomer(lang, "restriction_hint")}
              </p>
            </div>
            <a
              href="#top"
              className="text-xs font-semibold text-amber-800/80 hover:underline dark:text-amber-100/70"
            >
              {ui.top}
            </a>
          </div>

          <ul className="mt-3 divide-y divide-amber-200/60 dark:divide-amber-900/60">
            {visibleSpecialCareProducts.map((p) => (
              <li key={p.id} className="py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {p.name}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {p.requires_prescription && (
                        <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100">
                          {tCustomer(lang, "restriction_badge_prescription")}
                        </span>
                      )}
                      {p.requires_document && (
                        <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100">
                          {tCustomer(lang, "restriction_badge_document")}
                        </span>
                      )}
                    </div>
                    {p.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-300">
                        {p.description}
                      </p>
                    ) : null}
                    <p className="mt-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">
                      {formatBRL(Number(p.price ?? 0), lang)}
                    </p>
                  </div>

                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-16 w-16 shrink-0 rounded-2xl border border-amber-200 bg-white object-cover dark:border-amber-900"
                    />
                  ) : (
                    <div className="h-16 w-16 shrink-0 rounded-2xl border border-dashed border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950" />
                  )}
                </div>

                <div className="mt-3">
                  <button
                    type="button"
                    style={buttonStyle}
                    className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    onClick={() => addToCart(p)}
                  >
                    {ui.addToCart}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="space-y-5">
        {categories.map((c) => {
          const items = byCategory.get(c.id) ?? [];
          if (items.length === 0) return null;

          if (selectedCategoryId !== "__all__" && selectedCategoryId !== c.id) {
            return null;
          }

          return (
            <section
              key={c.id}
              id={`cat-${c.id}`}
              className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {c.name}
                  </h2>
                  {c.description ? (
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {c.description}
                    </p>
                  ) : null}
                </div>
                <a
                  href="#top"
                  className="text-xs font-semibold text-zinc-500 hover:underline dark:text-zinc-400"
                >
                  {ui.top}
                </a>
              </div>

              <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
                {items.map((p) => (
                  <li key={p.id} className="py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          {p.name}
                        </p>
                        {(p.requires_prescription || p.requires_document) && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {p.requires_prescription && (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                                {tCustomer(lang, "restriction_badge_prescription")}
                              </span>
                            )}
                            {p.requires_document && (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                                {tCustomer(lang, "restriction_badge_document")}
                              </span>
                            )}
                          </div>
                        )}
                        {p.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                            {p.description}
                          </p>
                        ) : null}
                        <p className="mt-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">
                          {formatBRL(Number(p.price ?? 0), lang)}
                        </p>
                      </div>

                      {p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="h-16 w-16 shrink-0 rounded-2xl border border-zinc-200 bg-white object-cover dark:border-zinc-800"
                        />
                      ) : (
                        <div className="h-16 w-16 shrink-0 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950" />
                      )}
                    </div>

                    <div className="mt-3">
                      <button
                        type="button"
                        style={buttonStyle}
                        className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                        onClick={() => addToCart(p)}
                      >
                        {ui.addToCart}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {(selectedCategoryId === "__all__" || selectedCategoryId === "__uncategorized__") && (
          <section
            id="cat-__uncategorized__"
            className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {ui.others}
            </h2>
            <a
              href="#top"
              className="text-xs font-semibold text-zinc-500 hover:underline dark:text-zinc-400"
            >
              {ui.top}
            </a>
          </div>

          {(() => {
            const items = byCategory.get("__uncategorized__") ?? [];
            if (items.length === 0) {
              return (
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  {query ? ui.noneFound : ui.noItemsHere}
                </p>
              );
            }

            return (
              <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
                {items.map((p) => (
                  <li key={p.id} className="py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          {p.name}
                        </p>
                        {p.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                            {p.description}
                          </p>
                        ) : null}
                        <p className="mt-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">
                          {formatBRL(Number(p.price ?? 0), lang)}
                        </p>
                      </div>

                      {p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="h-16 w-16 shrink-0 rounded-2xl border border-zinc-200 bg-white object-cover dark:border-zinc-800"
                        />
                      ) : (
                        <div className="h-16 w-16 shrink-0 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950" />
                      )}
                    </div>
                    <div className="mt-3">
                      <button
                        type="button"
                        style={buttonStyle}
                        className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                        onClick={() => addToCart(p)}
                      >
                        {ui.addToCart}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            );
          })()}
          </section>
        )}
      </div>

      {/* Floating cart button */}
      {cartCount > 0 && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          style={buttonStyle}
          className="fixed bottom-4 left-1/2 z-40 w-[min(520px,calc(100%-2rem))] -translate-x-1/2 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/10 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {ui.viewCart}
        </button>
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setCartOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 mx-auto w-full max-w-2xl rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-zinc-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {ui.cart}
                </p>
                <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {tableLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                {ui.close}
              </button>
            </div>

            {success ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                <p className="font-semibold">{ui.orderSent}</p>
                <p className="mt-1">
                  {tCustomer(lang, "number")}: <span className="font-semibold">#{success.orderNumber}</span> • {tCustomer(lang, "total")}: {formatBRL(success.total, lang)}
                </p>
                <a
                  href={`/t/${encodeURIComponent(qrToken)}/pedidos`}
                  className="mt-3 inline-block rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
                  style={buttonStyle}
                >
                  {ui.trackOrder}
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setSuccess(null);
                    setCartOpen(false);
                  }}
                  className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  {ui.ok}
                </button>
              </div>
            ) : (
              <>
                {!hasSession && (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                    <p className="font-semibold">{ui.missingStep}</p>
                    <p className="mt-1">
                      {ui.sendOrderRequiresName}
                    </p>
                    <a
                      href={`/t/${encodeURIComponent(qrToken)}`}
                      className="mt-3 inline-block rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
                    >
                      {ui.typeYourNameCta}
                    </a>
                  </div>
                )}

                {submitError && (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                    {submitError}
                  </div>
                )}

                {cartItems.length === 0 ? (
                  <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                    {ui.emptyCart}
                  </p>
                ) : (
                  <div className="mt-4 max-h-[52vh] space-y-4 overflow-auto pr-1">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        {ui.orderType}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setOrderType("dine_in")}
                          className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                            orderType === "dine_in"
                              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                              : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
                          }`}
                        >
                          {ui.table}
                        </button>
                        {deliverySettings.enabled && (
                          <button
                            type="button"
                            onClick={() => setOrderType("delivery")}
                            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                              orderType === "delivery"
                                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                                : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
                            }`}
                          >
                            {ui.delivery}
                          </button>
                        )}
                      </div>

                      {orderType === "delivery" && (
                        <div className="mt-3 space-y-3">
                          {deliverySettings.note ? (
                            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                              {deliverySettings.note}
                            </div>
                          ) : null}

                          {deliverySettings.etaMinutes ? (
                            <p className="text-sm text-zinc-600 dark:text-zinc-300">
                              {ui.estimatedTime}: ~{deliverySettings.etaMinutes} min
                            </p>
                          ) : null}

                          {savedAddresses.length > 0 && (
                            <div>
                              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                {ui.savedAddresses}
                              </label>
                              <select
                                value={selectedSavedAddress}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setSelectedSavedAddress(v);
                                  if (v) setDeliveryAddress(v);
                                }}
                                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                              >
                                <option value="">{ui.select}</option>
                                {savedAddresses.map((a) => (
                                  <option key={a} value={a}>
                                    {a}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                              {ui.deliveryAddress}
                            </label>
                            <textarea
                              value={deliveryAddress}
                              onChange={(e) => setDeliveryAddress(e.target.value)}
                              rows={3}
                              placeholder={ui.deliveryAddressPlaceholder}
                              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                            />
                            <label className="mt-2 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
                              <input
                                type="checkbox"
                                checked={saveAddress}
                                onChange={(e) => setSaveAddress(e.target.checked)}
                                className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
                              />
                              {ui.saveAddressOnDevice}
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                    <ul className="space-y-3">
                      {cartItems.map((i) => (
                        <li
                          key={i.productId}
                          className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                                {i.name}
                              </p>
                              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                {formatBRL(i.price, lang)}
                              </p>
                              {(i.requiresPrescription || i.requiresDocument) && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {i.requiresPrescription && (
                                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                                      {tCustomer(lang, "restriction_badge_prescription")}
                                    </span>
                                  )}
                                  {i.requiresDocument && (
                                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                                      {tCustomer(lang, "restriction_badge_document")}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {i.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={i.imageUrl}
                                alt={i.name}
                                className="h-12 w-12 shrink-0 rounded-xl border border-zinc-200 bg-white object-cover dark:border-zinc-800"
                              />
                            ) : null}
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="inline-flex items-center overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                              <button
                                type="button"
                                onClick={() => dec(i.productId)}
                                className="px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                              >
                                −
                              </button>
                              <span className="px-3 py-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                                {i.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => inc(i.productId)}
                                className="px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                              >
                                +
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => remove(i.productId)}
                              className="text-xs font-semibold text-zinc-500 hover:underline dark:text-zinc-400"
                            >
                              {tCustomer(lang, "remove")}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>

                    {hasSpecialCareInCart && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                        <p className="text-xs font-semibold uppercase tracking-wide">
                          {tCustomer(lang, "restriction_title")}
                        </p>
                        <p className="mt-1 text-sm">
                          {tCustomer(lang, "restriction_hint")}
                        </p>
                      </div>
                    )}

                    <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                      <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        {ui.notes}
                      </label>
                      <textarea
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        rows={3}
                        placeholder={ui.notesPlaceholder}
                        className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                      />
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {ui.total}: {formatBRL(cartTotal, lang)}
                  </p>
                  <button
                    type="button"
                    onClick={submitOrder}
                    disabled={submitting || cartItems.length === 0 || !hasSession}
                    style={buttonStyle}
                    className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    {submitting ? ui.submitting : ui.submitOrder}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
