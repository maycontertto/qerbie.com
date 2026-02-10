export type CustomerLanguage = "pt" | "en" | "es";

export const CUSTOMER_LANGUAGES: Array<{ code: CustomerLanguage; label: string }> = [
  { code: "pt", label: "Português" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

export const CUSTOMER_LANGUAGE_STORAGE_KEY = "qerbie_customer_lang";

export function normalizeCustomerLanguage(raw: unknown): CustomerLanguage {
  if (raw === "en" || raw === "es" || raw === "pt") return raw;
  return "pt";
}

export type CustomerI18nKey =
  | "language"
  | "back"
  | "close"
  | "ok"
  | "queue"
  | "agenda"
  | "invalid_qr"
  | "invalid_qr_hint"
  | "continue"
  | "your_name"
  | "name_placeholder"
    | "name_helper"
  | "start_terms"
  | "you_are_served_by"
  | "could_not_continue"
  | "type_your_name"
  | "menu"
  | "no_menu_available"
  | "no_menu_published"
  | "search"
  | "search_placeholder"
  | "cart"
  | "view_cart"
  | "add_to_cart"
  | "remove"
  | "empty_cart"
  | "submit_order"
  | "submitting"
  | "order_sent"
  | "track_order"
  | "session_missing"
  | "send_order_requires_name"
  | "delivery"
  | "table"
  | "order_type"
  | "before_order"
  | "type_missing_step"
  | "type_your_name_cta"
  | "type_your_name_hint"
  | "change_name"
  | "top"
  | "others"
  | "highlights"
  | "estimated_time"
  | "select"
  | "delivery_address_placeholder"
  | "total"
  | "number"
  | "delivery_unavailable"
  | "delivery_address_required"
  | "delivery_saved_addresses"
  | "delivery_address"
  | "save_address_on_device"
  | "notes"
  | "notes_placeholder"
  | "none_found"
  | "no_items_here"
  | "support_contact"
  | "support_hours"
  | "support_phone"
  | "support_email"
  | "whatsapp"
  | "orders_tracking"
  | "go_back_menu"
  | "no_orders_yet"
  | "previous_orders"
  | "status_received"
  | "status_preparing"
  | "status_ready"
  | "status_finished"
  | "status_cancelled"
  | "status"
  | "obs";

const dict: Record<CustomerLanguage, Record<CustomerI18nKey, string>> = {
  pt: {
    language: "Idioma",
    back: "Voltar",
    close: "Fechar",
    ok: "Ok",
    queue: "Fila",
    agenda: "Agenda",
    invalid_qr: "QR Code inválido",
    invalid_qr_hint: "Não encontramos esta mesa. Verifique se o QR Code está correto.",
    continue: "Continuar",
    your_name: "Seu nome",
    name_placeholder: "Ex: Ana",
      name_helper: "Isso não cria uma conta — é só para identificar seu pedido.",
    start_terms: "Ao continuar, você aceita receber atualizações do seu pedido nesta sessão.",
    you_are_served_by: "Você está sendo atendido por {name}",
    could_not_continue: "Não foi possível continuar.",
    type_your_name: "Digite seu nome para continuar.",
    menu: "Menu",
    no_menu_available: "Nenhum menu disponível",
    no_menu_published: "Este estabelecimento ainda não publicou um cardápio.",
    search: "Buscar",
    search_placeholder: "Digite o nome do item…",
    cart: "Carrinho",
    view_cart: "Ver carrinho ({count}) • {total}",
    add_to_cart: "Adicionar ao carrinho",
    remove: "Remover",
    empty_cart: "Seu carrinho está vazio.",
    submit_order: "Enviar pedido",
    submitting: "Enviando…",
    order_sent: "Pedido enviado!",
    track_order: "Acompanhar status do pedido",
    session_missing: "Sessão não encontrada. Volte e digite seu nome novamente.",
    send_order_requires_name: "Para enviar o pedido, informe seu nome. É rapidinho.",
    delivery: "Entrega",
    table: "Mesa",
    order_type: "Tipo",
    before_order: "Antes de pedir",
    type_missing_step: "Falta um passo",
    type_your_name_cta: "Digitar meu nome",
    type_your_name_hint: "Para pedir, informe seu nome.",
    change_name: "← Trocar nome",
    top: "Topo",
    others: "Outros",
    highlights: "Destaques",
    estimated_time: "Tempo estimado",
    select: "Selecionar…",
    delivery_address_placeholder: "Rua, número, bairro, complemento…",
    total: "Total",
    number: "Número",
    delivery_unavailable: "Entrega indisponível no momento.",
    delivery_address_required: "Informe seu endereço para entrega.",
    delivery_saved_addresses: "Endereços salvos",
    delivery_address: "Endereço para entrega",
    save_address_on_device: "Salvar este endereço neste dispositivo",
    notes: "Observações",
    notes_placeholder: "Ex: sem cebola, entregar no balcão…",
    none_found: "Nenhum item encontrado.",
    no_items_here: "Sem itens aqui.",
    support_contact: "Suporte & Contato",
    support_hours: "Horário",
    support_phone: "Telefone",
    support_email: "E-mail",
    whatsapp: "Falar no WhatsApp",
    orders_tracking: "Acompanhamento do pedido",
    go_back_menu: "← Voltar ao menu",
    no_orders_yet: "Você ainda não enviou nenhum pedido nesta sessão.",
    previous_orders: "Pedidos anteriores",
    status_received: "Recebido",
    status_preparing: "Em preparo",
    status_ready: "Pronto",
    status_finished: "Finalizado",
    status_cancelled: "Cancelado",
    status: "Status",
    obs: "Obs",
  },
  en: {
    language: "Language",
    back: "Back",
    close: "Close",
    ok: "OK",
    queue: "Queue",
    agenda: "Schedule",
    invalid_qr: "Invalid QR code",
    invalid_qr_hint: "We couldn't find this table. Please check the QR code.",
    continue: "Continue",
    your_name: "Your name",
    name_placeholder: "e.g. Ana",
    name_helper: "This does not create an account — it only identifies your order.",
    start_terms: "By continuing, you agree to receive updates about your order in this session.",
    you_are_served_by: "You are being served by {name}",
    could_not_continue: "Couldn't continue.",
    type_your_name: "Please type your name to continue.",
    menu: "Menu",
    no_menu_available: "No menu available",
    no_menu_published: "This place hasn't published a menu yet.",
    search: "Search",
    search_placeholder: "Type an item name…",
    cart: "Cart",
    view_cart: "View cart ({count}) • {total}",
    add_to_cart: "Add to cart",
    remove: "Remove",
    empty_cart: "Your cart is empty.",
    submit_order: "Place order",
    submitting: "Sending…",
    order_sent: "Order sent!",
    track_order: "Track order status",
    session_missing: "Session not found. Go back and enter your name again.",
    send_order_requires_name: "To place an order, please enter your name. It's quick.",
    delivery: "Delivery",
    table: "Table",
    order_type: "Type",
    before_order: "Before ordering",
    type_missing_step: "One more step",
    type_your_name_cta: "Enter my name",
    type_your_name_hint: "To order, please enter your name.",
    change_name: "← Change name",
    top: "Top",
    others: "Other",
    highlights: "Highlights",
    estimated_time: "Estimated time",
    select: "Select…",
    delivery_address_placeholder: "Street, number, neighborhood, extra info…",
    total: "Total",
    number: "Number",
    delivery_unavailable: "Delivery is currently unavailable.",
    delivery_address_required: "Please enter your delivery address.",
    delivery_saved_addresses: "Saved addresses",
    delivery_address: "Delivery address",
    save_address_on_device: "Save this address on this device",
    notes: "Notes",
    notes_placeholder: "e.g. no onions, leave at the counter…",
    none_found: "No items found.",
    no_items_here: "No items here.",
    support_contact: "Support & Contact",
    support_hours: "Hours",
    support_phone: "Phone",
    support_email: "Email",
    whatsapp: "WhatsApp",
    orders_tracking: "Order tracking",
    go_back_menu: "← Back to menu",
    no_orders_yet: "You haven't placed any orders in this session yet.",
    previous_orders: "Previous orders",
    status_received: "Received",
    status_preparing: "Preparing",
    status_ready: "Ready",
    status_finished: "Finished",
    status_cancelled: "Cancelled",
    status: "Status",
    obs: "Note",
  },
  es: {
    language: "Idioma",
    back: "Volver",
    close: "Cerrar",
    ok: "OK",
    queue: "Fila",
    agenda: "Agenda",
    invalid_qr: "QR inválido",
    invalid_qr_hint: "No encontramos esta mesa. Verifica el código QR.",
    continue: "Continuar",
    your_name: "Tu nombre",
    name_placeholder: "p. ej.: Ana",
    name_helper: "Esto no crea una cuenta — solo identifica tu pedido.",
    start_terms: "Al continuar, aceptas recibir actualizaciones de tu pedido en esta sesión.",
    you_are_served_by: "Estás siendo atendido por {name}",
    could_not_continue: "No se pudo continuar.",
    type_your_name: "Escribe tu nombre para continuar.",
    menu: "Menú",
    no_menu_available: "No hay menú disponible",
    no_menu_published: "Este lugar aún no ha publicado un menú.",
    search: "Buscar",
    search_placeholder: "Escribe el nombre del producto…",
    cart: "Carrito",
    view_cart: "Ver carrito ({count}) • {total}",
    add_to_cart: "Agregar al carrito",
    remove: "Quitar",
    empty_cart: "Tu carrito está vacío.",
    submit_order: "Enviar pedido",
    submitting: "Enviando…",
    order_sent: "¡Pedido enviado!",
    track_order: "Ver estado del pedido",
    session_missing: "Sesión no encontrada. Vuelve e ingresa tu nombre nuevamente.",
    send_order_requires_name: "Para enviar el pedido, ingresa tu nombre. Es rápido.",
    delivery: "Entrega",
    table: "Mesa",
    order_type: "Tipo",
    before_order: "Antes de pedir",
    type_missing_step: "Falta un paso",
    type_your_name_cta: "Ingresar mi nombre",
    type_your_name_hint: "Para pedir, ingresa tu nombre.",
    change_name: "← Cambiar nombre",
    top: "Arriba",
    others: "Otros",
    highlights: "Destacados",
    estimated_time: "Tiempo estimado",
    select: "Seleccionar…",
    delivery_address_placeholder: "Calle, número, barrio, complemento…",
    total: "Total",
    number: "Número",
    delivery_unavailable: "La entrega no está disponible en este momento.",
    delivery_address_required: "Ingresa tu dirección de entrega.",
    delivery_saved_addresses: "Direcciones guardadas",
    delivery_address: "Dirección de entrega",
    save_address_on_device: "Guardar esta dirección en este dispositivo",
    notes: "Observaciones",
    notes_placeholder: "Ej: sin cebolla, entregar en el mostrador…",
    none_found: "No se encontraron productos.",
    no_items_here: "No hay productos aquí.",
    support_contact: "Soporte y contacto",
    support_hours: "Horario",
    support_phone: "Teléfono",
    support_email: "Correo",
    whatsapp: "WhatsApp",
    orders_tracking: "Seguimiento del pedido",
    go_back_menu: "← Volver al menú",
    no_orders_yet: "Aún no has enviado ningún pedido en esta sesión.",
    previous_orders: "Pedidos anteriores",
    status_received: "Recibido",
    status_preparing: "En preparación",
    status_ready: "Listo",
    status_finished: "Finalizado",
    status_cancelled: "Cancelado",
    status: "Estado",
    obs: "Obs",
  },
};

export function tCustomer(
  lang: CustomerLanguage,
  key: CustomerI18nKey,
  vars?: Record<string, string | number>,
): string {
  let template = dict[lang]?.[key] ?? dict.pt[key] ?? String(key);
  if (!vars) return template;
  for (const [k, v] of Object.entries(vars)) {
    template = template.replaceAll(`{${k}}`, String(v));
  }
  return template;
}
