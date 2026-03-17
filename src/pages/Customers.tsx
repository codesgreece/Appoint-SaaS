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
import { CustomerForm } from "@/components/customers/CustomerForm"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function Customers() {
  const { businessId, user } = useAuth()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
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
      .catch(() => toast({ title: "Σφάλμα", description: "Αποτυχία φόρτωσης πελατών", variant: "destructive" }))
      .finally(() => setLoading(false))
  }, [businessId])

  useEffect(() => {
    const q = searchParams.get("q") ?? ""
    if (q && q !== search) setSearch(q)
  }, [searchParams])

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
        toast({ title: "Ενημερώθηκε", description: "Ο πελάτης ενημερώθηκε." })
      } else {
        const biz = await fetchBusiness(businessId)
        if (biz?.max_customers != null && customers.length >= biz.max_customers) {
          toast({
            title: "Όριο πελατών πλάνου",
            description: "Έχεις φτάσει το μέγιστο πλήθος πελατών για το τρέχον πλάνο επιχείρησης.",
            variant: "destructive",
          })
          return
        }
        const created = await createCustomer({ ...payload, business_id: businessId })
        setCustomers((prev) => [created, ...prev])
        toast({ title: "Προστέθηκε", description: "Νέος πελάτης προστέθηκε." })
      }
      setDialogOpen(false)
      setEditing(null)
    } catch (e) {
      toast({ title: "Σφάλμα", description: (e as Error).message, variant: "destructive" })
    }
  }

  async function handleDelete(c: Customer) {
    if (!confirm(`Διαγραφή πελάτη ${c.first_name} ${c.last_name};`)) return
    try {
      await deleteCustomer(c.id)
      setCustomers((prev) => prev.filter((x) => x.id !== c.id))
      toast({ title: "Διαγράφηκε", description: "Ο πελάτης διαγράφηκε." })
    } catch (e) {
      toast({ title: "Σφάλμα", description: (e as Error).message, variant: "destructive" })
    }
  }

  const totalCustomers = customers.length
  const withEmail = customers.filter((c) => !!c.email).length
  const withPhone = customers.filter((c) => !!c.phone).length
  const historyTotalSpent = useMemo(
    () =>
      historyAppointments.reduce(
        (sum, a) =>
          sum +
          (a.final_cost != null
            ? Number(a.final_cost)
            : a.cost_estimate != null
              ? Number(a.cost_estimate)
              : 0),
        0,
      ),
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
        title: "Σφάλμα",
        description: e instanceof Error ? e.message : "Αποτυχία φόρτωσης ιστορικού",
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
            Επιχείρηση • Πελάτες
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Πελάτες</h1>
          <p className="text-muted-foreground">Διαχείριση πελατών</p>
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
          Νέος πελάτης
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Σύνολο πελατών</p>
              <p className="text-xl font-semibold tracking-tight">{totalCustomers}</p>
              {user?.business_limits?.max_customers != null && (
                <p className="text-[11px] text-muted-foreground">
                  {totalCustomers}/{user.business_limits.max_customers} του πλάνου
                </p>
              )}
            </div>
            <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/5">
              Όλοι
            </Badge>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Με email</p>
              <p className="text-xl font-semibold tracking-tight">{withEmail}</p>
            </div>
            <Badge variant="outline" className="text-xs border-emerald-400/40 text-emerald-500 bg-emerald-500/5">
              Επικοινωνία
            </Badge>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Με τηλέφωνο</p>
              <p className="text-xl font-semibold tracking-tight">{withPhone}</p>
            </div>
            <Badge variant="outline" className="text-xs border-blue-400/40 text-blue-500 bg-blue-500/5">
              Κλήση / SMS
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-sm mt-1">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
              Λίστα πελατών
            </CardTitle>
            <Badge variant="secondary" className="border border-border/50 bg-background/40 backdrop-blur">
              {filtered.length} πελάτες
            </Badge>
          </div>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Αναζήτηση (όνομα, email, τηλ.)..."
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
              <p className="font-medium text-foreground/80">Δεν βρέθηκαν πελάτες</p>
              <p className="text-sm">Πρόσθεσε τον πρώτο πελάτη για να ξεκινήσεις.</p>
              <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                Προσθήκη πελάτη
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
                          <Button variant="outline" size="sm">Ενέργειες</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openHistoryForCustomer(c)}>
                            Ιστορικό
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setEditing(c); setDialogOpen(true) }}>
                            Επεξεργασία
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(c)}>
                            Διαγραφή
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
                      <TableHead>Όνομα</TableHead>
                      <TableHead>Τηλ.</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Περιοχή</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Ημ/νία</TableHead>
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
                              <Button variant="ghost" size="icon" aria-label="Ενέργειες">
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
                                Επεξεργασία
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openHistoryForCustomer(c)}>
                                Ιστορικό
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(c)}>
                                Διαγραφή
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
            <DialogTitle>{editing ? "Επεξεργασία πελάτη" : "Νέος πελάτης"}</DialogTitle>
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
            <DialogTitle>Ιστορικό πελάτη</DialogTitle>
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
                  <p>Πελάτης από: {formatDate(selectedCustomer.created_at)}</p>
                  {historyLastVisit && (
                    <p>Τελευταία επίσκεψη: {formatDate(historyLastVisit)}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="border-border/60 bg-card/60">
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="space-y-0.5">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Σύνολο ραντεβού</p>
                      <p className="text-xl font-semibold tracking-tight">{historyAppointments.length}</p>
                    </div>
                    <Calendar className="h-4 w-4 text-primary" />
                  </CardContent>
                </Card>
                <Card className="border-border/60 bg-card/60">
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="space-y-0.5">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Συνολικές χρεώσεις</p>
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
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Μέση αξία</p>
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
                    Δεν υπάρχουν ραντεβού για αυτόν τον πελάτη.
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
                            Υπηρεσία: {a.service?.name ?? "—"}
                          </p>
                        </div>
                        <div className="text-right space-y-0.5">
                          <p className="text-sm font-semibold">
                            {a.final_cost != null
                              ? formatCurrency(Number(a.final_cost))
                              : a.cost_estimate != null
                                ? formatCurrency(Number(a.cost_estimate))
                                : "—"}
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
