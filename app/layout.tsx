import type { Metadata } from "next";
import { Archivo, Chivo_Mono } from "next/font/google";

import "./globals.css";

/**
 * Both faces are downloaded at build time and served from this origin, so no candidate's browser
 * ever talks to a font CDN. That is what lets the CSP name no third-party font host.
 *
 * Archivo is a compact grotesque: it holds a tracked-uppercase label at 11px without blurring, and
 * its numerals sit well beside the mono. Chivo Mono is used only where a scoresheet would use a
 * typewriter — move numbers, notation columns, keys, identifiers — never as a "technical" costume
 * over prose.
 */
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const chivoMono = Chivo_Mono({
  subsets: ["latin"],
  variable: "--font-chivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Engineering Developer Assessment",
  description:
    "A 21-move screening record for MERN developers working with AI coding agents. Single attempt, untimed, progress saved automatically.",
  robots: { index: false, follow: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${chivoMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-sheet text-ink antialiased">{children}</body>
    </html>
  );
}
