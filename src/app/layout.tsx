import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { getClub } from "@/lib/club";
import { pickForeground } from "@/lib/contrast";
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

export async function generateMetadata(): Promise<Metadata> {
  const club = await getClub();
  return {
    title: `Cockpit U12/U13 — ${club.name}`,
    description: "Outil interne de pilotage de saison — catégorie U12/U13.",
  };
}

// A club's colors become CSS custom properties here — the single place
// every surface (Cockpit, Coach, Parent) renders through — rather than
// baked into the Tailwind theme, since they're a runtime/per-club value,
// not a build-time constant. Consumed as ACCENT only (nav active states,
// primary buttons) — never a wholesale recolor of the app's neutral
// surfaces, per the brief's own instruction not to turn every screen into
// a giant block of the club's color.
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const club = await getClub();
  const themeCss = `:root{--club-primary:${club.primaryColor};--club-primary-foreground:${pickForeground(club.primaryColor)};--club-secondary:${club.secondaryColor};--club-secondary-foreground:${pickForeground(club.secondaryColor)};--club-accent:${club.accentColor};--club-accent-foreground:${pickForeground(club.accentColor)};}`;

  return (
    <html lang="fr" className={`${archivo.variable} ${jetbrainsMono.variable} h-full`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      </head>
      <body className="h-full text-[13px] antialiased">{children}</body>
    </html>
  );
}
