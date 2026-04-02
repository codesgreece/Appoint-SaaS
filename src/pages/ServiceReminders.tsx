import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { useLanguage } from "@/contexts/LanguageContext"
import { useToast } from "@/hooks/use-toast"
import { fetchServiceReminders, updateServiceReminder } from "@/services/api"
import type { AppointmentJob, Customer, ServiceReminder } from "@/types"
import { formatDate } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type ReminderRow = ServiceReminder & {
  customer: Customer | null
  appointment_job: AppointmentJob | null
}

const remindersI18n = {
  el: {
    loadError: "Αποτυχία φόρτωσης υπενθυμίσεων.",
    statusDone: "Ολοκληρώθηκε",
    statusCancelled: "Ακυρώθηκε",
    reminderUpdateError: "Δεν ενημερώθηκε η υπενθύμιση.",
    rescheduleTitle: "Μεταφορά υπενθύμισης",
    chooseDateError: "Επίλεξε προσαρμοσμένη ημερομηνία.",
    remindAgainTitle: "Υπενθύμισε μου ξανά",
    rescheduleSuccess: "Η υπενθύμιση μεταφέρθηκε σε νέα ημερομηνία.",
    rescheduleError: "Δεν έγινε μεταφορά υπενθύμισης.",
    pageTitle: "Υπενθυμίσεις Συντήρησης",
    pageSubtitle: "Υπενθύμιση συντήρησης ανά πελάτη και επόμενο service.",
    filterPending: "Εκκρεμείς",
    filterCompleted: "Ολοκληρωμένες",
    filterOverdue: "Εκπρόθεσμες",
    listTitle: "Λίστα υπενθυμίσεων",
    loading: "Φόρτωση...",
    empty: "Δεν υπάρχουν υπενθυμίσεις για το φίλτρο που επέλεξες.",
    customerFallback: "Πελάτης",
    linkedAppointment: "Συνδεδεμένο ραντεβού",
    open: "Άνοιγμα",
    badgeOverdue: "Εκπρόθεσμη",
    badgePending: "Εκκρεμεί",
    moves: "Μεταφορές",
    actionComplete: "Ολοκληρώθηκε",
    actionReschedule: "Μεταφορά υπενθύμισης",
    actionNotInterested: "Ο πελάτης δεν ενδιαφέρεται τώρα",
    actionCancel: "Ακυρώθηκε",
    custom: "Προσαρμοσμένη",
    remindAgainPlaceholder: "Υπενθύμισε μου ξανά...",
    cancel: "Ακύρωση",
    remindAgainBtn: "Υπενθύμισε μου ξανά",
  },
  en: {
    loadError: "Failed to load reminders.",
    statusDone: "Completed",
    statusCancelled: "Cancelled",
    reminderUpdateError: "Reminder was not updated.",
    rescheduleTitle: "Reschedule reminder",
    chooseDateError: "Select a custom date.",
    remindAgainTitle: "Remind me again",
    rescheduleSuccess: "Reminder moved to a new date.",
    rescheduleError: "Could not reschedule reminder.",
    pageTitle: "Service Reminders",
    pageSubtitle: "Maintenance reminders per customer and next service.",
    filterPending: "Pending",
    filterCompleted: "Completed",
    filterOverdue: "Overdue",
    listTitle: "Reminders list",
    loading: "Loading...",
    empty: "There are no reminders for the selected filter.",
    customerFallback: "Customer",
    linkedAppointment: "Linked appointment",
    open: "Open",
    badgeOverdue: "Overdue",
    badgePending: "Pending",
    moves: "Reschedules",
    actionComplete: "Completed",
    actionReschedule: "Reschedule reminder",
    actionNotInterested: "Customer not interested now",
    actionCancel: "Cancelled",
    custom: "Custom",
    remindAgainPlaceholder: "Remind me again...",
    cancel: "Cancel",
    remindAgainBtn: "Remind me again",
  },
  de: {
    loadError: "Erinnerungen konnten nicht geladen werden.",
    statusDone: "Abgeschlossen",
    statusCancelled: "Storniert",
    reminderUpdateError: "Erinnerung wurde nicht aktualisiert.",
    rescheduleTitle: "Erinnerung verschieben",
    chooseDateError: "Bitte ein Datum wählen.",
    remindAgainTitle: "Erneut erinnern",
    rescheduleSuccess: "Erinnerung auf neues Datum verschoben.",
    rescheduleError: "Erinnerung konnte nicht verschoben werden.",
    pageTitle: "Wartungs-Erinnerungen",
    pageSubtitle: "Wartungserinnerungen pro Kunde und nächster Service.",
    filterPending: "Ausstehend",
    filterCompleted: "Abgeschlossen",
    filterOverdue: "Überfällig",
    listTitle: "Erinnerungsliste",
    loading: "Laden...",
    empty: "Keine Erinnerungen für diesen Filter.",
    customerFallback: "Kunde",
    linkedAppointment: "Verknüpfter Termin",
    open: "Öffnen",
    badgeOverdue: "Überfällig",
    badgePending: "Ausstehend",
    moves: "Verschiebungen",
    actionComplete: "Abgeschlossen",
    actionReschedule: "Erinnerung verschieben",
    actionNotInterested: "Kunde derzeit nicht interessiert",
    actionCancel: "Storniert",
    custom: "Benutzerdefiniert",
    remindAgainPlaceholder: "Erneut erinnern...",
    cancel: "Abbrechen",
    remindAgainBtn: "Erneut erinnern",
  },
} as const

function addMonthsToDate(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number)
  const base = new Date(y, (m ?? 1) - 1, d ?? 1)
  const target = new Date(base.getFullYear(), base.getMonth() + months, base.getDate())
  return target.toISOString().slice(0, 10)
}

export default function ServiceReminders() {
  const { businessId } = useAuth()
  const { language } = useLanguage()
  const t = remindersI18n[language]
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<ReminderRow[]>([])
  const [statusFilter, setStatusFilter] = useState<"pending" | "completed" | "overdue">("pending")
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [activeReminder, setActiveReminder] = useState<ReminderRow | null>(null)
  const [reschedulePreset, setReschedulePreset] = useState<"3" | "6" | "12" | "custom">("12")
  const [rescheduleCustomDate, setRescheduleCustomDate] = useState("")
  const [rescheduleNotes, setRescheduleNotes] = useState("")

  async function load() {
    if (!businessId) return
    setLoading(true)
    try {
      const data = await fetchServiceReminders(businessId)
      setRows(data as ReminderRow[])
    } catch {
      toast({ title: language === "en" ? "Error" : "Σφάλμα", description: t.loadError, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [businessId])

  const today = new Date().toISOString().slice(0, 10)

  const filtered = useMemo(() => {
    if (statusFilter === "completed") return rows.filter((r) => r.status === "completed")
    if (statusFilter === "overdue") return rows.filter((r) => r.status === "pending" && r.due_date < today)
    return rows.filter((r) => r.status === "pending")
  }, [rows, statusFilter, today])

  async function changeStatus(row: ReminderRow, status: "completed" | "cancelled") {
    try {
      await updateServiceReminder(row.id, { status })
      setRows((prev) => prev.map((x) => (x.id === row.id ? { ...x, status } : x)))
      toast({ title: status === "completed" ? t.statusDone : t.statusCancelled })
    } catch {
      toast({ title: language === "en" ? "Error" : "Σφάλμα", description: t.reminderUpdateError, variant: "destructive" })
    }
  }

  function openReschedule(row: ReminderRow) {
    setActiveReminder(row)
    setReschedulePreset("12")
    setRescheduleCustomDate("")
    setRescheduleNotes(row.notes ?? "")
    setRescheduleOpen(true)
  }

  async function submitReschedule() {
    if (!activeReminder) return
    const dueDate =
      reschedulePreset === "custom"
        ? rescheduleCustomDate
        : addMonthsToDate(activeReminder.due_date, Number(reschedulePreset))
    if (!dueDate) {
      toast({ title: t.rescheduleTitle, description: t.chooseDateError, variant: "destructive" })
      return
    }
    try {
      const nextCount = (activeReminder.rescheduled_count ?? 0) + 1
      const nowIso = new Date().toISOString()
      await updateServiceReminder(activeReminder.id, {
        due_date: dueDate,
        status: "pending",
        last_contacted_at: nowIso,
        rescheduled_count: nextCount,
        notes: rescheduleNotes.trim() || null,
      })
      setRows((prev) =>
        prev.map((x) =>
          x.id === activeReminder.id
            ? {
                ...x,
                due_date: dueDate,
                status: "pending",
                last_contacted_at: nowIso,
                rescheduled_count: nextCount,
                notes: rescheduleNotes.trim() || null,
              }
            : x,
        ),
      )
      setRescheduleOpen(false)
      setActiveReminder(null)
      toast({ title: t.remindAgainTitle, description: t.rescheduleSuccess })
    } catch {
      toast({ title: language === "en" ? "Error" : "Σφάλμα", description: t.rescheduleError, variant: "destructive" })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.pageTitle}</h1>
          <p className="text-sm text-muted-foreground">{t.pageSubtitle}</p>
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "pending" | "completed" | "overdue")}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">{t.filterPending}</SelectItem>
            <SelectItem value="completed">{t.filterCompleted}</SelectItem>
            <SelectItem value="overdue">{t.filterOverdue}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.listTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t.loading}</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.empty}</p>
          ) : (
            filtered.map((row) => {
              const isOverdue = row.status === "pending" && row.due_date < today
              return (
                <div key={row.id} className="rounded-lg border border-border/70 bg-card/60 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="font-medium">{row.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {row.customer ? `${row.customer.first_name} ${row.customer.last_name}` : t.customerFallback} • {formatDate(row.due_date)}
                      </p>
                      {row.notes ? <p className="text-sm">{row.notes}</p> : null}
                      {row.appointment_job_id ? (
                        <p className="text-xs text-muted-foreground">
                          {t.linkedAppointment}: <Link to={`/appointments?open=${row.appointment_job_id}`} className="underline">{row.appointment_job?.title ?? t.open}</Link>
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={row.status === "completed" ? "completed" : row.status === "cancelled" ? "cancelled" : "pending"}>
                        {row.status === "completed" ? t.statusDone : row.status === "cancelled" ? t.statusCancelled : isOverdue ? t.badgeOverdue : t.badgePending}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{t.moves}: {row.rescheduled_count}</span>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                    {row.status !== "completed" && (
                      <Button size="sm" onClick={() => void changeStatus(row, "completed")}>{t.actionComplete}</Button>
                    )}
                    {row.status !== "cancelled" && (
                      <Button size="sm" variant="outline" onClick={() => openReschedule(row)}>{t.actionReschedule}</Button>
                    )}
                    {row.status !== "cancelled" && (
                      <Button size="sm" variant="outline" onClick={() => openReschedule(row)}>{t.actionNotInterested}</Button>
                    )}
                    {row.status !== "cancelled" && (
                      <Button size="sm" variant="destructive" onClick={() => void changeStatus(row, "cancelled")}>{t.actionCancel}</Button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.rescheduleTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={reschedulePreset === "3" ? "default" : "outline"} onClick={() => setReschedulePreset("3")}>+3 μήνες</Button>
              <Button type="button" size="sm" variant={reschedulePreset === "6" ? "default" : "outline"} onClick={() => setReschedulePreset("6")}>+6 μήνες</Button>
              <Button type="button" size="sm" variant={reschedulePreset === "12" ? "default" : "outline"} onClick={() => setReschedulePreset("12")}>+12 μήνες</Button>
              <Button type="button" size="sm" variant={reschedulePreset === "custom" ? "default" : "outline"} onClick={() => setReschedulePreset("custom")}>{t.custom}</Button>
            </div>
            {reschedulePreset === "custom" && (
              <div className="space-y-1">
                <Input type="date" value={rescheduleCustomDate} onChange={(e) => setRescheduleCustomDate(e.target.value)} />
              </div>
            )}
            <div className="space-y-1">
              <Textarea value={rescheduleNotes} onChange={(e) => setRescheduleNotes(e.target.value)} placeholder={t.remindAgainPlaceholder} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRescheduleOpen(false)}>{t.cancel}</Button>
              <Button type="button" onClick={() => void submitReschedule()}>{t.remindAgainBtn}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
