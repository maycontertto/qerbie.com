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
  title: "Qerbie — Plataforma de atendimento com QR Code",
  description:
    "Qerbie é uma plataforma de atendimento para restaurantes e comércios locais: cardápio digital, pedidos e filas via QR Code.",
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
    apple: [{ url: "/pwa/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
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
    title: "Qerbie — Plataforma de atendimento com QR Code",
    description:
      "Plataforma de atendimento para restaurantes e comércios locais: cardápio digital, pedidos e filas via QR Code.",
    url: "/",
    siteName: "Qerbie",
  },
  twitter: {
    card: "summary_large_image",
    title: "Qerbie — Plataforma de atendimento com QR Code",
    description:
      "Plataforma de atendimento para restaurantes e comércios locais: cardápio digital, pedidos e filas via QR Code.",
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
    ],
  };

  return (
    <html lang="pt-BR">
      <head>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
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
