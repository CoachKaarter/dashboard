import { prisma } from "@/lib/prisma";
import { getAlertGroups } from "@/lib/alerts";
import { NavLink } from "@/components/NavLink";
import { auth } from "@/auth";
import { signOutAction } from "@/lib/actions/auth";

export async function Sidebar() {
  const session = await auth();
  const [playerCount, upcomingMatches, alertGroups] = await Promise.all([
    prisma.player.count(),
    prisma.match.count({ where: { status: "Planifié" } }),
    getAlertGroups(),
  ]);
  const totalAlerts = alertGroups.reduce((n, g) => n + g.items.filter((i) => !i.treated).length, 0);
  const urgentCount = alertGroups.find((g) => g.key === "urgent")?.items.filter((i) => !i.treated).length ?? 0;

  const nav = [
    { href: "/", label: "Cockpit" },
    { href: "/synthese", label: "Synthèse" },
    { href: "/planning", label: "Planning" },
    { href: "/joueurs", label: "Joueurs", badge: String(playerCount) },
    { href: "/equipes", label: "Équipes" },
    { href: "/seances", label: "Séances" },
    { href: "/matchs", label: "Matchs", badge: String(upcomingMatches) },
    { href: "/temps-de-jeu", label: "Temps de jeu" },
    { href: "/evaluations", label: "Évaluations" },
    { href: "/alertes", label: "Alertes", badge: String(totalAlerts), urgent: urgentCount > 0 },
    { href: "/materiel", label: "Matériel" },
    { href: "/disponibilites", label: "Disponibilités" },
    { href: "/wellness", label: "Wellness" },
    { href: "/staff", label: "Staff" },
    { href: "/journal", label: "Journal" },
    { href: "/parametres", label: "Paramètres" },
  ];

  const initials = (session?.user?.name ?? "??")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <nav className="no-print w-[214px] shrink-0 bg-sidebar text-sidebar-text flex flex-col p-2.5 overflow-y-auto">
      <div className="flex items-center gap-2.5 px-2 pb-4 pt-1.5">
        <div className="w-[22px] h-[22px] rounded-[5px] bg-green shrink-0" />
        <div>
          <div className="text-white font-bold text-xs tracking-[0.04em]">U12 / U13</div>
          <div className="text-[10px] text-muted tracking-[0.06em]">SAINT-SÉBASTIEN FC</div>
        </div>
      </div>

      {nav.map((item) => (
        <NavLink key={item.href} href={item.href} label={item.label} badge={item.badge} badgeUrgent={item.urgent} />
      ))}

      <div className="mt-auto pt-3 px-2 pb-1 border-t border-sidebar-active flex items-center gap-2.5">
        <div className="w-[26px] h-[26px] rounded-full bg-sidebar-active text-sidebar-text-hover flex items-center justify-center text-[11px] font-bold">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sidebar-text-hover text-xs font-semibold truncate">{session?.user?.name}</div>
          <div className="text-[10px] text-muted truncate">{session?.user?.jobTitle}</div>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            title="Se déconnecter"
            className="bg-transparent border-none text-muted hover:text-red cursor-pointer text-sm px-1 py-0.5"
          >
            ⏻
          </button>
        </form>
      </div>
    </nav>
  );
}
