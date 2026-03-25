import { useEffect, useMemo, useState } from "react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfDay } from "date-fns"
import { el } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { fetchAppointments } from "@/services/api"
import type { AppointmentJob, Customer } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn, formatCurrency } from "@/lib/utils"

type AppointmentWithCustomer = AppointmentJob & { customer?: Customer }

type CalendarViewProps = {
  businessId: string | null
  onCreateFromDate?: (date: string) => void
}

export function CalendarView({ businessId, onCreateFromDate }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [appointments, setAppointments] = useState<AppointmentWithCustomer[]>([])
  const [statusFilter, setStatusFilter] = useState<AppointmentJob["status"] | "all">("all")
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [dayDialogOpen, setDayDialogOpen] = useState(false)

  useEffect(() => {
    if (!businessId) return
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    fetchAppointments(businessId, {
      from: format(start, "yyyy-MM-dd"),
      to: format(end, "yyyy-MM-dd"),
    }).then(setAppointments)
  }, [businessId, currentMonth])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1
  const padDays = Array(startPad).fill(null)

  const filteredAppointments = useMemo(
    () => (statusFilter === "all" ? appointments : appointments.filter((a) => a.status === statusFilter)),
    [appointments, statusFilter],
  )

  const getAppointmentsForDay = (date: Date) =>
    filteredAppointments.filter((a) => isSameDay(new Date(a.scheduled_date + "T12:00:00"), date))

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
    switch (status) {
      case "pending":
        return "Εκκρ."
      case "confirmed":
        return "Επιβεβ."
      case "in_progress":
        return "Σε εξέλ."
      case "completed":
        return "Ολοκλ."
      case "cancelled":
        return "Ακυρ."
      case "no_show":
        return "No show"
      case "rescheduled":
        return "Re-sched"
      default:
        return status
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between sm:justify-start gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth((d) => subMonths(d, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[180px] text-center font-medium text-sm sm:text-base">
            {format(currentMonth, "LLLL yyyy", { locale: el })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth((d) => addMonths(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(today)} className="w-full sm:w-auto">
            Σήμερα
          </Button>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="h-8 w-full sm:w-[220px] bg-card/80 border-border/60">
              <SelectValue placeholder="Φίλτρο κατάστασης" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Όλες οι καταστάσεις</SelectItem>
              <SelectItem value="pending">Εκκρεμεί</SelectItem>
              <SelectItem value="confirmed">Επιβεβαιωμένο</SelectItem>
              <SelectItem value="in_progress">Σε εξέλιξη</SelectItem>
              <SelectItem value="completed">Ολοκληρώθηκε</SelectItem>
              <SelectItem value="cancelled">Ακυρώθηκε</SelectItem>
              <SelectItem value="no_show">Δεν εμφανίστηκε</SelectItem>
              <SelectItem value="rescheduled">Επανεπιλογή</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <p className="text-[11px] text-muted-foreground md:hidden">
            Σύρε οριζόντια για να δεις όλο το ημερολόγιο.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
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
                  <p className="text-sm font-medium">{format(day, "EEE dd/MM", { locale: el })}</p>
                  <p className="text-xs text-muted-foreground">{dayAppointments.length} ραντεβού</p>
                </button>
              )
            })}
          </div>
          <div className="hidden overflow-x-auto md:block">
          <div className="min-w-[680px]">
            <div className="grid grid-cols-7 text-center text-sm font-medium text-muted-foreground mb-1">
              {["Δευ", "Τρι", "Τετ", "Πεμ", "Παρ", "Σαβ", "Κυρ"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px">
              {padDays.map((_, i) => (
                <div key={`pad-${i}`} className="min-h-[90px] sm:min-h-[100px] bg-muted/30 rounded p-1" />
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
                      isSameMonth(day, currentMonth) ? loadClass : "bg-muted/20",
                      isPast && "opacity-80",
                      isToday && "ring-2 ring-primary/60 border-primary/25 bg-primary/5",
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between gap-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium">{format(day, "d")}</span>
                        {isToday && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            Today
                          </span>
                        )}
                      </div>
                      {count > 0 && (
                        <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {count} ραντ.
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {dayAppointments.slice(0, 3).map((a) => (
                        <div
                          key={a.id}
                          className="text-[11px] truncate rounded px-1 py-0.5 bg-primary/10 text-primary flex items-center gap-2"
                          title={a.title}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{
                              background:
                                a.status === "completed"
                                  ? "hsl(var(--status-completed))"
                                  : a.status === "pending"
                                    ? "hsl(var(--status-pending))"
                                    : a.status === "confirmed"
                                      ? "hsl(var(--status-confirmed))"
                                      : a.status === "in_progress"
                                        ? "hsl(var(--status-in-progress))"
                                        : a.status === "cancelled" || a.status === "no_show"
                                          ? "hsl(var(--status-cancelled))"
                                          : "hsl(var(--status-rescheduled))",
                            }}
                          />
                          <span className="min-w-0 truncate">
                            {a.start_time} {a.title}
                          </span>
                        </div>
                      ))}
                      {dayAppointments.length > 3 && (
                        <div className="text-[11px] text-muted-foreground">+{dayAppointments.length - 3}</div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
          </div>
        </CardContent>
      </Card>
      <Dialog open={dayDialogOpen} onOpenChange={setDayDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Ραντεβού ημέρας - {selectedDate ? format(selectedDate, "dd/MM/yyyy") : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedDayAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Δεν υπάρχουν κλεισμένα ραντεβού για αυτή την ημέρα.</p>
            ) : (
              <>
                <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Σύνοψη</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedDayTotals.count} ραντεβού • υπολογισμός από `final_cost` (ή `cost_estimate` αν δεν υπάρχει).
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Σύνολο</p>
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
                        {a.customer ? `${a.customer.first_name} ${a.customer.last_name}` : "Χωρίς πελάτη"}
                      </div>

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
              <p className="text-sm font-medium">Θέλετε να κλείσετε νέο ραντεβού;</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedDate && startOfDay(selectedDate) < today
                  ? "Δεν μπορείτε να δημιουργήσετε νέο ραντεβού για προηγούμενες ημέρες."
                  : "Μπορείτε να δημιουργήσετε νέο ραντεβού για την επιλεγμένη ημέρα."}
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
                  Κλείσιμο νέου ραντεβού
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

