// Deploy timestamp: 2026-01-18 22:07
import "./globals.css";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import type { Metadata } from "next";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sanse Perfumes",
  description: "Aplicación privada de perfumes",
  manifest: "/manifest.webmanifest",
  themeColor: "#000000",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sanse Perfumes",
  },
  icons: {
    icon: "/logo.ico",
    apple: "/icon.png",
  },
  openGraph: {
    title: "Sanse Perfumes",
    description: "Gestión de boutique de fragancias finas.",
    images: ["/icon.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sanse Perfumes",
    description: "Gestión de boutique de fragancias finas.",
    images: ["/icon.png"],
  },
};

import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${inter.className} antialiased`}
        suppressHydrationWarning
      >
        <ServiceWorkerRegister />
        <Providers
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div suppressHydrationWarning id="app-root">
            {children}
          </div>
        </Providers>
        <Toaster richColors position="top-right" duration={3000} />
      </body>
    </html>
  );
}

