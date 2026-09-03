import { prisma } from "@/lib/prisma";
import { getAlertGroups } from "@/lib/alerts";
import { getClub } from "@/lib/club";
import { NavLink } from "@/components/NavLink";
import { CategorySwitcher } from "@/components/CategorySwitcher";
import { getAuthedUser, buildCategorySwitcherGroups } from "@/lib/authz";
import { getActiveCategoryGroup } from "@/lib/active-category";
import { signOutAction } from "@/lib/actions/auth";

export async function Sidebar() {
  const [user, club, playerCount, upcomingMatches, pendingInvitations, alertGroups] = await Promise.all([
    getAuthedUser(),
    getClub(),
    prisma.player.count(),
    prisma.match.count({ where: { status: "Planifié" } }),
    prisma.tournamentInvitation.count({ where: { status: "EN_ATTENTE" } }),
    getAlertGroups(),
  ]);
  const categoryGroups = user ? buildCategorySwitcherGroups(user) : [];
  const activeGroup = user ? await getActiveCategoryGroup(user) : null;
  const totalAlerts = alertGroups.reduce((n, g) => n + g.items.filter((i) => !i.treated).length, 0);
  const urgentCount = alertGroups.find((g) => g.key === "urgent")?.items.filter((i) => !i.treated).length ?? 0;

  const nav = [
    { href: "/", label: "Cockpit" },
    { href: "/synthese", label: "Synthèse" },
    { href: "/planning", label: "Planning" },
    { href: "/joueurs", label: "Joueurs", badge: String(playerCount) },
    { href: "/equipes", label: "Équipes" },
    { href: "/seances", label: "Séances" },
    { href: "/bibliotheque", label: "Bibliothèque" },
    { href: "/matchs", label: "Matchs", badge: String(upcomingMatches) },
    { href: "/tournois", label: "Tournois", badge: String(pendingInvitations) },
    { href: "/temps-de-jeu", label: "Temps de jeu" },
    { href: "/mesures", label: "Mesures" },
    { href: "/evaluations", label: "Évaluations" },
    { href: "/alertes", label: "Alertes", badge: String(totalAlerts), urgent: urgentCount > 0 },
    { href: "/materiel", label: "Matériel" },
    { href: "/disponibilites", label: "Disponibilités" },
    { href: "/annonces", label: "Annonces famille" },
    { href: "/week-end", label: "Week-end" },
    { href: "/wellness", label: "Wellness" },
    { href: "/staff", label: "Staff" },
    { href: "/journal", label: "Journal" },
    { href: "/parametres", label: "Paramètres" },
  ];

  const initials = (user?.name ?? "??")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <nav className="no-print w-[214px] shrink-0 bg-sidebar text-sidebar-text flex flex-col p-2.5 overflow-y-auto">
      <div className="flex items-center gap-2.5 px-2 pb-4 pt-1.5">
        {club.hasLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/club/logo?v=${club.logoVersion}`} alt="" className="w-[22px] h-[22px] rounded-[5px] object-contain shrink-0" />
        ) : (
          <div className="w-[22px] h-[22px] rounded-[5px] bg-club-primary shrink-0" />
        )}
        <div>
          {categoryGroups.length > 1 ? (
            <CategorySwitcher groups={categoryGroups} activeKey={activeGroup?.key ?? categoryGroups[0].key} />
          ) : (
            <div className="text-white font-bold text-xs tracking-[0.04em]">{categoryGroups[0]?.label ?? "—"}</div>
          )}
          <div className="text-[10px] text-muted tracking-[0.06em] truncate max-w-[150px]">{club.name.toUpperCase()}</div>
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
          <div className="text-sidebar-text-hover text-xs font-semibold truncate">{user?.name}</div>
          <div className="text-[10px] text-muted truncate">{user?.jobTitle}</div>
        </div>
        <form action={signOutAction.bind(null, "/login")}>
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
