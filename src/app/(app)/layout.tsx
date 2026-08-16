import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { formatToday } from "@/lib/format";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const todayLabel = formatToday(new Date());

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-ink">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <Header todayLabel={todayLabel} />
        <div className="flex-1 overflow-auto px-[22px] pt-5 pb-10">{children}</div>
      </main>
    </div>
  );
}
