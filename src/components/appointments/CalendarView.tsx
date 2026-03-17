import { useEffect, useMemo, useState } from "react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfDay } from "date-fns"
import { el } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { fetchAppointments } from "@/services/api"
import type { AppointmentJob, Customer } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type AppointmentWithCustomer = AppointmentJob & { customer?: Customer }

type CalendarViewProps = {
  businessId: string | null
  onCreateFromDate?: (date: string) => void
}

export function CalendarView({ businessId, onCreateFromDate }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [appointments, setAppointments] = useState<AppointmentWithCustomer[]>([])
  const [statusFilter, setStatusFilter] = useState<AppointmentJob["status"] | "all">("all")

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth((d) => subMonths(d, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[180px] text-center font-medium">
            {format(currentMonth, "LLLL yyyy", { locale: el })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth((d) => addMonths(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(today)}>
            Σήμερα
          </Button>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-8 rounded-md border border-border bg-card/80 px-2 text-xs text-muted-foreground"
          >
            <option value="all">Όλες οι καταστάσεις</option>
            <option value="pending">Εκκρεμεί</option>
            <option value="confirmed">Επιβεβαιωμένο</option>
            <option value="in_progress">Σε εξέλιξη</option>
            <option value="completed">Ολοκληρώθηκε</option>
            <option value="cancelled">Ακυρώθηκε</option>
            <option value="no_show">Δεν εμφανίστηκε</option>
            <option value="rescheduled">Επανεπιλογή</option>
          </select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="grid grid-cols-7 text-center text-sm font-medium text-muted-foreground">
            {["Δευ", "Τρι", "Τετ", "Πεμ", "Παρ", "Σαβ", "Κυρ"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px">
            {padDays.map((_, i) => (
              <div key={`pad-${i}`} className="min-h-[100px] bg-muted/30 rounded p-1" />
            ))}
            {days.map((day) => {
              const dayStart = startOfDay(day)
              const isPast = dayStart < today
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
                  disabled={isPast}
                  onClick={isPast ? undefined : () => onCreateFromDate?.(format(day, "yyyy-MM-dd"))}
                  className={cn(
                    "min-h-[100px] rounded border p-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-60",
                    isSameMonth(day, currentMonth) ? loadClass : "bg-muted/20",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between gap-1">
                    <span className="text-sm font-medium">{format(day, "d")}</span>
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
                        className="text-[11px] truncate rounded px-1 py-0.5 bg-primary/10 text-primary"
                        title={a.title}
                      >
                        {a.start_time} {a.title}
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
        </CardContent>
      </Card>
    </div>
  )
}

