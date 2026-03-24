import { useCallback, useEffect, useState } from "react"
import { Bell } from "lucide-react"
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/api"
import type { InAppNotification } from "@/types"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export function NotificationBell({ businessId }: { businessId: string | null }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<InAppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const [list, n] = await Promise.all([
        fetchNotifications(businessId),
        fetchUnreadNotificationCount(businessId),
      ])
      setItems(list)
      setUnread(n)
    } catch {
      setItems([])
      setUnread(0)
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    if (!businessId) return
    void refresh()
  }, [businessId, refresh])

  useEffect(() => {
    if (!businessId) return
    const t = window.setInterval(() => void refresh(), 120000)
    return () => window.clearInterval(t)
  }, [businessId, refresh])

  useEffect(() => {
    if (open && businessId) void refresh()
  }, [open, businessId, refresh])

  async function onRowClick(n: InAppNotification) {
    if (!n.is_read) {
      try {
        await markNotificationRead(n.id)
        await refresh()
      } catch {
        // ignore
      }
    }
  }

  async function onMarkAll() {
    if (!businessId) return
    try {
      await markAllNotificationsRead(businessId)
      await refresh()
    } catch {
      // ignore
    }
  }

  if (!businessId) return null

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="relative h-9 w-9 shrink-0" aria-label="Ειδοποιήσεις">
          <Bell className="h-5 w-5" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="flex items-center justify-between gap-2 px-3 py-2">
          <span>Ειδοποιήσεις</span>
          {unread > 0 ? (
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => void onMarkAll()}>
              Σημείωση όλων
            </Button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-72 overflow-y-auto">
          {loading && items.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">Φόρτωση…</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">Δεν υπάρχουν ειδοποιήσεις.</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => void onRowClick(n)}
                className={cn(
                  "flex w-full flex-col gap-0.5 border-b border-border/50 px-3 py-2.5 text-left text-sm last:border-0 hover:bg-accent/80",
                  !n.is_read && "bg-primary/5 font-medium",
                )}
              >
                <span>{n.message}</span>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(n.created_at).toLocaleString("el-GR")}
                </span>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
