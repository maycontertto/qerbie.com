import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PwaInstallPrompt, PwaServiceWorkerRegister } from "./PwaClient";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Qerbie — Cardápio e pedidos digitais via QR Code",
  description:
    "Plataforma digital para restaurantes e comércios locais. Cardápio, pedidos e filas via QR Code.",
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
  return (
    <html lang="pt-BR">
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
