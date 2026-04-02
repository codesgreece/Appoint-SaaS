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
      .catch(() => toast({ title: language === "en" ? "Error" : "Σφάλμα", description: language === "en" ? "Failed to load data" : "Αποτυχία φόρτωσης", variant: "destructive" }))
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
      .catch(() => toast({ title: language === "en" ? "Error" : "Σφάλμα", description: language === "en" ? "Failed to refresh list" : "Αποτυχία ανανέωσης λίστας", variant: "destructive" }))
    toast({ title: language === "en" ? "Saved" : "Αποθηκεύτηκε", description: language === "en" ? "Appointment updated." : "Το ραντεβού ενημερώθηκε." })
  }

  async function quickUpdateStatus(a: AppointmentRow, next: AppointmentJobStatus) {
    try {
      if (!businessId) return
      const prevStatus = a.status
      await updateAppointment(a.id, { status: next })
      setAppointments((list) => list.map((x) => (x.id === a.id ? { ...x, status: next } : x)))

      const cust = a.customer
        ? `${(a.customer as Customer).first_name ?? ""} ${(a.customer as Customer).last_name ?? ""}`.trim()
        : language === "en" ? "Customer" : "Πελάτης"
      const dateLabel = formatDate(a.scheduled_date)
      const timeLabel = (a.start_time ?? "").slice(0, 5)
      if (next === "cancelled" && prevStatus !== "cancelled") {
        void notifyInAppQuiet(
          businessId,
          `${language === "en" ? "Appointment cancellation" : "Ακύρωση ραντεβού"}: ${cust} — ${dateLabel} ${timeLabel}`,
          { notificationType: "appointment_cancelled", relatedAppointmentId: a.id },
        )
      } else if (next === "no_show" && prevStatus !== "no_show") {
        void notifyInAppQuiet(
          businessId,
          `No-show: ${cust} — ${dateLabel} ${timeLabel}`,
          { notificationType: "appointment_no_show", relatedAppointmentId: a.id },
        )
      }

      toast({ title: language === "en" ? "Updated" : "Ενημερώθηκε", description: language === "en" ? "Status updated." : "Η κατάσταση ενημερώθηκε." })
    } catch (e) {
      toast({ title: language === "en" ? "Error" : "Σφάλμα", description: e instanceof Error ? e.message : language === "en" ? "Failed to update" : "Αποτυχία ενημέρωσης", variant: "destructive" })
    }
  }

  const canDeleteAppointment = user && (user.role === "admin" || user.role === "super_admin")

  async function handleDeleteAppointment(a: AppointmentRow) {
    if (!confirm(language === "en" ? `Delete appointment "${a.title}" on ${a.scheduled_date}?` : `Διαγραφή ραντεβού «${a.title}» της ${a.scheduled_date};`)) return
    if (!businessId) return
    try {
      await deleteAppointment(a.id)
      setAppointments((prev) => prev.filter((x) => x.id !== a.id))
      toast({ title: language === "en" ? "Deleted" : "Διαγράφηκε", description: language === "en" ? "Appointment deleted." : "Το ραντεβού διαγράφηκε." })
    } catch (e) {
      toast({ title: language === "en" ? "Error" : "Σφάλμα", description: e instanceof Error ? e.message : language === "en" ? "Failed to delete" : "Αποτυχία διαγραφής", variant: "destructive" })
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
            {language === "en" ? "Business • Appointments" : "Επιχείρηση • Ραντεβού"}
          </div>
          <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight">
            {language === "en" ? "Appointments / Jobs" : "Ραντεβού / Εργασίες"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {language === "en" ? "Manage appointments and work orders" : "Διαχείριση ραντεβού και work orders"}
          </p>
          <div className="mt-3 h-px w-full max-w-xl bg-gradient-to-r from-primary/40 via-purple-500/20 to-transparent" />
        </div>
        <Button
          onClick={() => { setEditing(null); setFormInitial(null); setDialogOpen(true); }}
          className="bg-gradient-to-r from-primary to-purple-500 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30"
        >
          <Plus className="h-4 w-4 mr-2" />
          {language === "en" ? "New appointment" : "Νέο ραντεβού"}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{language === "en" ? "Today" : "Σήμερα"}</p>
              <p className="text-xl font-semibold tracking-tight">{todayCount}</p>
            </div>
            <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/5">
              {language === "en" ? "Day" : "Ημέρα"}
            </Badge>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{language === "en" ? "Active" : "Ενεργά"}</p>
              <p className="text-xl font-semibold tracking-tight">{pendingCount}</p>
            </div>
            <Badge variant="outline" className="text-xs border-amber-400/40 text-amber-500 bg-amber-500/5">
              {language === "en" ? "Pending" : "Εκκρεμή"}
            </Badge>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{language === "en" ? "Completed" : "Ολοκληρωμένα"}</p>
              <p className="text-xl font-semibold tracking-tight">{completedCount}</p>
              {user?.business_limits?.max_appointments != null && (
                <p className="text-[11px] text-muted-foreground">
                  {/* Δεν έχουμε εδώ συνολικό count όλων των ραντεβού, οπότε δείχνουμε μόνο το όριο */}
                  {language === "en" ? "Plan limit" : "Όριο πλάνου"}: {user.business_limits.max_appointments} {language === "en" ? "appointments" : "ραντεβού"}
                </p>
              )}
            </div>
            <Badge variant="outline" className="text-xs border-emerald-400/40 text-emerald-500 bg-emerald-500/5">
              {language === "en" ? "Today & older" : "Σήμερα & παλαιότερα"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/60">
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">{language === "en" ? "Empty slots" : "Κενές ώρες"}</h2>
              <p className="text-xs text-muted-foreground">{language === "en" ? "Available gaps between 09:00 and 18:00." : "Διαθέσιμα κενά μεταξύ 09:00 και 18:00."}</p>
            </div>
            <Input type="date" value={gapDate} onChange={(e) => setGapDate(e.target.value)} className="w-full sm:w-[180px]" />
          </div>
        </CardHeader>
        <CardContent>
          {emptySlots.length === 0 ? (
            <p className="text-sm text-muted-foreground">{language === "en" ? "No empty slots for this day." : "Δεν υπάρχουν κενές ώρες για τη συγκεκριμένη ημέρα."}</p>
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
          <TabsTrigger value="list">{language === "en" ? "List" : "Λίστα"}</TabsTrigger>
          <TabsTrigger value="calendar">{language === "en" ? "Calendar" : "Ημερολόγιο"}</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-4">
          <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-sm">
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    {language === "en" ? "Total" : "Σύνολο"}: <span className="text-foreground font-medium">{filtered.length}</span>
                  </div>
                  <Badge variant="secondary" className="border border-border/50 bg-background/40 backdrop-blur">
                    {statusFilter === "all" ? (language === "en" ? "All statuses" : "Όλες οι καταστάσεις") : `${language === "en" ? "Status" : "Κατάσταση"}: ${STATUS_LABELS[statusFilter as AppointmentJobStatus]}`}
                  </Badge>
                </div>
                <div className="relative max-w-sm flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={language === "en" ? "Search (title, customer)..." : "Αναζήτηση (τίτλος, πελάτης)..."}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-background/40 border-border/50 focus-visible:ring-primary/30"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Filter className="h-4 w-4" />
                    {language === "en" ? "Filters:" : "Φίλτρα:"}
                  </div>
                  <Button variant={datePreset === "all" ? "secondary" : "outline"} size="sm" onClick={() => setDatePreset("all")}>
                    {language === "en" ? "All" : "Όλα"}
                  </Button>
                  <Button variant={datePreset === "today" ? "secondary" : "outline"} size="sm" onClick={() => setDatePreset("today")}>
                    {language === "en" ? "Today" : "Σήμερα"}
                  </Button>
                  <Button variant={datePreset === "week" ? "secondary" : "outline"} size="sm" onClick={() => setDatePreset("week")}>
                    {language === "en" ? "7 days" : "7 ημέρες"}
                  </Button>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[220px] bg-background/40 border-border/50">
                      <SelectValue placeholder={language === "en" ? "Status" : "Κατάσταση"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{language === "en" ? "All statuses" : "Όλες οι καταστάσεις"}</SelectItem>
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
                  <p className="font-medium text-foreground/80">{language === "en" ? "No appointments found" : "Δεν βρέθηκαν ραντεβού"}</p>
                  <p className="text-sm">{language === "en" ? "Create your first appointment to get started." : "Δημιούργησε το πρώτο ραντεβού για να ξεκινήσεις."}</p>
                  <Button variant="outline" className="mt-4" onClick={() => { setEditing(null); setFormInitial(null); setDialogOpen(true) }}>
                    {language === "en" ? "Add appointment" : "Προσθήκη ραντεβού"}
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
                              {language === "en" ? "Edit" : "Επεξεργασία"}
                            </Button>
                            {a.status !== "confirmed" && (
                              <Button variant="outline" size="sm" onClick={() => quickUpdateStatus(a, "confirmed")}>
                                {language === "en" ? "Confirm" : "Επιβεβαίωση"}
                              </Button>
                            )}
                            {a.status !== "completed" && (
                              <Button size="sm" onClick={() => { setEditing({ ...a, status: "completed" }); setDialogOpen(true) }}>
                                {language === "en" ? "Complete" : "Ολοκλήρωση"}
                              </Button>
                            )}
                            {canDeleteAppointment && (
                              <Button variant="destructive" size="sm" onClick={() => handleDeleteAppointment(a)}>
                                {language === "en" ? "Delete" : "Διαγραφή"}
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
                          <TableHead>{language === "en" ? "Date" : "Ημ/νία"}</TableHead>
                          <TableHead>{language === "en" ? "Time" : "Ώρα"}</TableHead>
                          <TableHead>{language === "en" ? "Title" : "Τίτλος"}</TableHead>
                          <TableHead>{language === "en" ? "Customer" : "Πελάτης"}</TableHead>
                          <TableHead>{language === "en" ? "Service" : "Υπηρεσία"}</TableHead>
                          <TableHead>{language === "en" ? "Assigned" : "Ανάθεση"}</TableHead>
                          <TableHead>{language === "en" ? "Status" : "Κατάσταση"}</TableHead>
                          <TableHead>{language === "en" ? "Cost" : "Κόστος"}</TableHead>
                          <TableHead>{language === "en" ? "Actions" : "Ενέργειες"}</TableHead>
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
                                  {language === "en" ? "Edit" : "Επεξεργασία"}
                                </Button>
                                {a.status !== "confirmed" && (
                                  <Button variant="outline" size="sm" onClick={() => quickUpdateStatus(a, "confirmed")}>
                                    {language === "en" ? "Confirm" : "Επιβεβαίωση"}
                                  </Button>
                                )}
                                {a.status !== "completed" && (
                                  <Button size="sm" onClick={() => { setEditing({ ...a, status: "completed" }); setDialogOpen(true) }}>
                                    {language === "en" ? "Complete" : "Ολοκλήρωση"}
                                  </Button>
                                )}
                                {canDeleteAppointment && (
                                  <Button variant="destructive" size="sm" onClick={() => handleDeleteAppointment(a)}>
                                    {language === "en" ? "Delete" : "Διαγραφή"}
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
            <DialogTitle>{editing ? (language === "en" ? "Edit appointment" : "Επεξεργασία ραντεβού") : (language === "en" ? "New appointment" : "Νέο ραντεβού")}</DialogTitle>
          </DialogHeader>
          <ErrorBoundary
            onReset={() => { setDialogOpen(false); setEditing(null); setFormInitial(null); setPresetDate(null); }}
            fallback={
              <div className="py-4">
                <p className="text-sm text-muted-foreground mb-4">{language === "en" ? "Form error. Close and try again." : "Σφάλμα στη φόρμα. Κλείστε και δοκιμάστε ξανά."}</p>
                <Button variant="outline" onClick={() => { setDialogOpen(false); setEditing(null); setFormInitial(null); setPresetDate(null); }}>{language === "en" ? "Close" : "Κλείσιμο"}</Button>
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
