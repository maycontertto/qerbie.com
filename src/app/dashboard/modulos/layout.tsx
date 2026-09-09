import type { ReactNode } from "react";
import { getDashboardUserOrRedirect, hasMemberPermission } from "@/lib/auth/guard";
import { getBusinessCategoryLabel } from "@/lib/merchant/helpers";
import { DashboardShell } from "../DashboardShell";

export default async function DashboardModulosLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user, merchant, membership } = await getDashboardUserOrRedirect();
  const isOwner = user.id === merchant.owner_user_id;
  const can = (perm: string) =>
    isOwner || (membership ? hasMemberPermission(membership.role, membership.permissions, perm) : false);
  const selectedKey = merchant.business_category ?? null;
  const selectedLabel = getBusinessCategoryLabel(selectedKey);

  return (
    <DashboardShell
      merchantName={merchant.name}
      userEmail={user.email ?? ""}
      selectedLabel={selectedLabel}
      selectedKey={selectedKey}
      isOwner={isOwner}
      canBranding={can("dashboard_branding")}
    >
      {children}
    </DashboardShell>
  );
}
