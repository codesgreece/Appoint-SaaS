import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Bell, Calendar, CreditCard, User, MessageSquare, Briefcase, BarChart3 } from "lucide-react"
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

function formatRelativeTime(iso: string): string {
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return ""
  const diff = Date.now() - d
  const sec = Math.floor(diff / 1000)
  if (sec < 45) return "τώρα"
  const min = Math.floor(sec / 60)
  if (min < 60) return `πριν ${min} λεπ.`
  const h = Math.floor(min / 60)
  if (h < 24) return `πριν ${h} ώρ.`
  const days = Math.floor(h / 24)
  if (days < 7) return `πριν ${days} ημ.`
  return new Date(iso).toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" })
}

function notificationIcon(n: InAppNotification) {
  const t = n.notification_type ?? ""
  if (n.related_appointment_id || t.startsWith("appointment")) return Calendar
  if (n.related_payment_id || t.startsWith("payment")) return CreditCard
  if (n.related_customer_id || t.includes("customer")) return User
  if (n.related_support_request_id || t.includes("support")) return MessageSquare
  if (t.includes("service") || n.metadata?.related_service_id) return Briefcase
  if (t.includes("digest") || t.includes("weekly") || t.includes("stats")) return BarChart3
  return Bell
}

function linkHint(n: InAppNotification): string | null {
  if (n.related_appointment_id) return "Άνοιγμα ραντεβού →"
  if (n.related_customer_id) return "Άνοιγμα πελάτη →"
  if (n.related_payment_id) return "Άνοιγμα πληρωμής →"
  if (n.related_support_request_id) return "Άνοιγμα αιτήματος →"
  if (typeof n.metadata?.related_service_id === "string") return "Άνοιγμα υπηρεσίας →"
  return null
}

export function NotificationBell({ businessId }: { businessId: string | null }) {
  const navigate = useNavigate()
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
    const svcId = typeof n.metadata?.related_service_id === "string" ? n.metadata.related_service_id : null
    if (n.related_appointment_id) {
      navigate(`/appointments?open=${n.related_appointment_id}`)
      setOpen(false)
    } else if (n.related_customer_id) {
      navigate(`/customers?open=${n.related_customer_id}`)
      setOpen(false)
    } else if (n.related_payment_id) {
      navigate(`/payments?payment=${n.related_payment_id}`)
      setOpen(false)
    } else if (n.related_support_request_id) {
      navigate(`/support?ticket=${n.related_support_request_id}`)
      setOpen(false)
    } else if (svcId) {
      navigate(`/services?open=${svcId}`)
      setOpen(false)
    } else if (n.notification_type?.includes("digest") || n.notification_type?.includes("weekly")) {
      navigate("/appointments")
      setOpen(false)
    }
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
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
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
            items.map((n) => {
              const Icon = notificationIcon(n)
              const hint = linkHint(n)
              const hasLink = Boolean(hint)
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => void onRowClick(n)}
                  className={cn(
                    "flex w-full gap-2 border-b border-border/50 px-3 py-2.5 text-left text-sm last:border-0 hover:bg-accent/80",
                    !n.is_read && "bg-primary/5 font-medium",
                  )}
                >
                  <span className="mt-0.5 shrink-0 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap break-words leading-snug">{n.message}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>{formatRelativeTime(n.created_at)}</span>
                      {hasLink ? <span className="text-primary">{hint}</span> : null}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
