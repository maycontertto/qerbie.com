import type { ReactNode } from "react";

export default function DashboardModulosLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-gradient-to-b from-white via-white to-zinc-50/80 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900/40">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[-120px] mx-auto h-[320px] w-[720px] rounded-full bg-gradient-to-r from-indigo-500/15 via-fuchsia-500/10 to-emerald-500/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-140px] top-[120px] h-[260px] w-[260px] rounded-full bg-emerald-400/10 blur-3xl"
      />
      <div className="relative">{children}</div>
    </div>
  );
}
