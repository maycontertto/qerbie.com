"use server";

import { redirect } from "next/navigation";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { normalizeHexColor } from "@/lib/merchant/branding";
import { encryptFiscalValue } from "@/lib/merchant/fiscalEncryption";
import { getBrazilianTaxIdType, isValidBrazilianTaxId, normalizeBrazilianTaxId } from "@/lib/merchant/taxId";
import { queryInvoiceXml, queryReceivedNfe } from "@/lib/merchant/sefazDistribution";

const RECEIVED_INVOICES_BASE = "/dashboard/modulos/notas_fiscais";

async function requireBrandingAccess() {
  const { supabase, user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const ok =
    isOwner ||
    (membership
      ? hasMemberPermission(membership.role, membership.permissions, "dashboard_branding")
      : false);
  if (!ok) {
    redirect("/dashboard/branding?error=not_allowed");
  }
  return { supabase, merchant };
}

export async function updateBranding(formData: FormData): Promise<void> {
  const displayName = (formData.get("display_name") as string | null)?.trim() ?? "";
  const logoUrl = (formData.get("logo_url") as string | null)?.trim() ?? "";
  const primaryColorRaw = (formData.get("primary_color") as string | null)?.trim() ?? "";
  const welcomeMessage = (formData.get("welcome_message") as string | null)?.trim() ?? "";

  const { supabase, merchant } = await requireBrandingAccess();

  const primaryColor = normalizeHexColor(primaryColorRaw || null);

  // If user typed something but it's invalid, show error.
  if (primaryColorRaw && !primaryColor) {
    redirect("/dashboard/branding?error=invalid_color");
  }

  const payload = {
    brand_display_name: displayName || null,
    brand_logo_url: logoUrl || null,
    brand_primary_color: primaryColor,
    customer_welcome_message: welcomeMessage || null,
  };

  const { error } = await supabase
    .from("merchants")
    .update(payload)
    .eq("id", merchant.id);

  if (error) {
    // Before applying migration 014, this will fail — keep the page usable.
    redirect("/dashboard/branding?error=save_failed");
  }

  redirect("/dashboard/branding?saved=1");
}

export async function uploadBrandLogo(formData: FormData): Promise<void> {
  const file = formData.get("logo_file");

  if (!(file instanceof File)) {
    redirect("/dashboard/branding?error=logo_missing");
  }

  if (!file.type.startsWith("image/")) {
    redirect("/dashboard/branding?error=logo_type");
  }

  // 5MB guardrail.
  if (file.size > 5 * 1024 * 1024) {
    redirect("/dashboard/branding?error=logo_too_large");
  }

  const { supabase, merchant } = await requireBrandingAccess();

  const ext = (file.name.split(".").pop() || "bin")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 10) || "bin";
  const path = `${merchant.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("brand-logos")
    .upload(path, bytes, {
      upsert: true,
      contentType: file.type || "application/octet-stream",
    });

  if (uploadError) {
    const message =
      typeof (uploadError as { message?: unknown } | null)?.message === "string"
        ? (uploadError as { message: string }).message
        : "";
    const msg = message.toLowerCase();
    if (msg.includes("bucket") && msg.includes("not")) {
      redirect("/dashboard/branding?error=bucket_missing");
    }
    redirect("/dashboard/branding?error=logo_upload_failed");
  }

  const { data } = supabase.storage.from("brand-logos").getPublicUrl(path);
  const publicUrl = data.publicUrl;

  const { error: updateError } = await supabase
    .from("merchants")
    .update({ brand_logo_url: publicUrl })
    .eq("id", merchant.id);

  if (updateError) {
    redirect("/dashboard/branding?error=save_failed");
  }

  redirect("/dashboard/branding?saved=1");
}

export async function saveFiscalTaxId(formData: FormData): Promise<void> {
  const { supabase, merchant, user } = await getDashboardUserOrRedirect();
  if (user.id !== merchant.owner_user_id) redirect("/dashboard/branding?fiscal_error=owner_only");

  const raw = String(formData.get("tax_id") ?? "").trim();
  const digits = normalizeBrazilianTaxId(raw);
  if (digits && !isValidBrazilianTaxId(digits)) redirect("/dashboard/branding?fiscal_error=invalid_tax_id");
  let encryptedTaxId: string | null = null;
  try { if (digits) encryptedTaxId = encryptFiscalValue(digits); }
  catch { redirect("/dashboard/branding?fiscal_error=encryption_key_missing"); }
  const taxIdType = digits ? getBrazilianTaxIdType(digits) : null;
  const { data: current } = await supabase.from("merchant_fiscal_profiles")
    .select("merchant_id").eq("merchant_id", merchant.id).maybeSingle();
  const payload = { tax_id_ciphertext: encryptedTaxId, tax_id_type: taxIdType, updated_at: new Date().toISOString() };
  const { error } = current
    ? await supabase.from("merchant_fiscal_profiles").update(payload).eq("merchant_id", merchant.id)
    : await supabase.from("merchant_fiscal_profiles").insert({ merchant_id: merchant.id, ...payload });
  if (error) redirect("/dashboard/branding?fiscal_error=save_failed");
  redirect("/dashboard/branding?fiscal_saved=1");
}

export async function saveFiscalCertificate(formData: FormData): Promise<void> {
  const { supabase, merchant, user } = await getDashboardUserOrRedirect();
  if (user.id !== merchant.owner_user_id) redirect("/dashboard/branding?fiscal_error=owner_only");
  const file = formData.get("certificate_file");
  const password = String(formData.get("certificate_password") ?? "");
  if (!(file instanceof File) || !file.size) redirect("/dashboard/branding?fiscal_error=certificate_missing");
  if (file.size > 750 * 1024) redirect("/dashboard/branding?fiscal_error=certificate_too_large");
  if (!/\.(p12|pfx)$/i.test(file.name)) redirect("/dashboard/branding?fiscal_error=certificate_type");
  if (!password || password.length > 256) redirect("/dashboard/branding?fiscal_error=certificate_password");

  const { data: profile } = await supabase.from("merchant_fiscal_profiles")
    .select("tax_id_ciphertext")
    .eq("merchant_id", merchant.id)
    .maybeSingle();
  if (!profile?.tax_id_ciphertext) redirect("/dashboard/branding?fiscal_error=tax_id_required");
  let certificateCiphertext: string;
  let passwordCiphertext: string;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    certificateCiphertext = encryptFiscalValue(bytes);
    passwordCiphertext = encryptFiscalValue(password);
  } catch {
    redirect("/dashboard/branding?fiscal_error=encryption_key_missing");
  }
  const { error } = await supabase.from("merchant_fiscal_profiles").update({
    certificate_ciphertext: certificateCiphertext!,
    certificate_password_ciphertext: passwordCiphertext!,
    certificate_file_name: file.name.replace(/[^\w.-]/g, "_").slice(-100),
    updated_at: new Date().toISOString(),
  }).eq("merchant_id", merchant.id);
  if (error) redirect("/dashboard/branding?fiscal_error=save_failed");
  redirect("/dashboard/branding?fiscal_saved=1");
}

export async function syncReceivedInvoices(): Promise<void> {
  const { supabase, merchant, user } = await getDashboardUserOrRedirect();
  if (user.id !== merchant.owner_user_id) redirect(`${RECEIVED_INVOICES_BASE}?invoice_error=owner_only`);
  const { data: profile } = await supabase.from("merchant_fiscal_profiles")
    .select("tax_id_ciphertext, tax_id_type, certificate_ciphertext, certificate_password_ciphertext, last_nsu, last_query_at")
    .eq("merchant_id", merchant.id)
    .maybeSingle();
  if (!profile?.tax_id_ciphertext || !profile.tax_id_type || !profile.certificate_ciphertext || !profile.certificate_password_ciphertext) {
    redirect(`${RECEIVED_INVOICES_BASE}?invoice_error=setup_required`);
  }
  if (profile.last_query_at && Date.now() - Date.parse(profile.last_query_at) < 60 * 60 * 1000) {
    redirect(`${RECEIVED_INVOICES_BASE}?invoice_error=query_wait`);
  }
  try {
    const response = await queryReceivedNfe({
      taxIdCiphertext: profile.tax_id_ciphertext,
      taxIdType: profile.tax_id_type as "CPF" | "CNPJ",
      certificateCiphertext: profile.certificate_ciphertext,
      passwordCiphertext: profile.certificate_password_ciphertext,
      lastNsu: profile.last_nsu,
    });
    if (response.invoices.length) {
      const { error } = await supabase.from("merchant_received_invoices").upsert(
        response.invoices.map((invoice) => ({
          merchant_id: merchant.id,
          access_key: invoice.accessKey,
          invoice_number: invoice.invoiceNumber,
          series: invoice.series,
          issuer_name: invoice.issuerName,
          issuer_tax_id: invoice.issuerTaxId ? encryptFiscalValue(invoice.issuerTaxId) : null,
          issued_at: invoice.issuedAt,
          total_amount: invoice.totalAmount,
          summary_xml_ciphertext: invoice.encryptedSummary,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "merchant_id,access_key", ignoreDuplicates: true },
      );
      if (error) throw error;
    }
    const { error } = await supabase.from("merchant_fiscal_profiles").update({
      last_nsu: response.lastNsu,
      last_query_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("merchant_id", merchant.id);
    if (error) throw error;
  } catch {
    redirect(`${RECEIVED_INVOICES_BASE}?invoice_error=query_failed`);
  }
  redirect(`${RECEIVED_INVOICES_BASE}?invoice_synced=1`);
}

export async function fetchReceivedInvoiceXml(invoiceId: string): Promise<void> {
  const { supabase, merchant, user } = await getDashboardUserOrRedirect();
  if (user.id !== merchant.owner_user_id) redirect(`${RECEIVED_INVOICES_BASE}?invoice_error=owner_only`);
  const { data: profile } = await supabase.from("merchant_fiscal_profiles")
    .select("certificate_ciphertext, certificate_password_ciphertext")
    .eq("merchant_id", merchant.id)
    .maybeSingle();
  const { data: invoice } = await supabase.from("merchant_received_invoices")
    .select("id, access_key, status")
    .eq("merchant_id", merchant.id)
    .eq("id", invoiceId)
    .maybeSingle();
  if (!profile?.certificate_ciphertext || !profile.certificate_password_ciphertext || !invoice) {
    redirect(`${RECEIVED_INVOICES_BASE}?invoice_error=setup_required`);
  }
  if (invoice.status === "entered") redirect(`${RECEIVED_INVOICES_BASE}?invoice_error=already_entered`);
  let encryptedXml: string;
  try {
    ({ encryptedXml } = await queryInvoiceXml({
      certificateCiphertext: profile.certificate_ciphertext,
      passwordCiphertext: profile.certificate_password_ciphertext,
      accessKey: invoice.access_key,
    }));
  } catch {
    redirect(`${RECEIVED_INVOICES_BASE}?invoice_error=xml_unavailable`);
  }
  const { error } = await supabase.from("merchant_received_invoices").update({
    full_xml_ciphertext: encryptedXml!,
    status: "ready_for_review",
    updated_at: new Date().toISOString(),
  }).eq("merchant_id", merchant.id).eq("id", invoice.id);
  if (error) redirect(`${RECEIVED_INVOICES_BASE}?invoice_error=xml_unavailable`);
  redirect(`${RECEIVED_INVOICES_BASE}?review_invoice=${encodeURIComponent(invoice.id)}`);
}
