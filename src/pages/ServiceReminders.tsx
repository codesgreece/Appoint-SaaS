import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
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

function addMonthsToDate(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number)
  const base = new Date(y, (m ?? 1) - 1, d ?? 1)
  const target = new Date(base.getFullYear(), base.getMonth() + months, base.getDate())
  return target.toISOString().slice(0, 10)
}

export default function ServiceReminders() {
  const { businessId } = useAuth()
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
      toast({ title: "Σφάλμα", description: "Αποτυχία φόρτωσης υπενθυμίσεων.", variant: "destructive" })
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
      toast({ title: status === "completed" ? "Ολοκληρώθηκε" : "Ακυρώθηκε" })
    } catch {
      toast({ title: "Σφάλμα", description: "Δεν ενημερώθηκε η υπενθύμιση.", variant: "destructive" })
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
      toast({ title: "Μεταφορά υπενθύμισης", description: "Επίλεξε προσαρμοσμένη ημερομηνία.", variant: "destructive" })
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
      toast({ title: "Υπενθύμισε μου ξανά", description: "Η υπενθύμιση μεταφέρθηκε σε νέα ημερομηνία." })
    } catch {
      toast({ title: "Σφάλμα", description: "Δεν έγινε μεταφορά υπενθύμισης.", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Υπενθυμίσεις Συντήρησης</h1>
          <p className="text-sm text-muted-foreground">Υπενθύμιση συντήρησης ανά πελάτη και επόμενο service.</p>
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "pending" | "completed" | "overdue")}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Εκκρεμείς</SelectItem>
            <SelectItem value="completed">Ολοκληρωμένες</SelectItem>
            <SelectItem value="overdue">Εκπρόθεσμες</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Λίστα υπενθυμίσεων</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Φόρτωση...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Δεν υπάρχουν υπενθυμίσεις για το φίλτρο που επέλεξες.</p>
          ) : (
            filtered.map((row) => {
              const isOverdue = row.status === "pending" && row.due_date < today
              return (
                <div key={row.id} className="rounded-lg border border-border/70 bg-card/60 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="font-medium">{row.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {row.customer ? `${row.customer.first_name} ${row.customer.last_name}` : "Πελάτης"} • {formatDate(row.due_date)}
                      </p>
                      {row.notes ? <p className="text-sm">{row.notes}</p> : null}
                      {row.appointment_job_id ? (
                        <p className="text-xs text-muted-foreground">
                          Συνδεδεμένο ραντεβού: <Link to={`/appointments?open=${row.appointment_job_id}`} className="underline">{row.appointment_job?.title ?? "Άνοιγμα"}</Link>
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={row.status === "completed" ? "completed" : row.status === "cancelled" ? "cancelled" : "pending"}>
                        {row.status === "completed" ? "Ολοκληρώθηκε" : row.status === "cancelled" ? "Ακυρώθηκε" : isOverdue ? "Εκπρόθεσμη" : "Εκκρεμεί"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">Μεταφορές: {row.rescheduled_count}</span>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                    {row.status !== "completed" && (
                      <Button size="sm" onClick={() => void changeStatus(row, "completed")}>Ολοκληρώθηκε</Button>
                    )}
                    {row.status !== "cancelled" && (
                      <Button size="sm" variant="outline" onClick={() => openReschedule(row)}>Μεταφορά υπενθύμισης</Button>
                    )}
                    {row.status !== "cancelled" && (
                      <Button size="sm" variant="outline" onClick={() => openReschedule(row)}>Ο πελάτης δεν ενδιαφέρεται τώρα</Button>
                    )}
                    {row.status !== "cancelled" && (
                      <Button size="sm" variant="destructive" onClick={() => void changeStatus(row, "cancelled")}>Ακυρώθηκε</Button>
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
            <DialogTitle>Μεταφορά υπενθύμισης</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={reschedulePreset === "3" ? "default" : "outline"} onClick={() => setReschedulePreset("3")}>+3 μήνες</Button>
              <Button type="button" size="sm" variant={reschedulePreset === "6" ? "default" : "outline"} onClick={() => setReschedulePreset("6")}>+6 μήνες</Button>
              <Button type="button" size="sm" variant={reschedulePreset === "12" ? "default" : "outline"} onClick={() => setReschedulePreset("12")}>+12 μήνες</Button>
              <Button type="button" size="sm" variant={reschedulePreset === "custom" ? "default" : "outline"} onClick={() => setReschedulePreset("custom")}>Προσαρμοσμένη</Button>
            </div>
            {reschedulePreset === "custom" && (
              <div className="space-y-1">
                <Input type="date" value={rescheduleCustomDate} onChange={(e) => setRescheduleCustomDate(e.target.value)} />
              </div>
            )}
            <div className="space-y-1">
              <Textarea value={rescheduleNotes} onChange={(e) => setRescheduleNotes(e.target.value)} placeholder="Υπενθύμισε μου ξανά..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRescheduleOpen(false)}>Ακύρωση</Button>
              <Button type="button" onClick={() => void submitReschedule()}>Υπενθύμισε μου ξανά</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
