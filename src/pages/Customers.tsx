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
  fetchAppointmentStatusCountsByCustomer,
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
import { cn, formatCurrency, formatDate } from "@/lib/utils"
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
import { pickLang } from "@/lib/app-language"
import { computeReliabilityTier, tierDotClass, type CustomerReliabilityTier } from "@/lib/customerReliability"

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
  const [appointmentCounts, setAppointmentCounts] = useState<
    Record<string, { noShow: number; completed: number }>
  >({})

  useEffect(() => {
    if (!businessId) return
    setLoading(true)
    Promise.all([fetchCustomers(businessId), fetchAppointmentStatusCountsByCustomer(businessId)])
      .then(([list, counts]) => {
        setCustomers(list)
        setAppointmentCounts(counts)
      })
      .catch(() =>
        toast({
          title: pickLang(language, { el: "Σφάλμα", en: "Error", de: "Fehler" }),
          description: pickLang(language, {
            el: "Αποτυχία φόρτωσης πελατών",
            en: "Failed to load customers",
            de: "Kunden konnten nicht geladen werden",
          }),
          variant: "destructive",
        }),
      )
      .finally(() => setLoading(false))
  }, [businessId])

  useEffect(() => {
    if (!businessId) return
    const refreshCounts = () => {
      if (document.visibilityState !== "visible") return
      void fetchAppointmentStatusCountsByCustomer(businessId)
        .then(setAppointmentCounts)
        .catch(() => {})
    }
    document.addEventListener("visibilitychange", refreshCounts)
    return () => document.removeEventListener("visibilitychange", refreshCounts)
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

  const reliabilityTitle: Record<CustomerReliabilityTier, { el: string; en: string; de: string }> = {
    good: {
      el: "Αξιόπιστος: τουλάχιστον ένα ολοκληρωμένο ραντεβού, χωρίς «δεν εμφανίστηκε».",
      en: "Reliable: at least one completed visit, no no-shows.",
      de: "Zuverlässig: mindestens ein abgeschlossener Termin, keine Nichterscheinen.",
    },
    warn1: {
      el: "Προσοχή: 1 φορά δεν εμφανίστηκε.",
      en: "Caution: 1 no-show.",
      de: "Achtung: 1× nicht erschienen.",
    },
    warn2: {
      el: "Προσοχή: 2 φορές δεν εμφανίστηκε.",
      en: "Caution: 2 no-shows.",
      de: "Achtung: 2× nicht erschienen.",
    },
    bad: {
      el: "Υψηλός κίνδυνος: 3+ φορές δεν εμφανίστηκε.",
      en: "High risk: 3+ no-shows.",
      de: "Hohes Risiko: 3+ Nichterscheinen.",
    },
    neutral: {
      el: "Χωρίς επαρκές ιστορικό (ή μόνο εκκρεμή/ακυρωμένα κ.λπ.).",
      en: "Not enough history (pending/cancelled only, etc.).",
      de: "Zu wenig Verlauf (nur ausstehend/storniert usw.).",
    },
  }

  function tierForCustomer(c: Customer): CustomerReliabilityTier {
    const s = appointmentCounts[c.id] ?? { noShow: 0, completed: 0 }
    return computeReliabilityTier(s.noShow, s.completed)
  }

  function tierLabel(tier: CustomerReliabilityTier): string {
    const row = reliabilityTitle[tier]
    return pickLang(language, { el: row.el, en: row.en, de: row.de })
  }

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
        await notifyInAppQuiet(
          businessId,
          `${pickLang(language, {
            el: "Ενημέρωση στοιχείων πελάτη",
            en: "Customer details updated",
            de: "Kundendaten aktualisiert",
          })}: ${label}`,
          {
            notificationType: "customer_updated",
            relatedCustomerId: editing.id,
          },
        )
        toast({
          title: pickLang(language, { el: "Ενημερώθηκε", en: "Updated", de: "Aktualisiert" }),
          description: pickLang(language, {
            el: "Ο πελάτης ενημερώθηκε.",
            en: "Customer updated.",
            de: "Kunde wurde aktualisiert.",
          }),
        })
      } else {
        const biz = await fetchBusiness(businessId)
        if (biz?.max_customers != null && customers.length >= biz.max_customers) {
          toast({
            title: pickLang(language, {
              el: "Όριο πελατών πλάνου",
              en: "Plan customer limit",
              de: "Kundenlimit des Plans",
            }),
            description: pickLang(language, {
              el: "Έχεις φτάσει το μέγιστο πλήθος πελατών για το τρέχον πλάνο επιχείρησης.",
              en: "You reached the maximum customers for the current plan.",
              de: "Sie haben die maximale Kundenanzahl für den aktuellen Plan erreicht.",
            }),
            variant: "destructive",
          })
          return
        }
        const created = await createCustomer({ ...payload, business_id: businessId })
        setCustomers((prev) => [created, ...prev])
        await notifyInAppQuiet(
          businessId,
          `${pickLang(language, {
            el: "Νέος πελάτης (λίστα)",
            en: "New customer (list)",
            de: "Neuer Kunde (Liste)",
          })}: ${created.first_name} ${created.last_name}`.trim(),
          {
            notificationType: "customer_created",
            relatedCustomerId: created.id,
            metadata: { source: "customers_page" },
          },
        )
        toast({
          title: pickLang(language, { el: "Προστέθηκε", en: "Added", de: "Hinzugefügt" }),
          description: pickLang(language, {
            el: "Νέος πελάτης προστέθηκε.",
            en: "New customer added.",
            de: "Neuer Kunde wurde hinzugefügt.",
          }),
        })
      }
      setDialogOpen(false)
      setEditing(null)
    } catch (e) {
      toast({
        title: pickLang(language, { el: "Σφάλμα", en: "Error", de: "Fehler" }),
        description: (e as Error).message,
        variant: "destructive",
      })
    }
  }

  async function handleDelete(c: Customer) {
    if (
      !confirm(
        pickLang(language, {
          el: `Διαγραφή πελάτη ${c.first_name} ${c.last_name}; Θα διαγραφούν και όλα τα ραντεβού του.`,
          en: `Delete customer ${c.first_name} ${c.last_name}? All appointments will also be deleted.`,
          de: `Kunde ${c.first_name} ${c.last_name} löschen? Alle Termine werden ebenfalls gelöscht.`,
        }),
      )
    )
      return
    if (!businessId) return
    try {
      const appointments = await fetchAppointments(businessId, { customerId: c.id })
      for (const a of appointments) {
        await deleteAppointment(a.id)
      }
      await deleteCustomer(c.id)
      setCustomers((prev) => prev.filter((x) => x.id !== c.id))
      toast({
        title: pickLang(language, { el: "Διαγράφηκε", en: "Deleted", de: "Gelöscht" }),
        description: pickLang(language, {
          el: "Ο πελάτης και τα ραντεβού του διαγράφηκαν.",
          en: "Customer and appointments deleted.",
          de: "Kunde und zugehörige Termine wurden gelöscht.",
        }),
      })
    } catch (e) {
      toast({
        title: pickLang(language, { el: "Σφάλμα", en: "Error", de: "Fehler" }),
        description: (e as Error).message,
        variant: "destructive",
      })
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
        title: pickLang(language, { el: "Σφάλμα", en: "Error", de: "Fehler" }),
        description:
          e instanceof Error
            ? e.message
            : pickLang(language, {
                el: "Αποτυχία φόρτωσης ιστορικού",
                en: "Failed to load history",
                de: "Verlauf konnte nicht geladen werden",
              }),
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
            {pickLang(language, {
              el: "Επιχείρηση • Πελάτες",
              en: "Business • Customers",
              de: "Unternehmen • Kunden",
            })}
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            {pickLang(language, { el: "Πελάτες", en: "Customers", de: "Kunden" })}
          </h1>
          <p className="text-muted-foreground">
            {pickLang(language, {
              el: "Διαχείριση πελατών",
              en: "Customer management",
              de: "Kundenverwaltung",
            })}
          </p>
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
          {pickLang(language, { el: "Νέος πελάτης", en: "New customer", de: "Neuer Kunde" })}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {pickLang(language, { el: "Σύνολο πελατών", en: "Total customers", de: "Kunden gesamt" })}
              </p>
              <p className="text-xl font-semibold tracking-tight">{totalCustomers}</p>
              {user?.business_limits?.max_customers != null && (
                <p className="text-[11px] text-muted-foreground">
                  {totalCustomers}/{user.business_limits.max_customers}{" "}
                  {pickLang(language, { el: "του πλάνου", en: "of plan", de: "vom Plan" })}
                </p>
              )}
            </div>
            <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/5">
              {pickLang(language, { el: "Όλοι", en: "All", de: "Alle" })}
            </Badge>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {pickLang(language, { el: "Με email", en: "With email", de: "Mit E-Mail" })}
              </p>
              <p className="text-xl font-semibold tracking-tight">{withEmail}</p>
            </div>
            <Badge variant="outline" className="text-xs border-emerald-400/40 text-emerald-500 bg-emerald-500/5">
              {pickLang(language, { el: "Επικοινωνία", en: "Contact", de: "Kontakt" })}
            </Badge>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {pickLang(language, { el: "Με τηλέφωνο", en: "With phone", de: "Mit Telefon" })}
              </p>
              <p className="text-xl font-semibold tracking-tight">{withPhone}</p>
            </div>
            <Badge variant="outline" className="text-xs border-blue-400/40 text-blue-500 bg-blue-500/5">
              {pickLang(language, { el: "Κλήση / SMS", en: "Call / SMS", de: "Anruf / SMS" })}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-sm mt-1">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
              {pickLang(language, { el: "Λίστα πελατών", en: "Customer list", de: "Kundenliste" })}
            </CardTitle>
            <Badge variant="secondary" className="border border-border/50 bg-background/40 backdrop-blur">
              {filtered.length}{" "}
              {pickLang(language, { el: "πελάτες", en: "customers", de: "Kunden" })}
            </Badge>
          </div>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={pickLang(language, {
                el: "Αναζήτηση (όνομα, email, τηλ.)...",
                en: "Search (name, email, phone)...",
                de: "Suchen (Name, E-Mail, Telefon)...",
              })}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background/40 border-border/50 focus-visible:ring-primary/30"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {pickLang(language, {
              el: "Σήμα επίσκεψης (από ραντεβού):",
              en: "Visit signal (from appointments):",
              de: "Besuchssignal (aus Terminen):",
            })}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", tierDotClass("good"))} aria-hidden />
              {pickLang(language, {
                el: "Ολοκληρώθηκε, χωρίς απουσία",
                en: "Completed, no no-show",
                de: "Abgeschlossen, ohne Nichterscheinen",
              })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", tierDotClass("warn1"))} aria-hidden />
              1×{" "}
              {pickLang(language, {
                el: "δεν εμφανίστηκε",
                en: "no-show",
                de: "nicht erschienen",
              })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", tierDotClass("warn2"))} aria-hidden />
              2×{" "}
              {pickLang(language, {
                el: "δεν εμφανίστηκε",
                en: "no-show",
                de: "nicht erschienen",
              })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", tierDotClass("bad"))} aria-hidden />
              3+{" "}
              {pickLang(language, {
                el: "δεν εμφανίστηκε",
                en: "no-show",
                de: "nicht erschienen",
              })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", tierDotClass("neutral"))} aria-hidden />
              {pickLang(language, {
                el: "Χωρίς δεδομένα ακόμα",
                en: "No data yet",
                de: "Noch keine Daten",
              })}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <User className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium text-foreground/80">
                {pickLang(language, { el: "Δεν βρέθηκαν πελάτες", en: "No customers found", de: "Keine Kunden gefunden" })}
              </p>
              <p className="text-sm">
                {pickLang(language, {
                  el: "Πρόσθεσε τον πρώτο πελάτη για να ξεκινήσεις.",
                  en: "Add your first customer to get started.",
                  de: "Legen Sie Ihren ersten Kunden an, um zu starten.",
                })}
              </p>
              <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                {pickLang(language, { el: "Προσθήκη πελάτη", en: "Add customer", de: "Kunde hinzufügen" })}
              </Button>
            </div>
          ) : (
            <>
              <div className="md:hidden space-y-2">
                {filtered.map((c) => {
                  const tier = tierForCustomer(c)
                  return (
                  <div key={c.id} className="rounded-xl border border-border/50 bg-card/40 p-4 backdrop-blur">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn("inline-block h-3 w-3 shrink-0 rounded-full", tierDotClass(tier))}
                            title={tierLabel(tier)}
                            aria-label={tierLabel(tier)}
                          />
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
                          <Button variant="outline" size="sm">
                            {pickLang(language, { el: "Ενέργειες", en: "Actions", de: "Aktionen" })}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openHistoryForCustomer(c)}>
                            {pickLang(language, { el: "Ιστορικό", en: "History", de: "Verlauf" })}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setEditing(c); setDialogOpen(true) }}>
                            {pickLang(language, { el: "Επεξεργασία", en: "Edit", de: "Bearbeiten" })}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(c)}>
                            {pickLang(language, { el: "Διαγραφή", en: "Delete", de: "Löschen" })}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  )
                })}
              </div>

              <div className="hidden md:block rounded-xl border border-border/50 bg-card/20 overflow-x-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background/40 backdrop-blur z-10">
                    <TableRow>
                      <TableHead
                        className="w-10 pr-0"
                        title={pickLang(language, {
                          el: "Σήμα επίσκεψης",
                          en: "Visit signal",
                          de: "Besuchssignal",
                        })}
                      >
                        <span className="sr-only">
                          {pickLang(language, { el: "Σήμα", en: "Signal", de: "Signal" })}
                        </span>
                      </TableHead>
                      <TableHead>{pickLang(language, { el: "Όνομα", en: "Name", de: "Name" })}</TableHead>
                      <TableHead>{pickLang(language, { el: "Τηλ.", en: "Phone", de: "Tel." })}</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>{pickLang(language, { el: "Περιοχή", en: "Area", de: "Region" })}</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>{pickLang(language, { el: "Ημ/νία", en: "Date", de: "Datum" })}</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => {
                      const tier = tierForCustomer(c)
                      return (
                      <TableRow key={c.id} className="odd:bg-muted/25 hover:bg-primary/10 transition-colors">
                        <TableCell className="w-10 pr-0 align-middle">
                          <span
                            className={cn("inline-block h-3 w-3 rounded-full", tierDotClass(tier))}
                            title={tierLabel(tier)}
                            aria-label={tierLabel(tier)}
                          />
                        </TableCell>
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
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={pickLang(language, { el: "Ενέργειες", en: "Actions", de: "Aktionen" })}
                              >
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
                                {pickLang(language, { el: "Επεξεργασία", en: "Edit", de: "Bearbeiten" })}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openHistoryForCustomer(c)}>
                                {pickLang(language, { el: "Ιστορικό", en: "History", de: "Verlauf" })}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(c)}>
                                {pickLang(language, { el: "Διαγραφή", en: "Delete", de: "Löschen" })}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      )
                    })}
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
            <DialogTitle>
              {editing
                ? pickLang(language, {
                    el: "Επεξεργασία πελάτη",
                    en: "Edit customer",
                    de: "Kunde bearbeiten",
                  })
                : pickLang(language, {
                    el: "Νέος πελάτης",
                    en: "New customer",
                    de: "Neuer Kunde",
                  })}
            </DialogTitle>
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
            <DialogTitle>
              {pickLang(language, { el: "Ιστορικό πελάτη", en: "Customer history", de: "Kundenverlauf" })}
            </DialogTitle>
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
                  <p>
                    {pickLang(language, { el: "Πελάτης από", en: "Customer since", de: "Kunde seit" })}:{" "}
                    {formatDate(selectedCustomer.created_at)}
                  </p>
                  {historyLastVisit && (
                    <p>
                      {pickLang(language, { el: "Τελευταία επίσκεψη", en: "Last visit", de: "Letzter Besuch" })}:{" "}
                      {formatDate(historyLastVisit)}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="border-border/60 bg-card/60">
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="space-y-0.5">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {pickLang(language, {
                          el: "Σύνολο ραντεβού",
                          en: "Total appointments",
                          de: "Termine gesamt",
                        })}
                      </p>
                      <p className="text-xl font-semibold tracking-tight">{historyAppointments.length}</p>
                    </div>
                    <Calendar className="h-4 w-4 text-primary" />
                  </CardContent>
                </Card>
                <Card className="border-border/60 bg-card/60">
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="space-y-0.5">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {pickLang(language, {
                          el: "Σύνολο (πληρωμές / χρέωση)",
                          en: "Total (payments / charge)",
                          de: "Gesamt (Zahlungen / Betrag)",
                        })}
                      </p>
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
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {pickLang(language, {
                          el: "Μέση αξία / ραντεβού",
                          en: "Average value / appointment",
                          de: "Ø-Wert / Termin",
                        })}
                      </p>
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
                    {pickLang(language, {
                      el: "Δεν υπάρχουν ραντεβού για αυτόν τον πελάτη.",
                      en: "No appointments for this customer.",
                      de: "Keine Termine für diesen Kunden.",
                    })}
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
                            {pickLang(language, { el: "Υπηρεσία", en: "Service", de: "Leistung" })}: {a.service?.name ?? "—"}
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
                                ? `${pickLang(language, {
                                    el: "Πληρωμή · υπόλ.",
                                    en: "Payment · rem.",
                                    de: "Zahlung · Rest",
                                  })} ${formatCurrency(sumRemainingForAppointment(a))}`
                                : pickLang(language, { el: "Πληρωμή", en: "Payment", de: "Zahlung" })
                              : getAppointmentValueForTotals(a) > 0
                                ? a.final_cost != null
                                  ? pickLang(language, {
                                      el: "Τελική χρέωση",
                                      en: "Final charge",
                                      de: "Endbetrag",
                                    })
                                  : pickLang(language, {
                                      el: "Εκτίμηση τιμής",
                                      en: "Estimated price",
                                      de: "Geschätzter Preis",
                                    })
                                : pickLang(language, { el: "Χωρίς ποσό", en: "No amount", de: "Kein Betrag" })}
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
