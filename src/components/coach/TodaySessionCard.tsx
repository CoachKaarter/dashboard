import Link from "next/link";

export function TodaySessionCard({
  teamLabel,
  label,
  startTime,
  endTime,
  location,
  expectedCount,
  announcedPresentCount,
  announcedAbsentCount,
  noResponseCount,
  href,
}: {
  teamLabel: string;
  label: string;
  startTime: string;
  endTime: string;
  location: string;
  expectedCount: number;
  announcedPresentCount: number;
  announcedAbsentCount: number;
  noResponseCount: number;
  href: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E7E7E2] p-4 animate-fadein">
      <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-green">{teamLabel}</div>
      <div className="text-[17px] font-bold mt-0.5">{label}</div>
      <div className="text-[14px] text-[#3A3D43] font-semibold mt-1">
        {startTime} — {endTime}
      </div>
      <div className="text-[13px] text-[#6E7178] mt-0.5">{location}</div>
      <div className="text-[13px] text-[#3A3D43] font-bold mt-2">
        {expectedCount} attendu{expectedCount > 1 ? "s" : ""}
      </div>
      <div className="text-[12.5px] text-[#6E7178] mt-0.5">
        {announcedPresentCount} annoncé{announcedPresentCount > 1 ? "s" : ""} présent{announcedPresentCount > 1 ? "s" : ""} · {announcedAbsentCount}{" "}
        annoncé{announcedAbsentCount > 1 ? "s" : ""} absent{announcedAbsentCount > 1 ? "s" : ""} · {noResponseCount} sans réponse
      </div>
      <Link
        href={href}
        className="mt-3.5 h-12 rounded-xl bg-ink text-white text-[15px] font-bold flex items-center justify-center active:scale-[0.98] transition-transform duration-100"
      >
        Faire l&apos;appel
      </Link>
    </div>
  );
}
