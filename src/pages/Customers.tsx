import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Plus, Search, User, MoreHorizontal, Calendar, Euro } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  fetchAppointments,
  fetchBusiness,
  deleteAppointment,
  fetchCustomerById,
  notifyInAppQuiet,
} from "@/services/api"
import type { Customer } from "@/types"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  getAppointmentValueForTotals,
  sumPaidAmountForAppointment,
  sumRemainingForAppointment,
} from "@/lib/appointmentMoney"
import { CustomerForm } from "@/components/customers/CustomerForm"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLanguage } from "@/contexts/LanguageContext"

export default function Customers() {
  const { businessId, user } = useAuth()
  const { language } = useLanguage()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "")
  const [editing, setEditing] = useState<Customer | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyAppointments, setHistoryAppointments] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  useEffect(() => {
    if (!businessId) return
    fetchCustomers(businessId)
      .then(setCustomers)
      .catch(() => toast({ title: language === "en" ? "Error" : "Σφάλμα", description: language === "en" ? "Failed to load customers" : "Αποτυχία φόρτωσης πελατών", variant: "destructive" }))
      .finally(() => setLoading(false))
  }, [businessId])

  useEffect(() => {
    const q = searchParams.get("q") ?? ""
    if (q && q !== search) setSearch(q)
  }, [searchParams])

  const openFromNotification = searchParams.get("open")

  useEffect(() => {
    if (!openFromNotification || !businessId) return
    let cancelled = false
    ;(async () => {
      const c = await fetchCustomerById(openFromNotification)
      if (cancelled) return
      if (!c) {
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
      setEditing(c)
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

  const filtered = customers.filter(
    (c) =>
      c.first_name.toLowerCase().includes(search.toLowerCase()) ||
      c.last_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.phone ?? "").includes(search)
  )

  async function handleSave(payload: Partial<Customer>) {
    if (!businessId) return
    try {
      if (editing) {
        await updateCustomer(editing.id, payload)
        setCustomers((prev) => prev.map((c) => (c.id === editing.id ? { ...c, ...payload } : c)))
        const label = `${payload.first_name ?? editing.first_name} ${payload.last_name ?? editing.last_name}`.trim()
        await notifyInAppQuiet(businessId, `${language === "en" ? "Customer details updated" : "Ενημέρωση στοιχείων πελάτη"}: ${label}`, {
          notificationType: "customer_updated",
          relatedCustomerId: editing.id,
        })
        toast({ title: language === "en" ? "Updated" : "Ενημερώθηκε", description: language === "en" ? "Customer updated." : "Ο πελάτης ενημερώθηκε." })
      } else {
        const biz = await fetchBusiness(businessId)
        if (biz?.max_customers != null && customers.length >= biz.max_customers) {
          toast({
            title: language === "en" ? "Plan customer limit" : "Όριο πελατών πλάνου",
            description: language === "en" ? "You reached the maximum customers for the current plan." : "Έχεις φτάσει το μέγιστο πλήθος πελατών για το τρέχον πλάνο επιχείρησης.",
            variant: "destructive",
          })
          return
        }
        const created = await createCustomer({ ...payload, business_id: businessId })
        setCustomers((prev) => [created, ...prev])
        await notifyInAppQuiet(
          businessId,
          `${language === "en" ? "New customer (list)" : "Νέος πελάτης (λίστα)"}: ${created.first_name} ${created.last_name}`.trim(),
          {
            notificationType: "customer_created",
            relatedCustomerId: created.id,
            metadata: { source: "customers_page" },
          },
        )
        toast({ title: language === "en" ? "Added" : "Προστέθηκε", description: language === "en" ? "New customer added." : "Νέος πελάτης προστέθηκε." })
      }
      setDialogOpen(false)
      setEditing(null)
    } catch (e) {
      toast({ title: language === "en" ? "Error" : "Σφάλμα", description: (e as Error).message, variant: "destructive" })
    }
  }

  async function handleDelete(c: Customer) {
    if (!confirm(language === "en" ? `Delete customer ${c.first_name} ${c.last_name}? All appointments will also be deleted.` : `Διαγραφή πελάτη ${c.first_name} ${c.last_name}; Θα διαγραφούν και όλα τα ραντεβού του.`)) return
    if (!businessId) return
    try {
      const appointments = await fetchAppointments(businessId, { customerId: c.id })
      for (const a of appointments) {
        await deleteAppointment(a.id)
      }
      await deleteCustomer(c.id)
      setCustomers((prev) => prev.filter((x) => x.id !== c.id))
      toast({ title: language === "en" ? "Deleted" : "Διαγράφηκε", description: language === "en" ? "Customer and appointments deleted." : "Ο πελάτης και τα ραντεβού του διαγράφηκαν." })
    } catch (e) {
      toast({ title: language === "en" ? "Error" : "Σφάλμα", description: (e as Error).message, variant: "destructive" })
    }
  }

  const totalCustomers = customers.length
  const withEmail = customers.filter((c) => !!c.email).length
  const withPhone = customers.filter((c) => !!c.phone).length
  const historyTotalSpent = useMemo(
    () => historyAppointments.reduce((sum, a) => sum + getAppointmentValueForTotals(a), 0),
    [historyAppointments],
  )
  const historyLastVisit = useMemo(() => {
    if (!historyAppointments.length) return null
    const sorted = [...historyAppointments].sort((a, b) =>
      String(b.scheduled_date).localeCompare(String(a.scheduled_date)),
    )
    return sorted[0]?.scheduled_date ?? null
  }, [historyAppointments])

  async function openHistoryForCustomer(c: Customer) {
    if (!businessId) return
    setSelectedCustomer(c)
    setHistoryOpen(true)
    setHistoryLoading(true)
    try {
      const data = await fetchAppointments(businessId, { customerId: c.id })
      setHistoryAppointments(data as any[])
    } catch (e) {
      toast({
        title: language === "en" ? "Error" : "Σφάλμα",
        description: e instanceof Error ? e.message : language === "en" ? "Failed to load history" : "Αποτυχία φόρτωσης ιστορικού",
        variant: "destructive",
      })
    } finally {
      setHistoryLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <div className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-r from-primary/20 via-purple-500/10 to-transparent blur-2xl" />
          <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/40 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <User className="h-4 w-4 text-primary" />
            {language === "en" ? "Business • Customers" : "Επιχείρηση • Πελάτες"}
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{language === "en" ? "Customers" : "Πελάτες"}</h1>
          <p className="text-muted-foreground">{language === "en" ? "Customer management" : "Διαχείριση πελατών"}</p>
          <div className="mt-3 h-px w-full max-w-xl bg-gradient-to-r from-primary/40 via-purple-500/20 to-transparent" />
        </div>
        <Button
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
          className="bg-gradient-to-r from-primary to-purple-500 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30"
        >
          <Plus className="h-4 w-4 mr-2" />
          {language === "en" ? "New customer" : "Νέος πελάτης"}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{language === "en" ? "Total customers" : "Σύνολο πελατών"}</p>
              <p className="text-xl font-semibold tracking-tight">{totalCustomers}</p>
              {user?.business_limits?.max_customers != null && (
                <p className="text-[11px] text-muted-foreground">
                  {totalCustomers}/{user.business_limits.max_customers} {language === "en" ? "of plan" : "του πλάνου"}
                </p>
              )}
            </div>
            <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/5">
              {language === "en" ? "All" : "Όλοι"}
            </Badge>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{language === "en" ? "With email" : "Με email"}</p>
              <p className="text-xl font-semibold tracking-tight">{withEmail}</p>
            </div>
            <Badge variant="outline" className="text-xs border-emerald-400/40 text-emerald-500 bg-emerald-500/5">
              {language === "en" ? "Contact" : "Επικοινωνία"}
            </Badge>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{language === "en" ? "With phone" : "Με τηλέφωνο"}</p>
              <p className="text-xl font-semibold tracking-tight">{withPhone}</p>
            </div>
            <Badge variant="outline" className="text-xs border-blue-400/40 text-blue-500 bg-blue-500/5">
              {language === "en" ? "Call / SMS" : "Κλήση / SMS"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-sm mt-1">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
              {language === "en" ? "Customer list" : "Λίστα πελατών"}
            </CardTitle>
            <Badge variant="secondary" className="border border-border/50 bg-background/40 backdrop-blur">
              {filtered.length} {language === "en" ? "customers" : "πελάτες"}
            </Badge>
          </div>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={language === "en" ? "Search (name, email, phone)..." : "Αναζήτηση (όνομα, email, τηλ.)..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background/40 border-border/50 focus-visible:ring-primary/30"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <User className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium text-foreground/80">{language === "en" ? "No customers found" : "Δεν βρέθηκαν πελάτες"}</p>
              <p className="text-sm">{language === "en" ? "Add your first customer to get started." : "Πρόσθεσε τον πρώτο πελάτη για να ξεκινήσεις."}</p>
              <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                {language === "en" ? "Add customer" : "Προσθήκη πελάτη"}
              </Button>
            </div>
          ) : (
            <>
              <div className="md:hidden space-y-2">
                {filtered.map((c) => (
                  <div key={c.id} className="rounded-xl border border-border/50 bg-card/40 p-4 backdrop-blur">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
                            {`${c.first_name?.[0] ?? ""}${c.last_name?.[0] ?? ""}`.toUpperCase()}
                          </div>
                          <div className="text-sm font-medium">
                            {c.first_name} {c.last_name}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {c.phone ?? "—"} • {c.email ?? "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {c.area ?? "—"} • {formatDate(c.created_at)}
                        </div>
                        {c.tags?.length ? (
                          <div className="flex gap-1 flex-wrap pt-1">
                            {c.tags.slice(0, 4).map((t) => (
                              <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">{language === "en" ? "Actions" : "Ενέργειες"}</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openHistoryForCustomer(c)}>
                            {language === "en" ? "History" : "Ιστορικό"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setEditing(c); setDialogOpen(true) }}>
                            {language === "en" ? "Edit" : "Επεξεργασία"}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(c)}>
                            {language === "en" ? "Delete" : "Διαγραφή"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block rounded-xl border border-border/50 bg-card/20 overflow-x-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background/40 backdrop-blur z-10">
                    <TableRow>
                      <TableHead>{language === "en" ? "Name" : "Όνομα"}</TableHead>
                      <TableHead>{language === "en" ? "Phone" : "Τηλ."}</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>{language === "en" ? "Area" : "Περιοχή"}</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>{language === "en" ? "Date" : "Ημ/νία"}</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => (
                      <TableRow key={c.id} className="odd:bg-muted/25 hover:bg-primary/10 transition-colors">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
                              {`${c.first_name?.[0] ?? ""}${c.last_name?.[0] ?? ""}`.toUpperCase()}
                            </div>
                            <span>
                              {c.first_name} {c.last_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{c.phone ?? "—"}</TableCell>
                        <TableCell>{c.email ?? "—"}</TableCell>
                        <TableCell>{c.area ?? "—"}</TableCell>
                        <TableCell>
                          {c.tags?.length ? (
                            <div className="flex gap-1 flex-wrap">
                              {c.tags.map((t) => (
                                <Badge key={t} variant="secondary" className="text-xs">
                                  {t}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(c.created_at)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={language === "en" ? "Actions" : "Ενέργειες"}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditing(c)
                                  setDialogOpen(true)
                                }}
                              >
                                {language === "en" ? "Edit" : "Επεξεργασία"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openHistoryForCustomer(c)}>
                                {language === "en" ? "History" : "Ιστορικό"}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(c)}>
                                {language === "en" ? "Delete" : "Διαγραφή"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? (language === "en" ? "Edit customer" : "Επεξεργασία πελάτη") : (language === "en" ? "New customer" : "Νέος πελάτης")}</DialogTitle>
          </DialogHeader>
          <CustomerForm
            initial={editing ?? undefined}
            onSubmit={handleSave}
            onCancel={() => {
              setDialogOpen(false)
              setEditing(null)
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{language === "en" ? "Customer history" : "Ιστορικό πελάτη"}</DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {`${selectedCustomer.first_name?.[0] ?? ""}${selectedCustomer.last_name?.[0] ?? ""}`.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {selectedCustomer.first_name} {selectedCustomer.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedCustomer.phone ?? "—"} • {selectedCustomer.email ?? "—"}
                    </p>
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{language === "en" ? "Customer since" : "Πελάτης από"}: {formatDate(selectedCustomer.created_at)}</p>
                  {historyLastVisit && (
                    <p>{language === "en" ? "Last visit" : "Τελευταία επίσκεψη"}: {formatDate(historyLastVisit)}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="border-border/60 bg-card/60">
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="space-y-0.5">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{language === "en" ? "Total appointments" : "Σύνολο ραντεβού"}</p>
                      <p className="text-xl font-semibold tracking-tight">{historyAppointments.length}</p>
                    </div>
                    <Calendar className="h-4 w-4 text-primary" />
                  </CardContent>
                </Card>
                <Card className="border-border/60 bg-card/60">
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="space-y-0.5">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{language === "en" ? "Total (payments / charge)" : "Σύνολο (πληρωμές / χρέωση)"}</p>
                      <p className="text-xl font-semibold tracking-tight">
                        {formatCurrency(historyTotalSpent)}
                      </p>
                    </div>
                    <Euro className="h-4 w-4 text-emerald-500" />
                  </CardContent>
                </Card>
                <Card className="border-border/60 bg-card/60">
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="space-y-0.5">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{language === "en" ? "Average value / appointment" : "Μέση αξία / ραντεβού"}</p>
                      <p className="text-xl font-semibold tracking-tight">
                        {historyAppointments.length ? formatCurrency(historyTotalSpent / historyAppointments.length) : "—"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="mt-2">
                {historyLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : historyAppointments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground text-sm">
                    {language === "en" ? "No appointments for this customer." : "Δεν υπάρχουν ραντεβού για αυτόν τον πελάτη."}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {historyAppointments.map((a) => (
                      <div
                        key={a.id}
                        className="rounded-xl border border-border/50 bg-card/40 px-3 py-2.5 text-xs flex items-center justify-between gap-3"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                              {formatDate(a.scheduled_date)}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {a.start_time}–{a.end_time}
                            </span>
                          </div>
                          <p className="text-sm font-medium truncate max-w-[220px]">{a.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {language === "en" ? "Service" : "Υπηρεσία"}: {a.service?.name ?? "—"}
                          </p>
                        </div>
                        <div className="text-right space-y-0.5 shrink-0 min-w-[120px]">
                          <p className="text-sm font-semibold tabular-nums">
                            {getAppointmentValueForTotals(a) > 0
                              ? formatCurrency(getAppointmentValueForTotals(a))
                              : "—"}
                          </p>
                          <p className="text-[10px] leading-tight text-muted-foreground">
                            {sumPaidAmountForAppointment(a) > 0
                              ? sumRemainingForAppointment(a) > 0
                                ? `${language === "en" ? "Payment · rem." : "Πληρωμή · υπόλ."} ${formatCurrency(sumRemainingForAppointment(a))}`
                                : language === "en" ? "Payment" : "Πληρωμή"
                              : getAppointmentValueForTotals(a) > 0
                                ? a.final_cost != null
                                  ? language === "en" ? "Final charge" : "Τελική χρέωση"
                                  : language === "en" ? "Estimated price" : "Εκτίμηση τιμής"
                                : language === "en" ? "No amount" : "Χωρίς ποσό"}
                          </p>
                          <p className="text-[11px] text-muted-foreground capitalize">{a.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
