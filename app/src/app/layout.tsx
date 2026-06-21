import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { GobMxHeader } from "@/components/GobMxHeader";
import { GobMxFooter } from "@/components/GobMxFooter";

const openSans = localFont({
  src: [
    { path: "./fonts/OpenSans-Variable.woff2", style: "normal", weight: "300 800" },
    { path: "./fonts/OpenSans-Variable-Italic.woff2", style: "italic", weight: "300 800" },
  ],
  variable: "--font-open-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CCINSHAE",
  description: "Agente de análisis de precisión de gastos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${openSans.variable} ${geistMono.variable} antialiased flex min-h-screen flex-col bg-background`}
      >
        <GobMxHeader />
        <div className="flex-1">{children}</div>
        <GobMxFooter />
      </body>
    </html>
  );
}
