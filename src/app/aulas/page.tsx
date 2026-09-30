import Link from "next/link";

const FEATURED_VIDEO_EMBED_URL = "https://www.youtube.com/embed/QUnX5ApF88g?rel=0";

const LESSON_VIDEOS = [
  {
    id: "QUnX5ApF88g",
    title: "Visão geral e primeiros passos",
    description:
      "Aula inicial para entender a plataforma, conhecer os principais recursos e começar a usar com mais segurança.",
    href: "https://youtu.be/QUnX5ApF88g?si=eQQQVVum5jKAMwkq",
    duration: "Aula introdutória",
  },
  {
    id: "IXYCbJ0VuKc",
    title: "Como personalizar a marca",
    description:
      "Mostra como ajustar identidade visual e deixar a plataforma com a cara do negócio.",
    href: "https://youtu.be/IXYCbJ0VuKc?si=ZODGgR6dXqDUTc4R",
    duration: "Personalização",
  },
  {
    id: "fh1HOLGC6Vg",
    title: "Como funciona o atendimento",
    description:
      "Explica o fluxo de atendimento para operar melhor no dia a dia com a equipe.",
    href: "https://youtu.be/fh1HOLGC6Vg?si=Rc09_IWix0RQ2oFK",
    duration: "Atendimento",
  },
  {
    id: "z0bfW83W2yA",
    title: "Cadastro de equipe",
    description:
      "Ensina como cadastrar colaboradores e organizar permissões dentro da plataforma.",
    href: "https://youtu.be/z0bfW83W2yA?si=amN1A_s55yKvuIZK",
    duration: "Equipe",
  },
  {
    id: "NocztcP_Nus",
    title: "Controle de estoque",
    description:
      "Mostra como trabalhar o estoque com mais clareza, rapidez e menos erro operacional.",
    href: "https://youtu.be/NocztcP_Nus?si=h05meZIG-9jVOZyU",
    duration: "Estoque",
  },
];

export default function AulasPage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-zinc-50 to-white px-4 py-10 dark:from-zinc-950 dark:to-zinc-900">
      <main className="mx-auto w-full max-w-6xl">
        <Link
          href="/"
          className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
        >
          ← Voltar
        </Link>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
              Aprenda a usar a Qerbie
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
              Vídeos práticos para começar rápido e usar a plataforma com mais segurança.
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300 sm:text-base">
              Aprenda os principais recursos da plataforma com vídeos curtos e organizados por assunto. Escolha uma aula e acompanhe no seu ritmo.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={LESSON_VIDEOS[0].href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500"
              >
                Assistir primeira aula no YouTube
              </a>
              <Link
                href="/auth/sign-up"
                className="rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Criar conta grátis
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Primeiros passos</p>
                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                  Conheça a plataforma e prepare sua conta para a rotina do negócio.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Aulas por assunto</p>
                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                  Encontre demonstrações de marca, atendimento, equipe e estoque em um só lugar.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">No seu ritmo</p>
                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                  Assista novamente quando precisar rever uma etapa ou conhecer um recurso.
                </p>
              </div>
            </div>
          </section>

          <aside className="rounded-3xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Como aproveitar as aulas</h2>
            <ul className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
              <li>• Comece pela aula de visão geral.</li>
              <li>• Depois escolha o assunto que você quer configurar.</li>
              <li>• Deixe o painel aberto e acompanhe cada etapa no seu próprio negócio.</li>
              <li>• Volte a esta página sempre que quiser rever um recurso.</li>
            </ul>

            <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/40">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                Dica
              </p>
              <p className="mt-2 text-xs text-blue-800 dark:text-blue-200">
                As aulas são independentes: você pode assistir na ordem ou ir direto ao tema que precisa.
              </p>
            </div>
          </aside>
        </div>

        <section className="mt-8 rounded-3xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                Aula em destaque
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Comece por esta aula
              </h2>
            </div>
            <a
              href={LESSON_VIDEOS[0].href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
            >
              Ver no YouTube
            </a>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-200 bg-black dark:border-zinc-800">
            <div className="aspect-video w-full">
              <iframe
                className="h-full w-full"
                src={FEATURED_VIDEO_EMBED_URL}
                title="Aulas da Qerbie"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                Biblioteca de aulas
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Escolha uma aula
              </h2>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Aulas rápidas para conhecer os recursos mais usados da Qerbie.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {LESSON_VIDEOS.map((video, index) => (
              <article
                key={video.id}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950/60"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Aula {index + 1}
                </p>
                <h3 className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  {video.title}
                </h3>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                  {video.description}
                </p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{video.duration}</span>
                  <a
                    href={video.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-red-600 hover:underline dark:text-red-400"
                  >
                    Assistir
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
