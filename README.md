This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Android (TWA) / Play Store

Este repo também contém um app Android (Trusted Web Activity) em `app/`.

### Pré-requisitos

- Android SDK instalado.
- `local.properties` no root do projeto apontando para o SDK (ex.: `sdk.dir=...`).

### Assinatura (obrigatória para enviar ao Play Console)

O bundle de release precisa ser assinado com a **upload key**.

- Crie `keystore.properties` (não commitar) a partir do `keystore.properties.example` e preencha `storePassword`/`keyPassword`.
- Alternativa: defina variáveis de ambiente `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

### Gerar o bundle (AAB)

No Windows, prefira rodar via `cmd` para evitar prompts do PowerShell com `.bat`:

```bat
cmd /c ".\gradlew.bat :app:bundleRelease --console=plain"
```

Artefato gerado:

- `app/build/outputs/bundle/release/app-release.aab`
