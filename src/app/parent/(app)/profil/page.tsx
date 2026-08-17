import Link from "next/link";
import { requireParentReady } from "@/lib/parent-guard";
import { prisma } from "@/lib/prisma";
import { parentSignOutAction } from "../actions";

export default async function ParentProfilPage({ searchParams }: { searchParams: Promise<{ declared?: string }> }) {
  const parent = await requireParentReady();
  const player = await prisma.player.findUniqueOrThrow({ where: { id: parent.playerId }, include: { team: true } });
  const { declared } = await searchParams;

  return (
    <div className="flex flex-col gap-4">
      {declared === "1" && (
        <div className="bg-[#ECF5EF] border border-[#CFE6D6] rounded-xl px-3.5 py-3 text-[13px] font-medium text-[#3F8F5B]">
          ✓ Indisponibilité envoyée au staff, en attente de validation.
        </div>
      )}
      <div className="bg-white rounded-2xl border border-[#E7E7E2] p-4">
        <div className="text-lg font-bold tracking-[-0.01em]">
          {player.firstName} {player.lastName}
        </div>
        <div className="text-[13px] text-[#6E7178] mt-1">
          {player.team.category} · Saison 2026/2027
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E7E7E2] overflow-hidden">
        <div className="px-4 pt-3.5 pb-1 text-[11px] font-bold tracking-[0.08em] uppercase text-[#8A8D93]">Indisponibilité</div>
        <Link href="/parent/indisponibilite" className="flex items-center justify-between px-4 py-3.5 border-t border-[#EFEFEC] active:bg-[#FAFAF8]">
          <span className="text-[14px] font-semibold">Signaler une indisponibilité</span>
          <span className="text-[#B3B5B9]">›</span>
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-[#E7E7E2] overflow-hidden">
        <div className="px-4 pt-3.5 pb-1 text-[11px] font-bold tracking-[0.08em] uppercase text-[#8A8D93]">Compte</div>
        <Link href="/parent/changer-mot-de-passe" className="flex items-center justify-between px-4 py-3.5 border-t border-[#EFEFEC] active:bg-[#FAFAF8]">
          <span className="text-[14px] font-semibold">Modifier mon mot de passe</span>
          <span className="text-[#B3B5B9]">›</span>
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-[#E7E7E2] overflow-hidden">
        <div className="px-4 pt-3.5 pb-1 text-[11px] font-bold tracking-[0.08em] uppercase text-[#8A8D93]">Aide</div>
        <div className="px-4 py-3.5 border-t border-[#EFEFEC] text-[14px] text-[#6E7178]">
          Une question ? Contacte le staff de la catégorie.
        </div>
      </div>

      <form action={parentSignOutAction}>
        <button type="submit" className="w-full h-12 rounded-xl border border-[#E7E7E2] bg-white text-[14px] font-semibold text-[#8A8D93] active:bg-[#FAFAF8]">
          Se déconnecter
        </button>
      </form>
    </div>
  );
}
