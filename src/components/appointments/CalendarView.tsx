import { useEffect, useMemo, useState } from "react"
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfDay,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
} from "date-fns"
import { el, enUS } from "date-fns/locale"
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react"
import { fetchAppointments } from "@/services/api"
import type { AppointmentJob, Customer, Crew, User } from "@/types"
import { useLanguage } from "@/contexts/LanguageContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { buildIcsCalendar, downloadIcsString, type IcsExportEvent } from "@/lib/calendarIcs"
import { cn, formatCurrency } from "@/lib/utils"

type AppointmentWithCustomer = AppointmentJob & {
  customer?: Customer
  crew?: Pick<Crew, "id" | "name" | "color"> | null
  assigned_user?: Pick<User, "full_name" | "email"> | null
}

type CalendarViewProps = {
  businessId: string | null
  onCreateFromDate?: (date: string) => void
}

const i18n = {
  el: {
    today: "Σήμερα",
    statusPlaceholder: "Φίλτρο κατάστασης",
    allStatuses: "Όλες οι καταστάσεις",
    pending: "Εκκρεμεί",
    confirmed: "Επιβεβαιωμένο",
    inProgress: "Σε εξέλιξη",
    completed: "Ολοκληρώθηκε",
    cancelled: "Ακυρώθηκε",
    noShow: "Δεν εμφανίστηκε",
    rescheduled: "Επανεπιλογή",
    swipeHint: "Σύρε οριζόντια για να δεις όλο το ημερολόγιο.",
    weekSwipeHint: "Σύρε οριζόντια για όλες τις ημέρες της εβδομάδας.",
    appointments: "ραντεβού",
    shortAppointments: "ραντ.",
    dayAppointmentsTitle: "Ραντεβού ημέρας",
    noAppointmentsDay: "Δεν υπάρχουν κλεισμένα ραντεβού για αυτή την ημέρα.",
    summary: "Σύνοψη",
    summaryHint: "υπολογισμός από `final_cost` (ή `cost_estimate` αν δεν υπάρχει).",
    total: "Σύνολο",
    noCustomer: "Χωρίς πελάτη",
    newAppointmentQuestion: "Θέλετε να κλείσετε νέο ραντεβού;",
    cannotPast: "Δεν μπορείτε να δημιουργήσετε νέο ραντεβού για προηγούμενες ημέρες.",
    canCreate: "Μπορείτε να δημιουργήσετε νέο ραντεβού για την επιλεγμένη ημέρα.",
    createNew: "Κλείσιμο νέου ραντεβού",
    monthView: "Μήνας",
    weekView: "Εβδομάδα",
    groupByLabel: "Ομαδοποίηση",
    groupByCrew: "Ανά συνεργείο",
    groupByAssignee: "Ανά υπεύθυνο",
    unassignedCrew: "Χωρίς συνεργείο",
    unassignedUser: "Χωρίς ανάθεση",
    exportToCalendarTitle: "Εισαγωγή στο ημερολόγιό μου",
    exportToCalendarButton: "Εισαγωγή στο ημερολόγιο",
    exportScopeLabel: "Τι να εισαχθεί",
    exportAllWeek: "Όλα τα ραντεβού της εβδομάδας",
    exportSectionCrews: "Συνεργεία",
    exportSectionAssignees: "Υπεύθυνοι",
    exportDownload: "Λήψη αρχείου (.ics)",
    cancel: "Άκυρο",
    exportHint:
      "Κατέβασε το αρχείο και το άνοιξε: στο iPhone (Αρχεία ή Mail) εμφανίζεται «Προσθήκη στο Ημερολόγιο». Στο Google Calendar: Ρυθμίσεις → Εισαγωγή και εξαγωγή → Εισαγωγή → επιλογή του αρχείου .ics. Τα χρώματα συνεργείου εφαρμόζονται όπου το ημερολόγιο το υποστηρίζει.",
    exportEmpty: "Δεν υπάρχουν ραντεβού για αυτή την επιλογή.",
    icsWhen: "Πότε",
    icsCustomer: "Πελάτης",
    icsCrew: "Συνεργείο",
    icsAssignee: "Υπεύθυνος",
    icsStatus: "Κατάσταση",
    dayShort: ["Δευ", "Τρι", "Τετ", "Πεμ", "Παρ", "Σαβ", "Κυρ"],
    statusShort: {
      pending: "Εκκρ.",
      confirmed: "Επιβεβ.",
      in_progress: "Σε εξέλ.",
      completed: "Ολοκλ.",
      cancelled: "Ακυρ.",
      no_show: "No show",
      rescheduled: "Re-sched",
    } as Record<AppointmentJob["status"], string>,
  },
  en: {
    today: "Today",
    statusPlaceholder: "Status filter",
    allStatuses: "All statuses",
    pending: "Pending",
    confirmed: "Confirmed",
    inProgress: "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
    noShow: "No show",
    rescheduled: "Rescheduled",
    swipeHint: "Swipe horizontally to view the whole calendar.",
    weekSwipeHint: "Swipe horizontally to see all days of the week.",
    appointments: "appointments",
    shortAppointments: "appts",
    dayAppointmentsTitle: "Day appointments",
    noAppointmentsDay: "There are no booked appointments for this day.",
    summary: "Summary",
    summaryHint: "calculated from `final_cost` (or `cost_estimate` when missing).",
    total: "Total",
    noCustomer: "No customer",
    newAppointmentQuestion: "Do you want to create a new appointment?",
    cannotPast: "You cannot create a new appointment for previous days.",
    canCreate: "You can create a new appointment for the selected day.",
    createNew: "Create new appointment",
    monthView: "Month",
    weekView: "Week",
    groupByLabel: "Group by",
    groupByCrew: "By crew",
    groupByAssignee: "By assignee",
    unassignedCrew: "No crew",
    unassignedUser: "Unassigned",
    exportToCalendarTitle: "Add to my calendar",
    exportToCalendarButton: "Add to calendar",
    exportScopeLabel: "What to import",
    exportAllWeek: "All appointments this week",
    exportSectionCrews: "Crews",
    exportSectionAssignees: "Assignees",
    exportDownload: "Download file (.ics)",
    cancel: "Cancel",
    exportHint:
      "Download the file and open it: on iPhone (Files or Mail) you can tap to add events to Calendar. In Google Calendar: Settings → Import & export → Import → select the .ics file. Crew colors apply where the calendar app supports them.",
    exportEmpty: "No appointments for this selection.",
    icsWhen: "When",
    icsCustomer: "Customer",
    icsCrew: "Crew",
    icsAssignee: "Assignee",
    icsStatus: "Status",
    dayShort: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    statusShort: {
      pending: "Pend.",
      confirmed: "Conf.",
      in_progress: "In prog.",
      completed: "Done",
      cancelled: "Canc.",
      no_show: "No show",
      rescheduled: "Re-sch.",
    } as Record<AppointmentJob["status"], string>,
  },
} as const

const weekOptions = { weekStartsOn: 1 as const }

export function CalendarView({ businessId, onCreateFromDate }: CalendarViewProps) {
  const { language } = useLanguage()
  const t = i18n[language]
  const locale = language === "en" ? enUS : el
  const [viewDate, setViewDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<"month" | "week">("month")
  const [groupBy, setGroupBy] = useState<"crew" | "assignee">("crew")
  const [appointments, setAppointments] = useState<AppointmentWithCustomer[]>([])
  const [statusFilter, setStatusFilter] = useState<AppointmentJob["status"] | "all">("all")
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [dayDialogOpen, setDayDialogOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportScope, setExportScope] = useState("all")
  const { toast } = useToast()

  useEffect(() => {
    if (!businessId) return
    const from =
      viewMode === "month"
        ? format(startOfMonth(viewDate), "yyyy-MM-dd")
        : format(startOfWeek(viewDate, weekOptions), "yyyy-MM-dd")
    const to =
      viewMode === "month"
        ? format(endOfMonth(viewDate), "yyyy-MM-dd")
        : format(endOfWeek(viewDate, weekOptions), "yyyy-MM-dd")
    fetchAppointments(businessId, { from, to }).then(setAppointments)
  }, [businessId, viewDate, viewMode])

  const monthStart = startOfMonth(viewDate)
  const monthEnd = endOfMonth(viewDate)
  const weekStart = startOfWeek(viewDate, weekOptions)
  const weekEnd = endOfWeek(viewDate, weekOptions)
  const weekDays = useMemo(
    () => eachDayOfInterval({ start: weekStart, end: weekEnd }),
    [weekStart, weekEnd],
  )
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1
  const padDays = Array(startPad).fill(null)

  const filteredAppointments = useMemo(
    () => (statusFilter === "all" ? appointments : appointments.filter((a) => a.status === statusFilter)),
    [appointments, statusFilter],
  )

  const exportTargetOptions = useMemo(() => {
    const crews = new Map<string, string>()
    const users = new Map<string, string>()
    for (const a of filteredAppointments) {
      const cid = a.crew?.id ?? "__none__"
      crews.set(cid, a.crew?.name ?? t.unassignedCrew)
    }
    for (const a of filteredAppointments) {
      const uid = a.assigned_user_id ?? "__none__"
      users.set(uid, a.assigned_user?.full_name?.trim() || t.unassignedUser)
    }
    const sortEntries = (entries: [string, string][]) =>
      [...entries].sort((a, b) => {
        if (a[0] === "__none__") return 1
        if (b[0] === "__none__") return -1
        return a[1].localeCompare(b[1], language === "en" ? "en" : "el", { sensitivity: "base" })
      })
    return {
      crewEntries: sortEntries([...crews.entries()]),
      userEntries: sortEntries([...users.entries()]),
    }
  }, [filteredAppointments, t, language])

  const getAppointmentsForDay = (date: Date) =>
    filteredAppointments.filter((a) => isSameDay(new Date(a.scheduled_date + "T12:00:00"), date))

  function dayAppointmentGroups(day: Date) {
    const dayApps = getAppointmentsForDay(day)
    const map = new Map<string, { label: string; color?: string; items: AppointmentWithCustomer[] }>()
    for (const a of dayApps) {
      if (groupBy === "crew") {
        const key = a.crew?.id ?? "__none__"
        if (!map.has(key)) {
          map.set(key, {
            label: a.crew?.name ?? t.unassignedCrew,
            color: a.crew?.color,
            items: [],
          })
        }
        map.get(key)!.items.push(a)
      } else {
        const key = a.assigned_user_id ?? "__none__"
        if (!map.has(key)) {
          map.set(key, {
            label: a.assigned_user?.full_name?.trim() || t.unassignedUser,
            color: undefined,
            items: [],
          })
        }
        map.get(key)!.items.push(a)
      }
    }
    const arr = [...map.entries()].map(([key, v]) => ({ key, ...v }))
    arr.sort((a, b) => {
      if (a.key === "__none__") return 1
      if (b.key === "__none__") return -1
      return a.label.localeCompare(b.label, language === "en" ? "en" : "el", { sensitivity: "base" })
    })
    for (const g of arr) {
      g.items.sort((x, y) => x.start_time.localeCompare(y.start_time))
    }
    return arr
  }

  const today = startOfDay(new Date())
  const selectedDayAppointments = useMemo(() => {
    if (!selectedDate) return []
    const priority: Record<AppointmentJob["status"], number> = {
      completed: 0,
      confirmed: 1,
      in_progress: 2,
      pending: 3,
      cancelled: 4,
      no_show: 4,
      rescheduled: 5,
    }

    // Premium ordering: completed first, then by start_time.
    return getAppointmentsForDay(selectedDate).sort((a, b) => {
      const pa = priority[a.status] ?? 99
      const pb = priority[b.status] ?? 99
      if (pa !== pb) return pa - pb
      return a.start_time.localeCompare(b.start_time)
    })
  }, [selectedDate, filteredAppointments])

  const selectedDayTotals = useMemo(() => {
    if (!selectedDate) return { total: 0, count: 0 }
    const rows = getAppointmentsForDay(selectedDate)
    const total = rows.reduce((sum, a) => {
      const v = a.final_cost != null ? Number(a.final_cost) : a.cost_estimate != null ? Number(a.cost_estimate) : 0
      return sum + (Number.isFinite(v) ? v : 0)
    }, 0)
    return { total, count: rows.length }
  }, [selectedDate, filteredAppointments])

  function statusBadgeVariantForDay(status: AppointmentJob["status"]): string {
    switch (status) {
      case "pending":
        return "pending"
      case "confirmed":
        return "confirmed"
      case "in_progress":
        return "inProgress"
      case "completed":
        return "completed"
      case "cancelled":
      case "no_show":
        return "cancelled"
      case "rescheduled":
        return "rescheduled"
      default:
        return "outline"
    }
  }

  function statusShort(status: AppointmentJob["status"]): string {
    return t.statusShort[status] ?? status
  }

  function statusLongLabel(status: AppointmentJob["status"]): string {
    switch (status) {
      case "pending":
        return t.pending
      case "confirmed":
        return t.confirmed
      case "in_progress":
        return t.inProgress
      case "completed":
        return t.completed
      case "cancelled":
        return t.cancelled
      case "no_show":
        return t.noShow
      case "rescheduled":
        return t.rescheduled
      default:
        return status
    }
  }

  function applyExportScope(apps: AppointmentWithCustomer[], scope: string): AppointmentWithCustomer[] {
    if (scope === "all") return apps
    if (scope.startsWith("crew:")) {
      const id = scope.slice(5)
      if (id === "__none__") return apps.filter((a) => !a.crew?.id)
      return apps.filter((a) => a.crew?.id === id)
    }
    if (scope.startsWith("user:")) {
      const id = scope.slice(5)
      if (id === "__none__") return apps.filter((a) => !a.assigned_user_id)
      return apps.filter((a) => a.assigned_user_id === id)
    }
    return apps
  }

  function icsDescription(a: AppointmentWithCustomer): string {
    const lines: string[] = []
    lines.push(`${t.icsWhen}: ${a.scheduled_date} ${a.start_time}–${a.end_time}`)
    if (a.customer) {
      lines.push(`${t.icsCustomer}: ${a.customer.first_name} ${a.customer.last_name}`)
    }
    if (a.crew?.name) {
      lines.push(`${t.icsCrew}: ${a.crew.name}`)
    }
    if (a.assigned_user?.full_name) {
      lines.push(`${t.icsAssignee}: ${a.assigned_user.full_name}`)
    }
    lines.push(`${t.icsStatus}: ${statusLongLabel(a.status)}`)
    if (a.description?.trim()) {
      lines.push(a.description.trim())
    }
    if (a.location_address?.trim()) {
      lines.push(a.location_address.trim())
    }
    return lines.join("\n")
  }

  function handleExportCalendarDownload() {
    const rows = applyExportScope(filteredAppointments, exportScope)
    if (rows.length === 0) {
      toast({ title: t.exportEmpty, variant: "destructive" })
      return
    }
    const events: IcsExportEvent[] = [...rows]
      .sort((a, b) => {
        const c = a.scheduled_date.localeCompare(b.scheduled_date)
        if (c !== 0) return c
        return a.start_time.localeCompare(b.start_time)
      })
      .map((a) => ({
        id: a.id,
        title: a.title,
        scheduled_date: a.scheduled_date,
        start_time: a.start_time,
        end_time: a.end_time,
        description: icsDescription(a),
        color: a.crew?.color ?? null,
        location: a.location_address ?? null,
      }))
    const from = format(weekStart, "yyyy-MM-dd")
    const to = format(weekEnd, "yyyy-MM-dd")
    let calName =
      (language === "en" ? "Appointments" : "Ραντεβού") + ` ${from}–${to}`
    if (exportScope !== "all") {
      if (exportScope.startsWith("crew:")) {
        const id = exportScope.slice(5)
        const label = exportTargetOptions.crewEntries.find(([k]) => k === id)?.[1]
        if (label) calName += ` — ${label}`
      } else if (exportScope.startsWith("user:")) {
        const id = exportScope.slice(5)
        const label = exportTargetOptions.userEntries.find(([k]) => k === id)?.[1]
        if (label) calName += ` — ${label}`
      }
    }
    const ics = buildIcsCalendar(events, calName)
    downloadIcsString(ics, `rantevou-${from}--${to}.ics`)
    setExportDialogOpen(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between sm:justify-start gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              setViewDate((d) => (viewMode === "month" ? subMonths(d, 1) : subWeeks(d, 1)))
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[200px] flex-1 text-center font-medium text-sm sm:text-base px-1">
            {viewMode === "month"
              ? format(viewDate, "LLLL yyyy", { locale })
              : `${format(weekStart, "d MMM", { locale })} – ${format(weekEnd, "d MMM yyyy", { locale })}`}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              setViewDate((d) => (viewMode === "month" ? addMonths(d, 1) : addWeeks(d, 1)))
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-border/60 bg-background/40 p-0.5">
              <Button
                type="button"
                variant={viewMode === "month" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 px-3"
                onClick={() => setViewMode("month")}
              >
                {t.monthView}
              </Button>
              <Button
                type="button"
                variant={viewMode === "week" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 px-3"
                onClick={() => setViewMode("week")}
              >
                {t.weekView}
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => setViewDate(new Date())} className="w-full sm:w-auto">
              {t.today}
            </Button>
          </div>
          {viewMode === "week" && (
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as "crew" | "assignee")}>
              <SelectTrigger className="h-8 w-full sm:w-[200px] bg-card/80 border-border/60">
                <SelectValue placeholder={t.groupByLabel} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="crew">{t.groupByCrew}</SelectItem>
                <SelectItem value="assignee">{t.groupByAssignee}</SelectItem>
              </SelectContent>
            </Select>
          )}
          {viewMode === "week" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-full gap-2 sm:w-auto"
              disabled={!businessId || filteredAppointments.length === 0}
              onClick={() => {
                setExportScope("all")
                setExportDialogOpen(true)
              }}
            >
              <CalendarPlus className="h-4 w-4 shrink-0" aria-hidden />
              {t.exportToCalendarButton}
            </Button>
          )}
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="h-8 w-full sm:w-[220px] bg-card/80 border-border/60">
              <SelectValue placeholder={t.statusPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.allStatuses}</SelectItem>
              <SelectItem value="pending">{t.pending}</SelectItem>
              <SelectItem value="confirmed">{t.confirmed}</SelectItem>
              <SelectItem value="in_progress">{t.inProgress}</SelectItem>
              <SelectItem value="completed">{t.completed}</SelectItem>
              <SelectItem value="cancelled">{t.cancelled}</SelectItem>
              <SelectItem value="no_show">{t.noShow}</SelectItem>
              <SelectItem value="rescheduled">{t.rescheduled}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          {viewMode === "month" ? (
            <p className="text-[11px] text-muted-foreground md:hidden">{t.swipeHint}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground md:hidden">{t.weekSwipeHint}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {viewMode === "month" ? (
            <>
              <div className="md:hidden space-y-2">
                {days.map((day) => {
                  const dayAppointments = getAppointmentsForDay(day)
                  if (dayAppointments.length === 0) return null
                  return (
                    <button
                      key={`mobile-${day.toISOString()}`}
                      type="button"
                      className="w-full rounded-lg border border-border/60 bg-card/60 p-3 text-left"
                      onClick={() => {
                        setSelectedDate(day)
                        setDayDialogOpen(true)
                      }}
                    >
                      <p className="text-sm font-medium">{format(day, "EEE dd/MM", { locale })}</p>
                      <p className="text-xs text-muted-foreground">
                        {dayAppointments.length} {t.appointments}
                      </p>
                    </button>
                  )
                })}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <div className="min-w-[680px]">
                  <div className="mb-1 grid grid-cols-7 text-center text-sm font-medium text-muted-foreground">
                    {t.dayShort.map((d) => (
                      <div key={d}>{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-px">
                    {padDays.map((_, i) => (
                      <div key={`pad-${i}`} className="min-h-[90px] sm:min-h-[100px] rounded bg-muted/30 p-1" />
                    ))}
                    {days.map((day) => {
                      const dayStart = startOfDay(day)
                      const isPast = dayStart < today
                      const isToday = isSameDay(dayStart, today)
                      const dayAppointments = getAppointmentsForDay(day)
                      const count = dayAppointments.length
                      const loadClass =
                        count === 0
                          ? "bg-card"
                          : count <= 3
                            ? "bg-emerald-500/5 border-emerald-500/20"
                            : count <= 6
                              ? "bg-amber-500/5 border-amber-500/25"
                              : "bg-red-500/5 border-red-500/25"
                      return (
                        <button
                          key={day.toISOString()}
                          type="button"
                          onClick={() => {
                            setSelectedDate(day)
                            setDayDialogOpen(true)
                          }}
                          className={cn(
                            "min-h-[90px] sm:min-h-[100px] rounded border p-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            isSameMonth(day, viewDate) ? loadClass : "bg-muted/20",
                            isPast && "opacity-80",
                            isToday && "border-primary/25 bg-primary/5 ring-2 ring-primary/60",
                          )}
                        >
                          <div className="mb-1 flex items-center justify-between gap-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="text-sm font-medium">{format(day, "d")}</span>
                              {isToday && (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                  {t.today}
                                </span>
                              )}
                            </div>
                            {count > 0 && (
                              <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                {count} {t.shortAppointments}
                              </span>
                            )}
                          </div>
                          <div className="space-y-1">
                            {dayAppointments.slice(0, 3).map((a) => (
                              <div
                                key={a.id}
                                className="flex items-center gap-2 truncate rounded bg-primary/10 px-1 py-0.5 text-[11px] text-primary"
                                title={a.title}
                              >
                                <span
                                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                                  style={{
                                    background:
                                      (a.crew as { color?: string } | null)?.color ??
                                      (a.status === "completed"
                                        ? "hsl(var(--status-completed))"
                                        : a.status === "pending"
                                          ? "hsl(var(--status-pending))"
                                          : a.status === "confirmed"
                                            ? "hsl(var(--status-confirmed))"
                                            : a.status === "in_progress"
                                              ? "hsl(var(--status-in-progress))"
                                              : a.status === "cancelled" || a.status === "no_show"
                                                ? "hsl(var(--status-cancelled))"
                                                : "hsl(var(--status-rescheduled))"),
                                  }}
                                />
                                <span className="min-w-0 truncate">
                                  {a.start_time} {a.title}
                                </span>
                              </div>
                            ))}
                            {dayAppointments.length > 3 && (
                              <div className="text-[11px] text-muted-foreground">
                                +{dayAppointments.length - 3}
                              </div>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {weekDays.map((day) => {
                  const groups = dayAppointmentGroups(day)
                  const dayStart = startOfDay(day)
                  const isToday = isSameDay(dayStart, today)
                  const total = getAppointmentsForDay(day).length
                  return (
                    <div
                      key={`mobile-week-${day.toISOString()}`}
                      className={cn(
                        "rounded-lg border border-border/60 bg-card/60 p-3",
                        isToday && "ring-2 ring-primary/40",
                      )}
                    >
                      <button
                        type="button"
                        className="flex w-full items-center justify-between text-left"
                        onClick={() => {
                          setSelectedDate(day)
                          setDayDialogOpen(true)
                        }}
                      >
                        <span className="text-sm font-medium">
                          {format(day, "EEE d MMM", { locale })}
                          {isToday ? ` · ${t.today}` : ""}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {total} {t.appointments}
                        </span>
                      </button>
                      <div className="mt-2 space-y-2 border-t border-border/40 pt-2">
                        {groups.length === 0 ? (
                          <p className="text-xs text-muted-foreground">{t.noAppointmentsDay}</p>
                        ) : (
                          groups.map((g) => (
                            <div key={g.key}>
                              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                                {groupBy === "crew" && g.color ? (
                                  <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: g.color }}
                                  />
                                ) : (
                                  <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/45" />
                                )}
                                {g.label}
                              </div>
                              <div className="space-y-1 pl-0.5">
                                {g.items.map((a) => (
                                  <div
                                    key={a.id}
                                    className="rounded border border-border/50 bg-background/40 px-2 py-1.5 text-[11px]"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <span className="font-medium text-foreground">{a.title}</span>
                                      <Badge variant="outline" className="shrink-0 text-[10px]">
                                        {a.start_time}
                                      </Badge>
                                    </div>
                                    <div className="mt-0.5 truncate text-muted-foreground">
                                      {a.customer
                                        ? `${a.customer.first_name} ${a.customer.last_name}`
                                        : t.noCustomer}
                                    </div>
                                    {groupBy === "crew" && a.assigned_user?.full_name ? (
                                      <div className="mt-0.5 truncate text-[10px] text-muted-foreground/90">
                                        {a.assigned_user.full_name}
                                      </div>
                                    ) : null}
                                    {groupBy === "assignee" && a.crew?.name ? (
                                      <div className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-muted-foreground/90">
                                        {a.crew.color ? (
                                          <span
                                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                                            style={{ backgroundColor: a.crew.color }}
                                          />
                                        ) : null}
                                        {a.crew.name}
                                      </div>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <div className="grid min-w-[920px] grid-cols-7 gap-2">
                  {weekDays.map((day) => {
                    const groups = dayAppointmentGroups(day)
                    const dayStart = startOfDay(day)
                    const isPast = dayStart < today
                    const isToday = isSameDay(dayStart, today)
                    const total = getAppointmentsForDay(day).length
                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "flex max-h-[min(70vh,560px)] flex-col rounded-lg border bg-card p-2",
                          isPast && "opacity-85",
                          isToday && "border-primary/30 ring-2 ring-primary/50",
                        )}
                      >
                        <button
                          type="button"
                          className="mb-2 flex w-full flex-col items-start gap-0.5 rounded-md px-1 py-1 text-left hover:bg-muted/50"
                          onClick={() => {
                            setSelectedDate(day)
                            setDayDialogOpen(true)
                          }}
                        >
                          <span className="text-xs font-medium text-muted-foreground">
                            {format(day, "EEE", { locale })}
                          </span>
                          <span className="text-lg font-semibold leading-none">{format(day, "d")}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {total} {t.shortAppointments}
                          </span>
                        </button>
                        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
                          {groups.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground">{t.noAppointmentsDay}</p>
                          ) : (
                            groups.map((g) => (
                              <div key={g.key} className="space-y-1">
                                <div className="flex items-center gap-1.5 border-b border-border/40 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  {groupBy === "crew" && g.color ? (
                                    <span
                                      className="h-2 w-2 shrink-0 rounded-full"
                                      style={{ backgroundColor: g.color }}
                                    />
                                  ) : (
                                    <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40" />
                                  )}
                                  <span className="min-w-0 truncate">{g.label}</span>
                                </div>
                                {g.items.map((a) => (
                                  <button
                                    key={a.id}
                                    type="button"
                                    className="w-full rounded border border-border/50 bg-background/50 p-1.5 text-left text-[11px] transition-colors hover:bg-muted/40"
                                    onClick={() => {
                                      setSelectedDate(day)
                                      setDayDialogOpen(true)
                                    }}
                                  >
                                    <div className="leading-tight font-medium">{a.start_time}</div>
                                    <div className="truncate text-foreground">{a.title}</div>
                                    <div className="truncate text-[10px] text-muted-foreground">
                                      {a.customer
                                        ? `${a.customer.first_name} ${a.customer.last_name}`
                                        : t.noCustomer}
                                    </div>
                                    {groupBy === "crew" && a.assigned_user?.full_name ? (
                                      <div className="truncate text-[10px] text-muted-foreground/90">
                                        {a.assigned_user.full_name}
                                      </div>
                                    ) : null}
                                    {groupBy === "assignee" && a.crew?.name ? (
                                      <div className="flex min-w-0 items-center gap-1 truncate text-[10px] text-muted-foreground/90">
                                        {a.crew.color ? (
                                          <span
                                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                                            style={{ backgroundColor: a.crew.color }}
                                          />
                                        ) : null}
                                        <span className="min-w-0 truncate">{a.crew.name}</span>
                                      </div>
                                    ) : null}
                                  </button>
                                ))}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <Dialog open={dayDialogOpen} onOpenChange={setDayDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t.dayAppointmentsTitle} - {selectedDate ? format(selectedDate, "dd/MM/yyyy") : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedDayAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.noAppointmentsDay}</p>
            ) : (
              <>
                <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{t.summary}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedDayTotals.count} {t.appointments} • {t.summaryHint}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{t.total}</p>
                      <p className="text-lg font-semibold tabular-nums">{formatCurrency(selectedDayTotals.total)}</p>
                    </div>
                  </div>
                </div>

                <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
                  {selectedDayAppointments.map((a) => (
                    <div key={a.id} className="rounded-md border border-border/60 bg-card/50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm font-medium">{a.title}</div>
                        <Badge variant="outline">
                          {a.start_time} - {a.end_time}
                        </Badge>
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {a.customer ? `${a.customer.first_name} ${a.customer.last_name}` : t.noCustomer}
                      </div>
                      {a.crew?.name ? (
                        <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.crew.color }} />
                          {a.crew.name}
                        </div>
                      ) : null}

                      <div className="mt-2 flex items-center justify-between gap-3">
                        <Badge variant={statusBadgeVariantForDay(a.status) as any} className="px-2 py-1">
                          {statusShort(a.status)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(Number(a.final_cost ?? a.cost_estimate ?? 0))}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="rounded-md border border-border/60 bg-background/50 p-3">
              <p className="text-sm font-medium">{t.newAppointmentQuestion}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedDate && startOfDay(selectedDate) < today
                  ? t.cannotPast
                  : t.canCreate}
              </p>
              <div className="mt-3 flex justify-end">
                <Button
                  onClick={() => {
                    if (!selectedDate) return
                    if (startOfDay(selectedDate) < today) return
                    setDayDialogOpen(false)
                    onCreateFromDate?.(format(selectedDate, "yyyy-MM-dd"))
                  }}
                  disabled={!!selectedDate && startOfDay(selectedDate) < today}
                >
                  {t.createNew}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.exportToCalendarTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t.exportHint}</p>
            <div className="space-y-2">
              <p className="text-sm font-medium">{t.exportScopeLabel}</p>
              <Select value={exportScope} onValueChange={setExportScope}>
                <SelectTrigger className="bg-card/80 border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.exportAllWeek}</SelectItem>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>{t.exportSectionCrews}</SelectLabel>
                    {exportTargetOptions.crewEntries.map(([id, name]) => (
                      <SelectItem key={`crew-${id}`} value={`crew:${id}`}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>{t.exportSectionAssignees}</SelectLabel>
                    {exportTargetOptions.userEntries.map(([id, name]) => (
                      <SelectItem key={`user-${id}`} value={`user:${id}`}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setExportDialogOpen(false)}>
                {t.cancel}
              </Button>
              <Button type="button" onClick={handleExportCalendarDownload}>
                {t.exportDownload}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

