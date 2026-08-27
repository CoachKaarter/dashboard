import Link from "next/link";
import { requireParent } from "@/lib/parent-session";
import { ParentPageHeader } from "@/components/parent/ParentPageHeader";
import { ParentCard } from "@/components/parent/ParentCard";
import { CalendarIcon, ClipboardIcon, UsersIcon, BellIcon, ChevronRightIcon } from "@/components/parent/icons";

const FEATURES = [
  {
    icon: CalendarIcon,
    title: "Planning de la semaine",
    desc: "Les entraînements et rencontres à venir, toujours à jour. Tu vois d'un coup d'œil ce qui arrive.",
  },
  {
    icon: ClipboardIcon,
    title: "Convocations",
    desc: "Une fois ton enfant convoqué pour un match, la fiche complète s'ouvre : horaires, lieu, tenue, transport — tout au même endroit.",
  },
  {
    icon: UsersIcon,
    title: "Présences",
    desc: "Réponds simplement « Disponible » ou « Indisponible » avant chaque semaine pour aider le staff à s'organiser.",
  },
  {
    icon: BellIcon,
    title: "Infos du club",
    desc: "Annonces, rappels et informations importantes publiées par le staff — tu ne rates rien.",
  },
] as const;

export default async function BienvenuePage() {
  const parent = await requireParent();

  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <ParentPageHeader title={`Bienvenue dans l'espace de ${parent.player.firstName}`} subtitle="Voici comment fonctionne l'espace famille." />

      <ParentCard>
        <div className="flex flex-col gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-parent-navy/8 flex items-center justify-center shrink-0 text-parent-navy">
                <f.icon size={19} />
              </div>
              <div>
                <div className="font-bold text-[14.5px]">{f.title}</div>
                <div className="text-[#6E7178] text-[13px] mt-0.5 leading-snug">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </ParentCard>

      <ParentCard>
        <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#9A9DA3] mb-2.5">Disponibilité ≠ convocation</div>
        <div className="flex flex-col gap-2.5">
          <Step n={1} text="Tu réponds « Disponible » ou « Indisponible » pour un week-end — c'est juste une information pour le staff." />
          <Step n={2} text="Le staff choisit ensuite les joueurs convoqués parmi les disponibles — répondre « Disponible » ne veut pas encore dire que ton enfant joue." />
          <Step n={3} text="Une fois convoqué, la fiche complète du match s'ouvre automatiquement dans « Rencontres à venir », avec tous les détails pratiques." />
        </div>
      </ParentCard>

      <Link
        href="/parent"
        className="h-12 rounded-xl bg-parent-navy text-white text-[15px] font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all duration-150"
      >
        Découvrir mon espace
        <ChevronRightIcon size={17} />
      </Link>
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-5 h-5 rounded-full bg-parent-navy text-white text-[10.5px] font-bold flex items-center justify-center shrink-0 mt-0.5">{n}</div>
      <div className="text-[13px] text-[#3A3D43] leading-snug">{text}</div>
    </div>
  );
}
