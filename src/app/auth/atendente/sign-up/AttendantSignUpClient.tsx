"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function AttendantSignUpClient() {
  const sp = useSearchParams();
  const next = sp.get("next") ?? "/atendente";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Qerbie
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Conta de atendente
          </p>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Para manter o controle e evitar contas duplicadas, o login e a senha do atendente são criados pelo dono da loja.
          </p>
        </div>

        <Link
          href={`/auth/sign-in?next=${encodeURIComponent(next)}`}
          className="block w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Entrar
        </Link>

        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          Se você não tem login e senha, peça ao dono da loja.
        </p>
      </div>
    </div>
  );
}
