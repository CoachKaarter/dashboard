import Link from "next/link";
import { requireParentReady } from "@/lib/parent-guard";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/ui/Avatar";
import { ParentStatusBanner } from "@/components/parent/ParentStatusBanner";
import { ChevronRightIcon } from "@/components/parent/icons";
import { parentSignOutAction } from "../actions";

export default async function ParentProfilPage({ searchParams }: { searchParams: Promise<{ declared?: string }> }) {
  const parent = await requireParentReady();
  const player = await prisma.player.findUniqueOrThrow({ where: { id: parent.playerId } });
  const { declared } = await searchParams;

  return (
    <div className="flex flex-col gap-4 animate-fadein">
      {declared === "1" && (
        <ParentStatusBanner tone="success" title="Information envoyée" detail="Le staff va vérifier la déclaration." />
      )}

      <div className="bg-white rounded-2xl border border-[#E7E7E2] p-5 flex items-center gap-3.5">
        <Avatar initials={`${player.firstName[0]}${player.lastName[0]}`} size={52} />
        <div>
          <div className="text-[18px] font-bold tracking-[-0.01em]">
            {player.firstName} {player.lastName}
          </div>
          <div className="text-[13px] text-[#6E7178] mt-0.5">
            {player.category} · Saison 2026 / 2027
          </div>
        </div>
      </div>

      <ProfilGroup title="Santé & disponibilité">
        <ProfilRow href="/parent/indisponibilite" label="Signaler une blessure ou indisponibilité longue" />
      </ProfilGroup>

      <ProfilGroup title="Compte">
        <ProfilRow href="/parent/changer-mot-de-passe" label="Modifier mon mot de passe" />
      </ProfilGroup>

      <ProfilGroup title="Aide">
        <div className="px-4 py-3.5 text-[14px] text-[#6E7178]">Une question ? Contacte le staff de la catégorie.</div>
      </ProfilGroup>

      <form action={parentSignOutAction}>
        <button type="submit" className="w-full h-12 rounded-xl border border-[#E7E7E2] bg-white text-[14px] font-semibold text-[#8A8D93] active:bg-[#FAFAF8]">
          Se déconnecter
        </button>
      </form>
    </div>
  );
}

function ProfilGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E7E7E2] overflow-hidden">
      <div className="px-4 pt-3.5 pb-1 text-[11px] font-bold tracking-[0.08em] uppercase text-[#8A8D93]">{title}</div>
      {children}
    </div>
  );
}

function ProfilRow({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="group flex items-center justify-between px-4 py-3.5 border-t border-[#EFEFEC] active:bg-[#FAFAF8] transition-colors duration-100">
      <span className="text-[14px] font-semibold">{label}</span>
      <ChevronRightIcon size={16} className="text-[#B3B5B9] transition-transform duration-150 group-active:translate-x-0.5" />
    </Link>
  );
}
