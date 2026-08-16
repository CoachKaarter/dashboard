import { teamTone } from "@/lib/format";
import { MonoBadge } from "@/components/ui/Badge";

export function TeamChip({ code }: { code: string }) {
  return <MonoBadge tone={teamTone(code)}>{code}</MonoBadge>;
}
