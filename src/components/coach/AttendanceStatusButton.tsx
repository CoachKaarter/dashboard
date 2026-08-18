const CODE_TONE: Record<string, string> = { P: "#3F8F5B", R: "#C97A17", AJ: "#6E7178", ANJ: "#C4362C", B: "#C4362C" };

export function AttendanceStatusButton({
  code,
  active,
  onClick,
}: {
  code: "P" | "R" | "AJ" | "ANJ" | "B";
  active: boolean;
  onClick: () => void;
}) {
  const tone = CODE_TONE[code];
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-12 w-12 rounded-xl font-mono text-[13px] font-bold border-2 transition-all duration-150 active:scale-95 shrink-0"
      style={{
        borderColor: active ? tone : "#E3E3DE",
        backgroundColor: active ? tone : "#FFFFFF",
        color: active ? "#FFFFFF" : "#6E7178",
      }}
    >
      {code}
    </button>
  );
}
