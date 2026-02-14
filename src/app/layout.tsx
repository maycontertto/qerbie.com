import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PwaInstallPrompt, PwaServiceWorkerRegister } from "./PwaClient";

const SITE_URL = process.env.APP_URL ?? "https://www.qerbie.com";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  title: "Qerbie — Cardápio Digital e Pedidos via QR Code para Restaurantes",
  description:
    "Organize seu restaurante com cardápio digital, pedidos em tempo real e atendimento via QR Code. Funciona no celular ou computador. Teste grátis por 30 dias.",
  keywords: [
    "cardápio digital",
    "qr code restaurante",
    "pedidos online restaurante",
    "sistema para restaurante",
    "fila digital restaurante",
    "atendimento por qr code",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  verification: {
    google: "x-lzVtrLnP9adgFUUThENzUtroY1TF7rT-hChmUWnxA",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/pwa/icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/pwa/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/pwa/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/qrbie.png", type: "image/png" },
    ],
    apple: [
      { url: "/pwa/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: [
      { url: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/pwa/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/qrbie.png", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "Qerbie",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    title: "Qerbie — Cardápio Digital e Pedidos via QR Code",
    description:
      "Modernize seu atendimento com QR Code. Cardápio digital, pedidos instantâneos e organização completa para restaurantes.",
    url: "/",
    siteName: "Qerbie",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Qerbie - Cardápio Digital e Pedidos via QR Code",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Qerbie — Cardápio Digital e Pedidos via QR Code",
    description:
      "Organize seu restaurante com cardápio digital e pedidos em tempo real. Funciona no celular ou computador.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const canonical = SITE_URL.replace(/\/$/, "");

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Qerbie",
        url: canonical,
        logo: `${canonical}/qrbie.png`,
      },
      {
        "@type": "WebSite",
        name: "Qerbie",
        url: canonical,
      },
      {
        "@type": "SoftwareApplication",
        name: "Qerbie",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description:
          "Plataforma de atendimento com cardápio digital, pedidos em tempo real e QR Code para restaurantes.",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "BRL",
          description: "Teste grátis por 30 dias",
        },
      },
    ],
  };

  return (
    <html lang="pt-BR">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PwaServiceWorkerRegister />
        {children}
        <PwaInstallPrompt />
      </body>
    </html>
  );
}
