import type { ClubIdentity } from "@/lib/club";
import { ChildSwitcher, type SwitcherChild } from "./ChildSwitcher";

/**
 * Mobile counterpart to ParentTopNav (desktop-only, `hidden md:block`) —
 * visual identity taken from the Claude Design "Espace Parent v2" mockup:
 * a navy top bar with the club crest, not the plain text block mobile had
 * before. Same information ParentTopNav already shows, nothing new.
 */
export function ParentHeaderBar({
  category,
  club,
  familyChildren,
  activePlayerId,
}: {
  category: string;
  club: ClubIdentity;
  familyChildren: SwitcherChild[];
  activePlayerId: string;
}) {
  return (
    <header className="md:hidden bg-parent-navy pt-[env(safe-area-inset-top)]">
      <div className="max-w-[560px] mx-auto flex items-center gap-3 px-4 h-16">
        {club.hasLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/club/logo?v=${club.logoVersion}`} alt="" className="w-9 h-9 rounded-lg object-contain shrink-0 bg-white/5" />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-parent-crimson shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-white text-[15px] font-bold tracking-[0.01em] uppercase truncate" style={{ fontFamily: "var(--font-parent-display)" }}>
            {club.name}
          </div>
          <div className="text-[11.5px] text-white/55 truncate">Catégorie {category} — Espace parents</div>
        </div>
        <ChildSwitcher familyChildren={familyChildren} activePlayerId={activePlayerId} variant="dark" />
      </div>
    </header>
  );
}
