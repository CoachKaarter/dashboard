import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Cockpit U12/U13 — Saint-Sébastien FC",
  description: "Outil interne de pilotage de saison — catégorie U12/U13.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${archivo.variable} ${jetbrainsMono.variable} h-full`}>
      <body className="h-full text-[13px] antialiased">{children}</body>
    </html>
  );
}
