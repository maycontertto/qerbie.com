"use server";

import { redirect } from "next/navigation";
import { getMerchantOrRedirect } from "@/lib/auth/guard";
import { isBusinessCategoryKey } from "@/lib/merchant/businessCategories";

function readStringField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const v = record[key];
  return typeof v === "string" ? v : undefined;
}

function readErrorMeta(error: unknown): {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
} {
  return {
    code: readStringField(error, "code"),
    message: readStringField(error, "message"),
    details: readStringField(error, "details"),
    hint: readStringField(error, "hint"),
  };
}

export async function setBusinessCategory(formData: FormData): Promise<void> {
  const raw = (formData.get("category") as string | null)?.trim() ?? "";

  try {
    if (!isBusinessCategoryKey(raw)) {
      redirect("/dashboard?error=invalid_category");
    }

    const { supabase, user, merchant } = await getMerchantOrRedirect();

    const isOwner = user.id === merchant.owner_user_id;
    if (!isOwner) {
      redirect("/dashboard?error=not_owner");
    }

    const { data, error } = await supabase
      .from("merchants")
      .update({ business_category: raw })
      .eq("id", merchant.id)
      .select("id")
      .maybeSingle();

    if (error) {
      const meta = readErrorMeta(error);
      console.error("setBusinessCategory: update merchants failed", {
        code: meta.code,
        message: meta.message,
        details: meta.details,
        hint: meta.hint,
      });

      const msg = `${meta.code ?? ""} ${meta.message ?? ""} ${meta.details ?? ""}`
        .toLowerCase()
        .trim();

      const isMissingBusinessCategoryColumn =
        meta.code === "42703" ||
        meta.code === "PGRST204" ||
        (msg.includes("business_category") &&
          (msg.includes("does not exist") ||
            msg.includes("column") ||
            msg.includes("could not find")));

      if (isMissingBusinessCategoryColumn) {
        // Banco ainda sem a migração 013 (coluna ausente).
        // Mantém a navegação funcionando via query param, sem exibir erro.
        redirect(`/dashboard?category=${encodeURIComponent(raw)}`);
      }

      const looksLikeRlsOrPermission =
        meta.code === "42501" ||
        msg.includes("row level security") ||
        msg.includes("permission denied");

      if (looksLikeRlsOrPermission) {
        redirect("/dashboard?error=not_owner");
      }

      redirect(`/dashboard?category=${encodeURIComponent(raw)}&error=save_failed`);
    }

    if (!data?.id) {
      console.error("setBusinessCategory: update returned no row", {
        merchantId: merchant.id,
        userId: user.id,
        category: raw,
      });
      // Sem erro explícito, mas também sem confirmação de update (pode acontecer com RLS).
      redirect(`/dashboard?category=${encodeURIComponent(raw)}&error=save_failed`);
    }

    redirect(`/dashboard?category=${encodeURIComponent(raw)}&saved=1`);
  } catch (err) {
    const digest = readStringField(err, "digest");
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
      throw err;
    }

    console.error("setBusinessCategory: unexpected error", err);
    redirect(`/dashboard?category=${encodeURIComponent(raw)}&error=save_failed`);
  }
}
