"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type NotifItem = { id: string; title: string; body: string | null; href: string | null; read: boolean; createdAt: string };

function timeAgo(iso: string) {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  return `il y a ${Math.round(diffH / 24)} j`;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotifItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  function load() {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items ?? []);
        setUnreadCount(d.unreadCount ?? 0);
      })
      .catch(() => {});
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  function markAllRead() {
    fetch("/api/notifications", { method: "POST", body: JSON.stringify({ action: "readAll" }) }).then(load);
  }

  function openItem(item: NotifItem) {
    if (!item.read) fetch("/api/notifications", { method: "POST", body: JSON.stringify({ action: "read", id: item.id }) }).then(load);
    setOpen(false);
    if (item.href) router.push(item.href);
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
        className="relative w-8 h-8 rounded-md border border-line bg-surface flex items-center justify-center text-[15px] hover:border-ink cursor-pointer"
        title="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red text-white text-[9.5px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-[320px] bg-surface border border-line rounded-lg shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-3.5 h-10 border-b border-line-soft">
              <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">Notifications</span>
              <span className="flex-1" />
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[10.5px] text-muted-2 hover:text-ink underline">
                  tout marquer comme lu
                </button>
              )}
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              {items.length === 0 ? (
                <div className="px-4 py-8 text-center text-[12.5px] text-muted-2">Aucune notification.</div>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => openItem(n)}
                    className="w-full text-left flex items-start gap-2 px-3.5 py-2.5 border-b border-line-soft-2 last:border-b-0 hover:bg-[#FAFAF8]"
                    style={{ opacity: n.read ? 0.6 : 1 }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: n.read ? "transparent" : "#3C6E9F" }} />
                    <span className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold">{n.title}</div>
                      {n.body && <div className="text-[11px] text-muted mt-0.5 truncate">{n.body}</div>}
                      <div className="text-[10px] text-muted-2 mt-0.5">{timeAgo(n.createdAt)}</div>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
