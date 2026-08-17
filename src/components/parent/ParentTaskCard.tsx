import { ParentCard } from "./ParentCard";

export function ParentTaskCard({
  kicker,
  title,
  detail,
  children,
  accent = "neutral",
}: {
  kicker: string;
  title: string;
  detail?: string;
  children: React.ReactNode;
  accent?: "neutral" | "player";
}) {
  return (
    <ParentCard className={accent === "player" ? "border-[#E4D9BE] bg-[#FFFCF6]" : ""}>
      <div
        className={`text-[11px] font-bold tracking-[0.08em] uppercase ${accent === "player" ? "text-[#B08A3E]" : "text-[#8A8D93]"}`}
      >
        {kicker}
      </div>
      <div className="text-[15px] font-bold mt-0.5">{title}</div>
      {detail && <div className="text-[13px] text-[#6E7178] mt-0.5">{detail}</div>}
      <div className="mt-3">{children}</div>
    </ParentCard>
  );
}
