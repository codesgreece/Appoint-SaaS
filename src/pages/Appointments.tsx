import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Plus, Search, Calendar, Filter } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/contexts/AuthContext"
import { fetchAppointments, fetchCustomers, fetchTeam, fetchServices, updateAppointment, deleteAppointment } from "@/services/api"
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
import { formatDate, formatCurrency } from "@/lib/utils"
import { AppointmentForm } from "@/components/appointments/AppointmentForm"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { CalendarView } from "@/components/appointments/CalendarView"
import type { Customer } from "@/types"
import type { User } from "@/types"
import type { Service } from "@/types"
import { formatAppointmentTelegramMessage, sendBusinessTelegramMessage } from "@/lib/telegram"

const STATUS_LABELS: Record<AppointmentJobStatus, string> = {
  pending: "Εκκρεμεί",
  confirmed: "Επιβεβαιωμένο",
  in_progress: "Σε εξέλιξη",
  completed: "Ολοκληρώθηκε",
  cancelled: "Ακυρώθηκε",
  no_show: "Δεν εμφανίστηκε",
  rescheduled: "Επανεπιλογή",
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
  service?: Pick<Service, "id" | "name"> | null
}

export default function Appointments() {
  const { businessId, user } = useAuth()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [team, setTeam] = useState<User[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [datePreset, setDatePreset] = useState<"all" | "today" | "week">("all")
  const [view, setView] = useState<"list" | "calendar">("list")
  const [editing, setEditing] = useState<AppointmentRow | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [presetDate, setPresetDate] = useState<string | null>(null)

  useEffect(() => {
    if (!businessId) return
    const today = new Date()
    const toIso = (d: Date) => d.toISOString().slice(0, 10)
    const from =
      datePreset === "today"
        ? toIso(today)
        : datePreset === "week"
          ? toIso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6))
          : undefined
    const to =
      datePreset === "today" || datePreset === "week"
        ? toIso(today)
        : undefined

    Promise.all([
      fetchAppointments(businessId, {
        from,
        to,
        status: statusFilter !== "all" ? statusFilter : undefined,
      }),
      fetchCustomers(businessId),
      fetchTeam(businessId),
      fetchServices(businessId),
    ])
      .then(([apps, cust, tm, svc]) => {
        setAppointments(apps as AppointmentRow[])
        setCustomers(cust)
        setTeam(tm)
        setServices(svc)
      })
      .catch(() => toast({ title: "Σφάλμα", description: "Αποτυχία φόρτωσης", variant: "destructive" }))
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
    setPresetDate(null)
    const today = new Date()
    const toIso = (d: Date) => d.toISOString().slice(0, 10)
    const from =
      datePreset === "today"
        ? toIso(today)
        : datePreset === "week"
          ? toIso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6))
          : undefined
    const to =
      datePreset === "today" || datePreset === "week"
        ? toIso(today)
        : undefined
    fetchAppointments(businessId, {
      from,
      to,
      status: statusFilter !== "all" ? statusFilter : undefined,
    })
      .then((data) => setAppointments(data as AppointmentRow[]))
      .catch(() => toast({ title: "Σφάλμα", description: "Αποτυχία ανανέωσης λίστας", variant: "destructive" }))
    toast({ title: "Αποθηκεύτηκε", description: "Το ραντεβού ενημερώθηκε." })
  }

  async function quickUpdateStatus(a: AppointmentRow, next: AppointmentJobStatus) {
    try {
      if (!businessId) return
      await updateAppointment(a.id, { status: next })
      setAppointments((prev) => prev.map((x) => (x.id === a.id ? { ...x, status: next } : x)))

      if (a.status !== "completed" && next === "completed") {
        try {
          const customerName = a.customer
            ? `${(a.customer as Customer).first_name} ${(a.customer as Customer).last_name}`
            : "—"
          const serviceName = a.service?.name ?? "—"
          const message = formatAppointmentTelegramMessage({
            event: "completed",
            customerName,
            date: a.scheduled_date,
            time: `${a.start_time} - ${a.end_time}`,
            serviceName,
          })
          await sendBusinessTelegramMessage(businessId, message)
        } catch (notifyErr) {
          console.warn("Telegram completion notification failed:", notifyErr)
        }
      }

      toast({ title: "Ενημερώθηκε", description: "Η κατάσταση ενημερώθηκε." })
    } catch (e) {
      toast({ title: "Σφάλμα", description: e instanceof Error ? e.message : "Αποτυχία ενημέρωσης", variant: "destructive" })
    }
  }

  const canDeleteAppointment = user && (user.role === "admin" || user.role === "super_admin")

  async function handleDeleteAppointment(a: AppointmentRow) {
    if (!confirm(`Διαγραφή ραντεβού «${a.title}» της ${a.scheduled_date};`)) return
    if (!businessId) return
    try {
      await deleteAppointment(a.id)
      setAppointments((prev) => prev.filter((x) => x.id !== a.id))
      toast({ title: "Διαγράφηκε", description: "Το ραντεβού διαγράφηκε." })
    } catch (e) {
      toast({ title: "Σφάλμα", description: e instanceof Error ? e.message : "Αποτυχία διαγραφής", variant: "destructive" })
    }
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) {
      setEditing(null)
      setPresetDate(null)
    }
  }

  const completedCount = appointments.filter((a) => a.status === "completed").length
  const todayCount = appointments.filter((a) => {
    const todayIso = new Date().toISOString().slice(0, 10)
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
            Επιχείρηση • Ραντεβού
          </div>
          <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight">Ραντεβού / Εργασίες</h1>
          <p className="text-sm text-muted-foreground">Διαχείριση ραντεβού και work orders</p>
          <div className="mt-3 h-px w-full max-w-xl bg-gradient-to-r from-primary/40 via-purple-500/20 to-transparent" />
        </div>
        <Button
          onClick={() => { setEditing(null); setDialogOpen(true); }}
          className="bg-gradient-to-r from-primary to-purple-500 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30"
        >
          <Plus className="h-4 w-4 mr-2" />
          Νέο ραντεβού
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Σήμερα</p>
              <p className="text-xl font-semibold tracking-tight">{todayCount}</p>
            </div>
            <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/5">
              Ημέρα
            </Badge>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ενεργά</p>
              <p className="text-xl font-semibold tracking-tight">{pendingCount}</p>
            </div>
            <Badge variant="outline" className="text-xs border-amber-400/40 text-amber-500 bg-amber-500/5">
              Εκκρεμή
            </Badge>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ολοκληρωμένα</p>
              <p className="text-xl font-semibold tracking-tight">{completedCount}</p>
              {user?.business_limits?.max_appointments != null && (
                <p className="text-[11px] text-muted-foreground">
                  {/* Δεν έχουμε εδώ συνολικό count όλων των ραντεβού, οπότε δείχνουμε μόνο το όριο */}
                  Όριο πλάνου: {user.business_limits.max_appointments} ραντεβού
                </p>
              )}
            </div>
            <Badge variant="outline" className="text-xs border-emerald-400/40 text-emerald-500 bg-emerald-500/5">
              Σήμερα & παλαιότερα
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as "list" | "calendar")}>
        <TabsList className="bg-card/40 border border-border/50 backdrop-blur">
          <TabsTrigger value="list">Λίστα</TabsTrigger>
          <TabsTrigger value="calendar">Ημερολόγιο</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-4">
          <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-sm">
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    Σύνολο: <span className="text-foreground font-medium">{filtered.length}</span>
                  </div>
                  <Badge variant="secondary" className="border border-border/50 bg-background/40 backdrop-blur">
                    {statusFilter === "all" ? "Όλες οι καταστάσεις" : `Κατάσταση: ${STATUS_LABELS[statusFilter as AppointmentJobStatus]}`}
                  </Badge>
                </div>
                <div className="relative max-w-sm flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Αναζήτηση (τίτλος, πελάτης)..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-background/40 border-border/50 focus-visible:ring-primary/30"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Filter className="h-4 w-4" />
                    Φίλτρα:
                  </div>
                  <Button variant={datePreset === "all" ? "secondary" : "outline"} size="sm" onClick={() => setDatePreset("all")}>
                    Όλα
                  </Button>
                  <Button variant={datePreset === "today" ? "secondary" : "outline"} size="sm" onClick={() => setDatePreset("today")}>
                    Σήμερα
                  </Button>
                  <Button variant={datePreset === "week" ? "secondary" : "outline"} size="sm" onClick={() => setDatePreset("week")}>
                    7 ημέρες
                  </Button>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[220px] bg-background/40 border-border/50">
                      <SelectValue placeholder="Κατάσταση" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Όλες οι καταστάσεις</SelectItem>
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
                  <p className="font-medium text-foreground/80">Δεν βρέθηκαν ραντεβού</p>
                  <p className="text-sm">Δημιούργησε το πρώτο ραντεβού για να ξεκινήσεις.</p>
                  <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                    Προσθήκη ραντεβού
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
                              Επεξεργασία
                            </Button>
                            {a.status !== "confirmed" && (
                              <Button variant="outline" size="sm" onClick={() => quickUpdateStatus(a, "confirmed")}>
                                Επιβεβαίωση
                              </Button>
                            )}
                            {a.status !== "completed" && (
                              <Button size="sm" onClick={() => { setEditing({ ...a, status: "completed" }); setDialogOpen(true) }}>
                                Ολοκλήρωση
                              </Button>
                            )}
                            {canDeleteAppointment && (
                              <Button variant="destructive" size="sm" onClick={() => handleDeleteAppointment(a)}>
                                Διαγραφή
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
                          <TableHead>Ημ/νία</TableHead>
                          <TableHead>Ώρα</TableHead>
                          <TableHead>Τίτλος</TableHead>
                          <TableHead>Πελάτης</TableHead>
                          <TableHead>Υπηρεσία</TableHead>
                          <TableHead>Υπεύθυνος</TableHead>
                          <TableHead>Κατάσταση</TableHead>
                          <TableHead>Κόστος</TableHead>
                          <TableHead>Ενέργειες</TableHead>
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
                            <TableCell>{(a.assigned_user as { full_name?: string })?.full_name ?? "—"}</TableCell>
                            <TableCell>
                              <Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABELS[a.status]}</Badge>
                            </TableCell>
                            <TableCell>{a.final_cost != null ? formatCurrency(Number(a.final_cost)) : a.cost_estimate != null ? formatCurrency(Number(a.cost_estimate)) : "—"}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => { setEditing(a); setDialogOpen(true); }}>
                                  Επεξεργασία
                                </Button>
                                {a.status !== "confirmed" && (
                                  <Button variant="outline" size="sm" onClick={() => quickUpdateStatus(a, "confirmed")}>
                                    Επιβεβαίωση
                                  </Button>
                                )}
                                {a.status !== "completed" && (
                                  <Button size="sm" onClick={() => { setEditing({ ...a, status: "completed" }); setDialogOpen(true) }}>
                                    Ολοκλήρωση
                                  </Button>
                                )}
                                {canDeleteAppointment && (
                                  <Button variant="destructive" size="sm" onClick={() => handleDeleteAppointment(a)}>
                                    Διαγραφή
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
              setPresetDate(date)
              setDialogOpen(true)
            }}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Επεξεργασία ραντεβού" : "Νέο ραντεβού"}</DialogTitle>
          </DialogHeader>
          <ErrorBoundary
            onReset={() => { setDialogOpen(false); setEditing(null); setPresetDate(null); }}
            fallback={
              <div className="py-4">
                <p className="text-sm text-muted-foreground mb-4">Σφάλμα στη φόρμα. Κλείστε και δοκιμάστε ξανά.</p>
                <Button variant="outline" onClick={() => { setDialogOpen(false); setEditing(null); setPresetDate(null); }}>Κλείσιμο</Button>
              </div>
            }
          >
            <AppointmentForm
              key={editing?.id ?? presetDate ?? "new"}
              initial={editing ?? undefined}
              presetDate={presetDate ?? undefined}
              customers={customers}
              team={team}
              services={services}
              businessId={businessId}
              onSaved={handleSaved}
              onCancel={() => { setDialogOpen(false); setEditing(null); setPresetDate(null); }}
            />
          </ErrorBoundary>
        </DialogContent>
      </Dialog>
    </div>
  )
}
