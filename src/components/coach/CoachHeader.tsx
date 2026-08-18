function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function CoachHeader({ firstName }: { firstName: string }) {
  const today = new Date();
  return (
    <div>
      <div className="text-[22px] font-bold tracking-[-0.01em]">
        {greeting()} {firstName}
      </div>
      <div className="text-[13px] text-[#8A8D93] mt-0.5 capitalize">
        {DAY_NAMES[today.getDay()]} {today.getDate()} {MONTHS[today.getMonth()]}
      </div>
    </div>
  );
}
