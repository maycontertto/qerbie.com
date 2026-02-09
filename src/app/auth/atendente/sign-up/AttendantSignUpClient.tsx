"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { signUpAttendant } from "@/lib/auth/attendantActions";

export default function AttendantSignUpClient() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const sp = useSearchParams();
  const code = sp.get("code") ?? "";
  const next =
    sp.get("next") ??
    (code ? `/atendente/vincular?code=${encodeURIComponent(code)}` : "");

  async function handleSubmit(formData: FormData) {
    setError(null);
    setLoading(true);
    const result = await signUpAttendant(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Qerbie
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Criar conta de atendente
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        <form action={handleSubmit} className="space-y-4">
          {code ? <input type="hidden" name="code" value={code} /> : null}
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              minLength={8}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {loading ? "Criando..." : "Criar conta"}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          Já tem conta?{" "}
          <Link
            href={next ? `/auth/sign-in?next=${encodeURIComponent(next)}` : "/auth/sign-in"}
            className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
          >
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
