import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Plus, Search, Calendar, Filter } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/contexts/AuthContext"
import {
  fetchAppointments,
  fetchAppointmentById,
  fetchCustomers,
  fetchTeam,
  fetchCrews,
  fetchServices,
  updateAppointment,
  deleteAppointment,
  notifyInAppQuiet,
} from "@/services/api"
import { supabase } from "@/lib/supabase"
import type { AppointmentJob, AppointmentJobStatus } from "@/types"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate, formatCurrency, localIsoDate } from "@/lib/utils"
import { AppointmentForm } from "@/components/appointments/AppointmentForm"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { CalendarView } from "@/components/appointments/CalendarView"
import { useLanguage, type AppLanguage } from "@/contexts/LanguageContext"
import { pickLang } from "@/lib/app-language"
import type { Customer } from "@/types"
import type { User } from "@/types"
import type { Service } from "@/types"
import type { Crew } from "@/types"
function getStatusLabels(language: AppLanguage): Record<AppointmentJobStatus, string> {
  if (language === "en") {
    return {
      pending: "Pending",
      confirmed: "Confirmed",
      in_progress: "In progress",
      completed: "Completed",
      cancelled: "Cancelled",
      no_show: "No show",
      rescheduled: "Rescheduled",
    }
  }
  if (language === "de") {
    return {
      pending: "Ausstehend",
      confirmed: "Bestätigt",
      in_progress: "In Bearbeitung",
      completed: "Abgeschlossen",
      cancelled: "Storniert",
      no_show: "Nicht erschienen",
      rescheduled: "Verschoben",
    }
  }
  return {
    pending: "Εκκρεμεί",
    confirmed: "Επιβεβαιωμένο",
    in_progress: "Σε εξέλιξη",
    completed: "Ολοκληρώθηκε",
    cancelled: "Ακυρώθηκε",
    no_show: "Δεν εμφανίστηκε",
    rescheduled: "Επανεπιλογή",
  }
}

const STATUS_VARIANT: Record<AppointmentJobStatus, "pending" | "confirmed" | "inProgress" | "completed" | "cancelled" | "rescheduled"> = {
  pending: "pending",
  confirmed: "confirmed",
  in_progress: "inProgress",
  completed: "completed",
  cancelled: "cancelled",
  no_show: "cancelled",
  rescheduled: "rescheduled",
}

type AppointmentRow = AppointmentJob & {
  customer?: Customer
  assigned_user?: Pick<User, "full_name" | "email"> | null
  crew?: Pick<Crew, "id" | "name" | "color"> | null
  service?: Pick<Service, "id" | "name"> | null
}

export default function Appointments() {
  const { businessId, user } = useAuth()
  const { language } = useLanguage()
  const STATUS_LABELS = getStatusLabels(language)
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [team, setTeam] = useState<User[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [datePreset, setDatePreset] = useState<"all" | "today" | "week">("all")
  const [view, setView] = useState<"list" | "calendar">("list")
  const [editing, setEditing] = useState<AppointmentRow | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [presetDate, setPresetDate] = useState<string | null>(null)
  const [formInitial, setFormInitial] = useState<Partial<AppointmentJob> | null>(null)
  const [gapDate, setGapDate] = useState<string>(() => localIsoDate(new Date()))
  const [emptySlots, setEmptySlots] = useState<Array<{ start: string; end: string }>>([])

  useEffect(() => {
    if (!businessId) return
    const today = new Date()
    const from =
      datePreset === "today"
        ? localIsoDate(today)
        : datePreset === "week"
          ? localIsoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6))
          : undefined
    const to =
      datePreset === "today" || datePreset === "week"
        ? localIsoDate(today)
        : undefined

    Promise.all([
      fetchAppointments(businessId, {
        from,
        to,
        status: statusFilter !== "all" ? statusFilter : undefined,
      }),
      fetchCustomers(businessId),
      fetchTeam(businessId),
      fetchCrews(businessId),
      fetchServices(businessId),
    ])
      .then(([apps, cust, tm, cr, svc]) => {
        setAppointments(apps as AppointmentRow[])
        setCustomers(cust)
        setTeam(tm)
        setCrews(cr)
        setServices(svc)
      })
      .catch(() =>
        toast({
          title: pickLang(language, { el: "Σφάλμα", en: "Error", de: "Fehler" }),
          description: pickLang(language, {
            el: "Αποτυχία φόρτωσης",
            en: "Failed to load data",
            de: "Daten konnten nicht geladen werden",
          }),
          variant: "destructive",
        }),
      )
      .finally(() => setLoading(false))
  }, [businessId, datePreset, statusFilter])

  useEffect(() => {
    if (!businessId) return
    // Mark public booking notifications as seen once user opens Appointments page.
    supabase
      .from("appointments_jobs")
      .update({ public_booking_unread: false })
      .eq("business_id", businessId)
      .eq("public_booking_unread", true)
      .then(({ error }) => {
        if (error) console.warn("Failed to clear public booking unread flag:", error)
      })
  }, [businessId])

  useEffect(() => {
    const q = searchParams.get("q") ?? ""
    if (q && q !== search) setSearch(q)
  }, [searchParams])

  const openFromNotification = searchParams.get("open")

  /** Άνοιγμα ραντεβού από ειδοποίηση (?open=uuid) */
  useEffect(() => {
    if (!openFromNotification || !businessId) return
    let cancelled = false
    ;(async () => {
      const apt = await fetchAppointmentById(openFromNotification)
      if (cancelled) return
      if (!apt) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.delete("open")
            return next
          },
          { replace: true },
        )
        return
      }
      setEditing(apt as AppointmentRow)
      setDialogOpen(true)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete("open")
          return next
        },
        { replace: true },
      )
    })()
    return () => {
      cancelled = true
    }
  }, [openFromNotification, businessId, setSearchParams])

  useEffect(() => {
    if (!businessId || !gapDate) {
      setEmptySlots([])
      return
    }

    const toMinutes = (value: string) => {
      const [hh, mm] = String(value ?? "00:00").slice(0, 5).split(":").map((n) => Number(n))
      if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0
      return hh * 60 + mm
    }
    const toHHMM = (total: number) => {
      const hh = Math.floor(total / 60)
      const mm = total % 60
      return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
    }

    ;(async () => {
      try {
        const dayAppointments = (await fetchAppointments(businessId, {
          from: gapDate,
          to: gapDate,
        })) as AppointmentRow[]
        const sorted = [...dayAppointments].sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
        const WORK_START = 9 * 60
        const WORK_END = 18 * 60
        let cursor = WORK_START
        const gaps: Array<{ start: string; end: string }> = []

        for (const apt of sorted) {
          const start = Math.max(WORK_START, toMinutes(apt.start_time))
          const end = Math.min(WORK_END, toMinutes(apt.end_time))
          if (end <= WORK_START || start >= WORK_END) continue
          if (start > cursor) gaps.push({ start: toHHMM(cursor), end: toHHMM(start) })
          cursor = Math.max(cursor, end)
        }
        if (cursor < WORK_END) gaps.push({ start: toHHMM(cursor), end: toHHMM(WORK_END) })
        setEmptySlots(gaps)
      } catch {
        setEmptySlots([])
      }
    })()
  }, [businessId, gapDate])

  const filtered = appointments.filter((a) => {
    const matchSearch =
      !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      (a.customer && `${(a.customer as Customer).first_name} ${(a.customer as Customer).last_name}`.toLowerCase().includes(search.toLowerCase()))
    return matchSearch
  })

  function handleSaved() {
    if (!businessId) return
    setDialogOpen(false)
    setEditing(null)
    setFormInitial(null)
    setPresetDate(null)
    const today = new Date()
    const from =
      datePreset === "today"
        ? localIsoDate(today)
        : datePreset === "week"
          ? localIsoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6))
          : undefined
    const to =
      datePreset === "today" || datePreset === "week"
        ? localIsoDate(today)
        : undefined
    fetchAppointments(businessId, {
      from,
      to,
      status: statusFilter !== "all" ? statusFilter : undefined,
    })
      .then((data) => setAppointments(data as AppointmentRow[]))
      .catch(() =>
        toast({
          title: pickLang(language, { el: "Σφάλμα", en: "Error", de: "Fehler" }),
          description: pickLang(language, {
            el: "Αποτυχία ανανέωσης λίστας",
            en: "Failed to refresh list",
            de: "Liste konnte nicht aktualisiert werden",
          }),
          variant: "destructive",
        }),
      )
    toast({
      title: pickLang(language, { el: "Αποθηκεύτηκε", en: "Saved", de: "Gespeichert" }),
      description: pickLang(language, {
        el: "Το ραντεβού ενημερώθηκε.",
        en: "Appointment updated.",
        de: "Termin wurde aktualisiert.",
      }),
    })
  }

  async function quickUpdateStatus(a: AppointmentRow, next: AppointmentJobStatus) {
    try {
      if (!businessId) return
      const prevStatus = a.status
      await updateAppointment(a.id, { status: next })
      setAppointments((list) => list.map((x) => (x.id === a.id ? { ...x, status: next } : x)))

      const cust = a.customer
        ? `${(a.customer as Customer).first_name ?? ""} ${(a.customer as Customer).last_name ?? ""}`.trim()
        : pickLang(language, { el: "Πελάτης", en: "Customer", de: "Kunde" })
      const dateLabel = formatDate(a.scheduled_date)
      const timeLabel = (a.start_time ?? "").slice(0, 5)
      if (next === "cancelled" && prevStatus !== "cancelled") {
        void notifyInAppQuiet(
          businessId,
          `${pickLang(language, {
            el: "Ακύρωση ραντεβού",
            en: "Appointment cancellation",
            de: "Termin storniert",
          })}: ${cust} — ${dateLabel} ${timeLabel}`,
          { notificationType: "appointment_cancelled", relatedAppointmentId: a.id },
        )
      } else if (next === "no_show" && prevStatus !== "no_show") {
        void notifyInAppQuiet(
          businessId,
          `No-show: ${cust} — ${dateLabel} ${timeLabel}`,
          { notificationType: "appointment_no_show", relatedAppointmentId: a.id },
        )
      }

      toast({
        title: pickLang(language, { el: "Ενημερώθηκε", en: "Updated", de: "Aktualisiert" }),
        description: pickLang(language, {
          el: "Η κατάσταση ενημερώθηκε.",
          en: "Status updated.",
          de: "Status wurde aktualisiert.",
        }),
      })
    } catch (e) {
      toast({
        title: pickLang(language, { el: "Σφάλμα", en: "Error", de: "Fehler" }),
        description:
          e instanceof Error
            ? e.message
            : pickLang(language, {
                el: "Αποτυχία ενημέρωσης",
                en: "Failed to update",
                de: "Aktualisierung fehlgeschlagen",
              }),
        variant: "destructive",
      })
    }
  }

  const canDeleteAppointment = user && (user.role === "admin" || user.role === "super_admin")

  async function handleDeleteAppointment(a: AppointmentRow) {
    if (
      !confirm(
        pickLang(language, {
          el: `Διαγραφή ραντεβού «${a.title}» της ${a.scheduled_date};`,
          en: `Delete appointment "${a.title}" on ${a.scheduled_date}?`,
          de: `Termin „${a.title}“ am ${a.scheduled_date} löschen?`,
        }),
      )
    )
      return
    if (!businessId) return
    try {
      await deleteAppointment(a.id)
      setAppointments((prev) => prev.filter((x) => x.id !== a.id))
      toast({
        title: pickLang(language, { el: "Διαγράφηκε", en: "Deleted", de: "Gelöscht" }),
        description: pickLang(language, {
          el: "Το ραντεβού διαγράφηκε.",
          en: "Appointment deleted.",
          de: "Termin wurde gelöscht.",
        }),
      })
    } catch (e) {
      toast({
        title: pickLang(language, { el: "Σφάλμα", en: "Error", de: "Fehler" }),
        description:
          e instanceof Error
            ? e.message
            : pickLang(language, {
                el: "Αποτυχία διαγραφής",
                en: "Failed to delete",
                de: "Löschen fehlgeschlagen",
              }),
        variant: "destructive",
      })
    }
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) {
      setEditing(null)
      setFormInitial(null)
      setPresetDate(null)
    }
  }

  const completedCount = appointments.filter((a) => a.status === "completed").length
  const todayCount = appointments.filter((a) => {
    const todayIso = localIsoDate(new Date())
    return a.scheduled_date === todayIso
  }).length
  const pendingCount = appointments.filter((a) => a.status === "pending" || a.status === "confirmed").length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <div className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-r from-primary/20 via-purple-500/10 to-transparent blur-2xl" />
          <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/40 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Calendar className="h-4 w-4 text-primary" />
            {pickLang(language, {
              el: "Επιχείρηση • Ραντεβού",
              en: "Business • Appointments",
              de: "Unternehmen • Termine",
            })}
          </div>
          <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight">
            {pickLang(language, {
              el: "Ραντεβού / Εργασίες",
              en: "Appointments / Jobs",
              de: "Termine / Aufträge",
            })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {pickLang(language, {
              el: "Διαχείριση ραντεβού και work orders",
              en: "Manage appointments and work orders",
              de: "Termine und Aufträge verwalten",
            })}
          </p>
          <div className="mt-3 h-px w-full max-w-xl bg-gradient-to-r from-primary/40 via-purple-500/20 to-transparent" />
        </div>
        <Button
          onClick={() => { setEditing(null); setFormInitial(null); setDialogOpen(true); }}
          className="bg-gradient-to-r from-primary to-purple-500 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30"
        >
          <Plus className="h-4 w-4 mr-2" />
          {pickLang(language, { el: "Νέο ραντεβού", en: "New appointment", de: "Neuer Termin" })}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {pickLang(language, { el: "Σήμερα", en: "Today", de: "Heute" })}
              </p>
              <p className="text-xl font-semibold tracking-tight">{todayCount}</p>
            </div>
            <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/5">
              {pickLang(language, { el: "Ημέρα", en: "Day", de: "Tag" })}
            </Badge>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {pickLang(language, { el: "Ενεργά", en: "Active", de: "Aktiv" })}
              </p>
              <p className="text-xl font-semibold tracking-tight">{pendingCount}</p>
            </div>
            <Badge variant="outline" className="text-xs border-amber-400/40 text-amber-500 bg-amber-500/5">
              {pickLang(language, { el: "Εκκρεμή", en: "Pending", de: "Ausstehend" })}
            </Badge>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {pickLang(language, { el: "Ολοκληρωμένα", en: "Completed", de: "Abgeschlossen" })}
              </p>
              <p className="text-xl font-semibold tracking-tight">{completedCount}</p>
              {user?.business_limits?.max_appointments != null && (
                <p className="text-[11px] text-muted-foreground">
                  {/* Δεν έχουμε εδώ συνολικό count όλων των ραντεβού, οπότε δείχνουμε μόνο το όριο */}
                  {pickLang(language, { el: "Όριο πλάνου", en: "Plan limit", de: "Planlimit" })}: {user.business_limits.max_appointments}{" "}
                  {pickLang(language, { el: "ραντεβού", en: "appointments", de: "Termine" })}
                </p>
              )}
            </div>
            <Badge variant="outline" className="text-xs border-emerald-400/40 text-emerald-500 bg-emerald-500/5">
              {pickLang(language, { el: "Σήμερα & παλαιότερα", en: "Today & older", de: "Heute & älter" })}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/60">
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">
                {pickLang(language, { el: "Κενές ώρες", en: "Empty slots", de: "Freie Zeiten" })}
              </h2>
              <p className="text-xs text-muted-foreground">
                {pickLang(language, {
                  el: "Διαθέσιμα κενά μεταξύ 09:00 και 18:00.",
                  en: "Available gaps between 09:00 and 18:00.",
                  de: "Verfügbare Lücken zwischen 09:00 und 18:00.",
                })}
              </p>
            </div>
            <Input type="date" value={gapDate} onChange={(e) => setGapDate(e.target.value)} className="w-full sm:w-[180px]" />
          </div>
        </CardHeader>
        <CardContent>
          {emptySlots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {pickLang(language, {
                el: "Δεν υπάρχουν κενές ώρες για τη συγκεκριμένη ημέρα.",
                en: "No empty slots for this day.",
                de: "Für diesen Tag gibt es keine freien Zeiten.",
              })}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {emptySlots.map((slot) => (
                <Button
                  key={`${slot.start}-${slot.end}`}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(null)
                    setPresetDate(gapDate)
                    setFormInitial({
                      scheduled_date: gapDate,
                      start_time: slot.start,
                      end_time: slot.end,
                      status: "pending",
                    })
                    setDialogOpen(true)
                  }}
                >
                  {slot.start} - {slot.end}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={view} onValueChange={(v) => setView(v as "list" | "calendar")}>
        <TabsList className="bg-card/40 border border-border/50 backdrop-blur">
          <TabsTrigger value="list">{pickLang(language, { el: "Λίστα", en: "List", de: "Liste" })}</TabsTrigger>
          <TabsTrigger value="calendar">{pickLang(language, { el: "Ημερολόγιο", en: "Calendar", de: "Kalender" })}</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-4">
          <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-sm">
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    {pickLang(language, { el: "Σύνολο", en: "Total", de: "Gesamt" })}:{" "}
                    <span className="text-foreground font-medium">{filtered.length}</span>
                  </div>
                  <Badge variant="secondary" className="border border-border/50 bg-background/40 backdrop-blur">
                    {statusFilter === "all"
                      ? pickLang(language, {
                          el: "Όλες οι καταστάσεις",
                          en: "All statuses",
                          de: "Alle Status",
                        })
                      : `${pickLang(language, { el: "Κατάσταση", en: "Status", de: "Status" })}: ${STATUS_LABELS[statusFilter as AppointmentJobStatus]}`}
                  </Badge>
                </div>
                <div className="relative max-w-sm flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={pickLang(language, {
                      el: "Αναζήτηση (τίτλος, πελάτης)...",
                      en: "Search (title, customer)...",
                      de: "Suche (Titel, Kunde)...",
                    })}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-background/40 border-border/50 focus-visible:ring-primary/30"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Filter className="h-4 w-4" />
                    {pickLang(language, { el: "Φίλτρα:", en: "Filters:", de: "Filter:" })}
                  </div>
                  <Button variant={datePreset === "all" ? "secondary" : "outline"} size="sm" onClick={() => setDatePreset("all")}>
                    {pickLang(language, { el: "Όλα", en: "All", de: "Alle" })}
                  </Button>
                  <Button variant={datePreset === "today" ? "secondary" : "outline"} size="sm" onClick={() => setDatePreset("today")}>
                    {pickLang(language, { el: "Σήμερα", en: "Today", de: "Heute" })}
                  </Button>
                  <Button variant={datePreset === "week" ? "secondary" : "outline"} size="sm" onClick={() => setDatePreset("week")}>
                    {pickLang(language, { el: "7 ημέρες", en: "7 days", de: "7 Tage" })}
                  </Button>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[220px] bg-background/40 border-border/50">
                      <SelectValue placeholder={pickLang(language, { el: "Κατάσταση", en: "Status", de: "Status" })} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {pickLang(language, {
                          el: "Όλες οι καταστάσεις",
                          en: "All statuses",
                          de: "Alle Status",
                        })}
                      </SelectItem>
                      {(Object.keys(STATUS_LABELS) as AppointmentJobStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <Calendar className="h-12 w-12 mb-4 opacity-50" />
                  <p className="font-medium text-foreground/80">
                    {pickLang(language, {
                      el: "Δεν βρέθηκαν ραντεβού",
                      en: "No appointments found",
                      de: "Keine Termine gefunden",
                    })}
                  </p>
                  <p className="text-sm">
                    {pickLang(language, {
                      el: "Δημιούργησε το πρώτο ραντεβού για να ξεκινήσεις.",
                      en: "Create your first appointment to get started.",
                      de: "Legen Sie Ihren ersten Termin an, um zu starten.",
                    })}
                  </p>
                  <Button variant="outline" className="mt-4" onClick={() => { setEditing(null); setFormInitial(null); setDialogOpen(true) }}>
                    {pickLang(language, { el: "Προσθήκη ραντεβού", en: "Add appointment", de: "Termin hinzufügen" })}
                  </Button>
                </div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="md:hidden space-y-2">
                    {filtered.map((a) => (
                      <div key={a.id} className="rounded-xl border border-border/50 bg-card/40 p-4 backdrop-blur">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="text-sm font-medium">{a.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(a.scheduled_date)} • {a.start_time}–{a.end_time}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {(a.customer ? `${(a.customer as Customer).first_name} ${(a.customer as Customer).last_name}` : "—")} • {a.service?.name ?? "—"}
                            </div>
                          </div>
                          <Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABELS[a.status]}</Badge>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="text-sm">
                            {a.final_cost != null ? formatCurrency(Number(a.final_cost)) : a.cost_estimate != null ? formatCurrency(Number(a.cost_estimate)) : "—"}
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => { setEditing(a); setDialogOpen(true); }}>
                              {pickLang(language, { el: "Επεξεργασία", en: "Edit", de: "Bearbeiten" })}
                            </Button>
                            {a.status !== "confirmed" && (
                              <Button variant="outline" size="sm" onClick={() => quickUpdateStatus(a, "confirmed")}>
                                {pickLang(language, { el: "Επιβεβαίωση", en: "Confirm", de: "Bestätigen" })}
                              </Button>
                            )}
                            {a.status !== "completed" && (
                              <Button size="sm" onClick={() => { setEditing({ ...a, status: "completed" }); setDialogOpen(true) }}>
                                {pickLang(language, { el: "Ολοκλήρωση", en: "Complete", de: "Abschließen" })}
                              </Button>
                            )}
                            {canDeleteAppointment && (
                              <Button variant="destructive" size="sm" onClick={() => handleDeleteAppointment(a)}>
                                {pickLang(language, { el: "Διαγραφή", en: "Delete", de: "Löschen" })}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block rounded-xl border border-border/50 bg-card/20 overflow-x-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background/40 backdrop-blur z-10">
                        <TableRow>
                          <TableHead>{pickLang(language, { el: "Ημ/νία", en: "Date", de: "Datum" })}</TableHead>
                          <TableHead>{pickLang(language, { el: "Ώρα", en: "Time", de: "Zeit" })}</TableHead>
                          <TableHead>{pickLang(language, { el: "Τίτλος", en: "Title", de: "Titel" })}</TableHead>
                          <TableHead>{pickLang(language, { el: "Πελάτης", en: "Customer", de: "Kunde" })}</TableHead>
                          <TableHead>{pickLang(language, { el: "Υπηρεσία", en: "Service", de: "Leistung" })}</TableHead>
                          <TableHead>{pickLang(language, { el: "Ανάθεση", en: "Assigned", de: "Zuweisung" })}</TableHead>
                          <TableHead>{pickLang(language, { el: "Κατάσταση", en: "Status", de: "Status" })}</TableHead>
                          <TableHead>{pickLang(language, { el: "Κόστος", en: "Cost", de: "Kosten" })}</TableHead>
                          <TableHead>{pickLang(language, { el: "Ενέργειες", en: "Actions", de: "Aktionen" })}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((a) => (
                          <TableRow key={a.id} className="odd:bg-muted/25 hover:bg-primary/10 transition-colors">
                            <TableCell>{formatDate(a.scheduled_date)}</TableCell>
                            <TableCell>{a.start_time} - {a.end_time}</TableCell>
                            <TableCell className="font-medium">{a.title}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {a.customer ? (
                                <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
                                  {`${(a.customer as Customer).first_name?.[0] ?? ""}${(a.customer as Customer).last_name?.[0] ?? ""}`.toUpperCase()}
                                </div>
                              ) : null}
                              <span>
                                {a.customer
                                  ? `${(a.customer as Customer).first_name} ${(a.customer as Customer).last_name}`
                                  : "—"}
                              </span>
                            </div>
                          </TableCell>
                            <TableCell>{a.service?.name ?? "—"}</TableCell>
                            <TableCell>
                              {(a.crew as { name?: string })?.name ?? (a.assigned_user as { full_name?: string })?.full_name ?? "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABELS[a.status]}</Badge>
                            </TableCell>
                            <TableCell>{a.final_cost != null ? formatCurrency(Number(a.final_cost)) : a.cost_estimate != null ? formatCurrency(Number(a.cost_estimate)) : "—"}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => { setEditing(a); setDialogOpen(true); }}>
                                  {pickLang(language, { el: "Επεξεργασία", en: "Edit", de: "Bearbeiten" })}
                                </Button>
                                {a.status !== "confirmed" && (
                                  <Button variant="outline" size="sm" onClick={() => quickUpdateStatus(a, "confirmed")}>
                                    {pickLang(language, { el: "Επιβεβαίωση", en: "Confirm", de: "Bestätigen" })}
                                  </Button>
                                )}
                                {a.status !== "completed" && (
                                  <Button size="sm" onClick={() => { setEditing({ ...a, status: "completed" }); setDialogOpen(true) }}>
                                    {pickLang(language, { el: "Ολοκλήρωση", en: "Complete", de: "Abschließen" })}
                                  </Button>
                                )}
                                {canDeleteAppointment && (
                                  <Button variant="destructive" size="sm" onClick={() => handleDeleteAppointment(a)}>
                                    {pickLang(language, { el: "Διαγραφή", en: "Delete", de: "Löschen" })}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="calendar" className="mt-4">
          <CalendarView
            businessId={businessId}
            onCreateFromDate={(date) => {
              setEditing(null)
              setFormInitial(null)
              setPresetDate(date)
              setDialogOpen(true)
            }}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? pickLang(language, {
                    el: "Επεξεργασία ραντεβού",
                    en: "Edit appointment",
                    de: "Termin bearbeiten",
                  })
                : pickLang(language, {
                    el: "Νέο ραντεβού",
                    en: "New appointment",
                    de: "Neuer Termin",
                  })}
            </DialogTitle>
          </DialogHeader>
          <ErrorBoundary
            onReset={() => { setDialogOpen(false); setEditing(null); setFormInitial(null); setPresetDate(null); }}
            fallback={
              <div className="py-4">
                <p className="text-sm text-muted-foreground mb-4">
                  {pickLang(language, {
                    el: "Σφάλμα στη φόρμα. Κλείστε και δοκιμάστε ξανά.",
                    en: "Form error. Close and try again.",
                    de: "Formularfehler. Schließen und erneut versuchen.",
                  })}
                </p>
                <Button variant="outline" onClick={() => { setDialogOpen(false); setEditing(null); setFormInitial(null); setPresetDate(null); }}>
                  {pickLang(language, { el: "Κλείσιμο", en: "Close", de: "Schließen" })}
                </Button>
              </div>
            }
          >
            <AppointmentForm
              key={editing?.id ?? `${presetDate ?? "new"}-${formInitial?.start_time ?? "default"}`}
              initial={(editing ?? formInitial ?? undefined) as any}
              presetDate={presetDate ?? undefined}
              customers={customers}
              team={team}
              crews={crews}
              services={services}
              businessId={businessId}
              onSaved={handleSaved}
              onCancel={() => { setDialogOpen(false); setEditing(null); setFormInitial(null); setPresetDate(null); }}
            />
          </ErrorBoundary>
        </DialogContent>
      </Dialog>
    </div>
  )
}
