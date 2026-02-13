import fs from "node:fs";
import path from "node:path";

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function renameIfNeeded({ from, to }) {
  if (!exists(from)) return false;
  if (exists(to)) return false;
  fs.renameSync(from, to);
  return true;
}

const repoRoot = process.cwd();

// Next.js App Router prioriza a pasta "app/" na raiz do projeto.
// Este repo também tem um módulo Android em "app/" (Gradle), e isso faz o Next
// ignorar "src/app" e servir 404 em todas as rotas.
//
// Na Vercel, o build web não precisa do módulo Android, então renomeamos
// temporariamente "app/" para liberar o Next a usar "src/app".
const isVercel = Boolean(process.env.VERCEL);
if (!isVercel) {
  process.exit(0);
}

const androidDir = path.join(repoRoot, "app");
const tempAndroidDir = path.join(repoRoot, "android-app");
const nextAppDir = path.join(repoRoot, "src", "app");

if (!exists(nextAppDir)) {
  console.log("[vercel-prebuild] src/app não encontrado; nada a fazer.");
  process.exit(0);
}

if (!exists(androidDir)) {
  console.log("[vercel-prebuild] app/ não existe; nada a fazer.");
  process.exit(0);
}

try {
  const renamed = renameIfNeeded({ from: androidDir, to: tempAndroidDir });
  if (renamed) {
    console.log("[vercel-prebuild] Renomeado app/ -> android-app/ para o build web.");
  } else {
    console.log("[vercel-prebuild] app/ já renomeado (ou android-app/ já existe).");
  }
} catch (err) {
  console.warn("[vercel-prebuild] Falha ao renomear app/ (seguindo mesmo assim):", err);
}
