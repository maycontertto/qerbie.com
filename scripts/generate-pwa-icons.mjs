import path from "node:path";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const inputPath = path.resolve("public", "qrbie logo.png");
const outDir = path.resolve("public", "pwa");

await mkdir(outDir, { recursive: true });

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const darkBg = { r: 9, g: 9, b: 11, alpha: 1 }; // ~zinc-950
const lightBg = { r: 255, g: 255, b: 255, alpha: 1 };

async function getBaseImage() {
  // Remove padding/transparent borders to maximize logo visibility.
  // `trim` can be sensitive; use a low threshold to avoid cropping real edges.
  return sharp(inputPath).trim({ threshold: 5 });
}

async function chooseOpaqueBackground() {
  // Estimate the logo brightness (ignoring transparent padding).
  const base = await getBaseImage();
  const stats = await base.removeAlpha().stats();
  const [r, g, b] = stats.channels;
  const lum = 0.2126 * r.mean + 0.7152 * g.mean + 0.0722 * b.mean;

  // If logo is light, use dark background; if logo is dark, use light background.
  return lum > 150 ? darkBg : lightBg;
}

async function makeIcon({ size, outFile, background = transparent, fit = "contain" }) {
  const base = await getBaseImage();
  await base
    .resize(size, size, { fit, background })
    .png()
    .toFile(path.join(outDir, outFile));
}

// Favicons / small icons
await makeIcon({ size: 16, outFile: "icon-16.png" });
await makeIcon({ size: 32, outFile: "icon-32.png" });
await makeIcon({ size: 64, outFile: "icon-64.png" });

// Standard PWA icons
await makeIcon({ size: 128, outFile: "icon-128.png" });
await makeIcon({ size: 192, outFile: "icon-192.png" });
await makeIcon({ size: 256, outFile: "icon-256.png" });
await makeIcon({ size: 512, outFile: "icon-512.png" });

const opaqueBg = await chooseOpaqueBackground();

// iOS touch icon (opaque background is safer)
await makeIcon({ size: 180, outFile: "apple-touch-icon.png", background: opaqueBg });

// Maskable icon: add padding so it doesn't clip in circles
const base = await getBaseImage();

await base
  // Keep content inside safe area (~70% of the canvas)
  .resize(320, 320, { fit: "contain", background: opaqueBg })
  .extend({
    top: 96,
    bottom: 96,
    left: 96,
    right: 96,
    background: opaqueBg,
  })
  .resize(512, 512, { fit: "cover" })
  .png()
  .toFile(path.join(outDir, "maskable-512.png"));

console.log("PWA icons generated in public/pwa");
