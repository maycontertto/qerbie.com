import type { ReactNode } from "react";
import { getDashboardUserOrRedirect } from "@/lib/auth/guard";
import { AssistantWidget } from "./AssistantWidget";

// allowSuspended: true - a checagem de billing estrita fica a cargo de cada página; o widget não deve bloquear navegação.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { merchant } = await getDashboardUserOrRedirect({ allowSuspended: true });

  return (
    <>
      {children}
      <AssistantWidget merchantName={merchant.name} />
    </>
  );
}
