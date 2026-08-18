import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { Avatar } from "@/components/ui/Avatar";
import { ChevronRightIcon } from "@/components/coach/icons";
import { signOutAction } from "@/lib/actions/auth";

export default async function CoachProfilPage() {
  const user = await requireUser();
  const initials = user.name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <div className="bg-white rounded-2xl border border-[#E7E7E2] p-5 flex items-center gap-3.5">
        <Avatar initials={initials} size={52} />
        <div>
          <div className="text-[18px] font-bold tracking-[-0.01em]">{user.name}</div>
          <div className="text-[13px] text-[#6E7178] mt-0.5">{user.jobTitle}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E7E7E2] overflow-hidden">
        <div className="px-4 pt-3.5 pb-1 text-[11px] font-bold tracking-[0.08em] uppercase text-[#8A8D93]">Cockpit</div>
        <Link href="/" className="flex items-center justify-between px-4 py-3.5 border-t border-[#EFEFEC] active:bg-[#FAFAF8]">
          <span className="text-[14px] font-semibold">Ouvrir le Cockpit desktop</span>
          <ChevronRightIcon size={16} className="text-[#B3B5B9]" />
        </Link>
      </div>

      <form action={signOutAction}>
        <button type="submit" className="w-full h-12 rounded-xl border border-[#E7E7E2] bg-white text-[14px] font-semibold text-[#8A8D93] active:bg-[#FAFAF8]">
          Se déconnecter
        </button>
      </form>
    </div>
  );
}
