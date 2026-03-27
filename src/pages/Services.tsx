import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Plus, Search, Briefcase, MoreHorizontal } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useLanguage } from "@/contexts/LanguageContext"
import { useToast } from "@/hooks/use-toast"
import type { Service } from "@/types"
import { fetchServices, createService, updateService, deleteService, notifyInAppQuiet } from "@/services/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

type FormState = {
  name: string
  description: string
  duration_minutes: string
  price: string
  billing_type: "fixed" | "hourly"
  hourly_rate: string
  is_public_booking_visible: boolean
}

const emptyForm: FormState = {
  name: "",
  description: "",
  duration_minutes: "",
  price: "",
  billing_type: "fixed",
  hourly_rate: "",
  is_public_booking_visible: true,
}

function parsePositiveNumber(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".")
  if (!normalized) return null
  const n = Number(normalized)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

function formatServicePrice(service: Service, lang: "el" | "en"): string {
  if (service.billing_type === "hourly") {
    const rate = service.hourly_rate != null ? Number(service.hourly_rate).toFixed(2) : null
    return rate ? (lang === "en" ? `${rate} €/hr` : `${rate} €/ώρα`) : "—"
  }
  return service.price != null ? `${Number(service.price).toFixed(2)} €` : "—"
}

const servicesI18n = {
  el: {
    loadError: "Αποτυχία φόρτωσης υπηρεσιών",
    nameRequired: "Το όνομα υπηρεσίας είναι υποχρεωτικό.",
    hourlyRequired: "Συμπληρώστε ωριαία χρέωση (€/ώρα).",
    saveFailed: "Αποτυχία αποθήκευσης",
    saved: "Αποθηκεύτηκε",
    serviceUpdated: "Η υπηρεσία ενημερώθηκε.",
    added: "Προστέθηκε",
    serviceCreated: "Η υπηρεσία δημιουργήθηκε.",
    deleted: "Διαγράφηκε",
    serviceDeleted: "Η υπηρεσία διαγράφηκε.",
    deleteFailed: "Αποτυχία διαγραφής",
    deleteConfirm: (name: string) => `Διαγραφή υπηρεσίας "${name}";`,
    breadcrumb: "Επιχείρηση • Υπηρεσίες",
    title: "Υπηρεσίες",
    subtitle: "Ορίστε τις υπηρεσίες που προσφέρει η επιχείρησή σας",
    newService: "Νέα υπηρεσία",
    totalServices: "Σύνολο υπηρεσιών",
    allBadge: "Όλες",
    withPrice: "Με τιμή",
    billingBadge: "Billing",
    hourlyCharge: "Χρέωση ανά ώρα",
    hourlyBadge: "Ωριαία",
    publicBookingLabel: "Public booking",
    visibleBadge: "Ορατές",
    serviceList: "Λίστα υπηρεσιών",
    servicesCount: (n: number) => `${n} υπηρεσίες`,
    searchPlaceholder: "Αναζήτηση...",
    emptyTitle: "Δεν υπάρχουν υπηρεσίες",
    emptyHint: "Πρόσθεσε την πρώτη υπηρεσία για να την επιλέγεις στα ραντεβού.",
    publicBookingShort: "Public booking",
    visible: "Ορατή",
    hidden: "Κρυφή",
    actions: "Ενέργειες",
    ariaActions: "Ενέργειες",
    tableName: "Όνομα",
    tableDuration: "Διάρκεια",
    tableCharge: "Χρέωση",
    tableDescription: "Περιγραφή",
    dialogEdit: "Επεξεργασία υπηρεσίας",
    dialogNew: "Νέα υπηρεσία",
    labelName: "Όνομα",
    labelBillingType: "Τύπος χρέωσης",
    billingPlaceholder: "Επιλογή τύπου χρέωσης",
    billingFixed: "Σταθερή τιμή",
    billingHourly: "Χρέωση ανά ώρα",
    labelDuration: "Διάρκεια (λεπτά)",
    durationPlaceholder: "π.χ. 30",
    labelPrice: "Τιμή (€)",
    pricePlaceholder: "π.χ. 25.00",
    labelHourlyRate: "Χρέωση ανά ώρα (€/ώρα)",
    hourlyPlaceholder: "π.χ. 40.00",
    hourlyHint: "Η τελική τιμή για το ραντεβού υπολογίζεται από τη διάρκεια της υπηρεσίας.",
    labelDescription: "Περιγραφή",
    publicBookingTitle: "Εμφάνιση στο Public Booking",
    publicBookingHint: "Αν είναι κλειστό, η υπηρεσία δεν θα εμφανίζεται στη δημόσια φόρμα.",
    cancel: "Ακύρωση",
    saving: "Αποθήκευση...",
    save: "Αποθήκευση",
    notifyPriceChange: (name: string, before: string, after: string) =>
      `Αλλαγή τιμολόγησης «${name}»: ${before} → ${after}`,
    notifyServiceCreated: (name: string, price: string) => `Νέα υπηρεσία: «${name}» (${price})`,
    notifyServiceRemoved: (name: string) =>
      `Η υπηρεσία «${name}» αφαιρέθηκε από τον κατάλογο (δεν εμφανίζεται πλέον στις επιλογές).`,
    edit: "Επεξεργασία",
    delete: "Διαγραφή",
  },
  en: {
    loadError: "Failed to load services",
    nameRequired: "Service name is required.",
    hourlyRequired: "Enter hourly rate (€/hr).",
    saveFailed: "Failed to save",
    saved: "Saved",
    serviceUpdated: "Service updated.",
    added: "Added",
    serviceCreated: "Service created.",
    deleted: "Deleted",
    serviceDeleted: "Service deleted.",
    deleteFailed: "Failed to delete",
    deleteConfirm: (name: string) => `Delete service "${name}"?`,
    breadcrumb: "Business · Services",
    title: "Services",
    subtitle: "Define the services your business offers",
    newService: "New service",
    totalServices: "Total services",
    allBadge: "All",
    withPrice: "With price",
    billingBadge: "Billing",
    hourlyCharge: "Hourly rate",
    hourlyBadge: "Hourly",
    publicBookingLabel: "Public booking",
    visibleBadge: "Visible",
    serviceList: "Service list",
    servicesCount: (n: number) => `${n} services`,
    searchPlaceholder: "Search...",
    emptyTitle: "No services yet",
    emptyHint: "Add your first service so you can pick it in appointments.",
    publicBookingShort: "Public booking",
    visible: "Visible",
    hidden: "Hidden",
    actions: "Actions",
    ariaActions: "Actions",
    tableName: "Name",
    tableDuration: "Duration",
    tableCharge: "Charge",
    tableDescription: "Description",
    dialogEdit: "Edit service",
    dialogNew: "New service",
    labelName: "Name",
    labelBillingType: "Billing type",
    billingPlaceholder: "Select billing type",
    billingFixed: "Fixed price",
    billingHourly: "Hourly rate",
    labelDuration: "Duration (minutes)",
    durationPlaceholder: "e.g. 30",
    labelPrice: "Price (€)",
    pricePlaceholder: "e.g. 25.00",
    labelHourlyRate: "Hourly rate (€/hr)",
    hourlyPlaceholder: "e.g. 40.00",
    hourlyHint: "The final price for the appointment is calculated from the service duration.",
    labelDescription: "Description",
    publicBookingTitle: "Show on public booking",
    publicBookingHint: "When off, the service won’t appear on the public booking form.",
    cancel: "Cancel",
    saving: "Saving...",
    save: "Save",
    notifyPriceChange: (name: string, before: string, after: string) =>
      `Pricing change "${name}": ${before} → ${after}`,
    notifyServiceCreated: (name: string, price: string) => `New service: "${name}" (${price})`,
    notifyServiceRemoved: (name: string) =>
      `Service "${name}" was removed from the catalog (no longer shown in options).`,
    edit: "Edit",
    delete: "Delete",
  },
} as const

export default function Services() {
  const { businessId } = useAuth()
  const { language } = useLanguage()
  const t = servicesI18n[language]
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Service[]>([])
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)

  useEffect(() => {
    if (!businessId) return
    setLoading(true)
    fetchServices(businessId)
      .then(setRows)
      .catch((e) =>
        toast({ title: language === "en" ? "Error" : "Σφάλμα", description: e instanceof Error ? e.message : t.loadError, variant: "destructive" }),
      )
      .finally(() => setLoading(false))
  }, [businessId])

  useEffect(() => {
    const q = searchParams.get("q") ?? ""
    if (q && q !== search) setSearch(q)
  }, [searchParams])

  const openServiceId = searchParams.get("open")

  useEffect(() => {
    if (!openServiceId || !businessId) return
    let cancelled = false
    ;(async () => {
      const data = await fetchServices(businessId)
      if (cancelled) return
      const s = data.find((x) => x.id === openServiceId)
      if (!s) {
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
      openEdit(s)
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
  }, [openServiceId, businessId, setSearchParams])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.description ?? "").toLowerCase().includes(q),
    )
  }, [rows, search])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(s: Service) {
    setEditing(s)
    setForm({
      name: s.name ?? "",
      description: s.description ?? "",
      duration_minutes: s.duration_minutes != null ? String(s.duration_minutes) : "",
      price: s.price != null ? String(s.price) : "",
      billing_type: s.billing_type ?? "fixed",
      hourly_rate: s.hourly_rate != null ? String(s.hourly_rate) : "",
      is_public_booking_visible: Boolean(s.is_public_booking_visible ?? true),
    })
    setDialogOpen(true)
  }

  async function refresh() {
    if (!businessId) return
    const data = await fetchServices(businessId)
    setRows(data)
  }

  async function handleSave() {
    try {
      if (!businessId) return
      if (!form.name.trim()) {
        toast({ title: language === "en" ? "Error" : "Σφάλμα", description: t.nameRequired, variant: "destructive" })
        return
      }
      const duration = parsePositiveNumber(form.duration_minutes)
      const fixedPrice = parsePositiveNumber(form.price)
      const hourlyRate = parsePositiveNumber(form.hourly_rate)

      if (form.billing_type === "hourly" && hourlyRate == null) {
        toast({ title: language === "en" ? "Error" : "Σφάλμα", description: t.hourlyRequired, variant: "destructive" })
        return
      }

      setSaving(true)
      const computedPrice =
        form.billing_type === "hourly" && hourlyRate != null && duration != null
          ? Number(((hourlyRate * duration) / 60).toFixed(2))
          : fixedPrice

      const payload: Partial<Service> = {
        business_id: businessId,
        name: form.name.trim(),
        description: form.description.trim() ? form.description.trim() : null,
        duration_minutes: duration,
        price: computedPrice,
        billing_type: form.billing_type,
        hourly_rate: form.billing_type === "hourly" ? hourlyRate : null,
        is_public_booking_visible: form.is_public_booking_visible,
      }
      if (editing) {
        await updateService(editing.id, payload)
        const oldP = editing.price != null ? Number(editing.price) : null
        const oldH = editing.hourly_rate != null ? Number(editing.hourly_rate) : null
        const newP = computedPrice != null ? Number(computedPrice) : null
        const newH = form.billing_type === "hourly" && hourlyRate != null ? Number(hourlyRate) : null
        const billingChanged = editing.billing_type !== form.billing_type
        const priceChanged =
          billingChanged ||
          (oldP != null && newP != null && Math.abs(oldP - newP) > 0.009) ||
          (oldH != null && newH != null && Math.abs(oldH - newH) > 0.009)
        if (priceChanged) {
          const preview = { ...editing, ...payload } as Service
          await notifyInAppQuiet(
            businessId,
            t.notifyPriceChange(editing.name, formatServicePrice(editing, language), formatServicePrice(preview, language)),
            { notificationType: "service_price", metadata: { related_service_id: editing.id } },
          )
        }
        toast({ title: t.saved, description: t.serviceUpdated })
      } else {
        const created = await createService(payload)
        await notifyInAppQuiet(
          businessId,
          t.notifyServiceCreated(created.name, formatServicePrice(created, language)),
          { notificationType: "service_created", metadata: { related_service_id: created.id } },
        )
        toast({ title: t.added, description: t.serviceCreated })
      }
      setDialogOpen(false)
      setEditing(null)
      setForm(emptyForm)
      await refresh()
    } catch (e) {
      toast({ title: language === "en" ? "Error" : "Σφάλμα", description: e instanceof Error ? e.message : t.saveFailed, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(s: Service) {
    if (!confirm(t.deleteConfirm(s.name))) return
    try {
      if (businessId) {
        await notifyInAppQuiet(
          businessId,
          t.notifyServiceRemoved(s.name),
          { notificationType: "service_removed", metadata: { related_service_id: s.id } },
        )
      }
      await deleteService(s.id)
      toast({ title: t.deleted, description: t.serviceDeleted })
      setRows((prev) => prev.filter((x) => x.id !== s.id))
    } catch (e) {
      toast({ title: language === "en" ? "Error" : "Σφάλμα", description: e instanceof Error ? e.message : t.deleteFailed, variant: "destructive" })
    }
  }

  const totalServices = rows.length
  const pricedServices = rows.filter((s) => s.price != null).length
  const hourlyServices = rows.filter((s) => s.billing_type === "hourly").length
  const publicBookingVisibleServices = rows.filter((s) => s.is_public_booking_visible).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <div className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-r from-primary/20 via-purple-500/10 to-transparent blur-2xl" />
          <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/40 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Briefcase className="h-4 w-4 text-primary" />
            {t.breadcrumb}
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-muted-foreground">{t.subtitle}</p>
          <div className="mt-3 h-px w-full max-w-xl bg-gradient-to-r from-primary/40 via-purple-500/20 to-transparent" />
        </div>
        <Button
          onClick={openCreate}
          className="bg-gradient-to-r from-primary to-purple-500 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t.newService}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.totalServices}</p>
              <p className="text-xl font-semibold tracking-tight">{totalServices}</p>
            </div>
            <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/5">
              {t.allBadge}
            </Badge>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.withPrice}</p>
              <p className="text-xl font-semibold tracking-tight">{pricedServices}</p>
            </div>
            <Badge variant="outline" className="text-xs border-emerald-400/40 text-emerald-500 bg-emerald-500/5">
              {t.billingBadge}
            </Badge>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.hourlyCharge}</p>
              <p className="text-xl font-semibold tracking-tight">{hourlyServices}</p>
            </div>
            <Badge variant="outline" className="text-xs border-blue-400/40 text-blue-500 bg-blue-500/5">
              {t.hourlyBadge}
            </Badge>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.publicBookingLabel}</p>
              <p className="text-xl font-semibold tracking-tight">{publicBookingVisibleServices}</p>
            </div>
            <Badge variant="outline" className="text-xs border-indigo-400/40 text-indigo-500 bg-indigo-500/5">
              {t.visibleBadge}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-sm mt-1">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
              {t.serviceList}
            </CardTitle>
            <Badge variant="secondary" className="border border-border/50 bg-background/40 backdrop-blur">
              {t.servicesCount(filtered.length)}
            </Badge>
          </div>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t.searchPlaceholder}
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
              <Briefcase className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium text-foreground/80">{t.emptyTitle}</p>
              <p className="text-sm">{t.emptyHint}</p>
              <Button variant="outline" className="mt-4" onClick={openCreate}>
                {t.newService}
              </Button>
            </div>
          ) : (
            <>
              <div className="md:hidden space-y-2">
                {filtered.map((s) => (
                  <div key={s.id} className="rounded-xl border border-border/50 bg-card/40 p-4 backdrop-blur">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.duration_minutes != null ? `${s.duration_minutes}’` : "—"} • {formatServicePrice(s, language)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t.publicBookingShort}: {s.is_public_booking_visible ? t.visible : t.hidden}
                        </div>
                        {s.description ? (
                          <div className="text-xs text-muted-foreground">{s.description}</div>
                        ) : null}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">{t.actions}</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(s)}>{t.edit}</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(s)}>
                            {t.delete}
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
                      <TableHead>{t.tableName}</TableHead>
                      <TableHead>{t.tableDuration}</TableHead>
                      <TableHead>{t.tableCharge}</TableHead>
                      <TableHead>{t.tableDescription}</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((s) => (
                      <TableRow key={s.id} className="odd:bg-muted/25 hover:bg-primary/10 transition-colors">
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{s.duration_minutes != null ? `${s.duration_minutes}’` : "—"}</TableCell>
                        <TableCell>{formatServicePrice(s, language)}</TableCell>
                        <TableCell className="max-w-[420px] truncate">{s.description ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={t.ariaActions}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(s)}>{t.edit}</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(s)}>
                                {t.delete}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t.dialogEdit : t.dialogNew}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t.labelName}</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t.labelBillingType}</Label>
              <Select
                value={form.billing_type}
                onValueChange={(value: "fixed" | "hourly") => setForm((f) => ({ ...f, billing_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.billingPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">{t.billingFixed}</SelectItem>
                  <SelectItem value="hourly">{t.billingHourly}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.labelDuration}</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={form.duration_minutes}
                onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))}
                placeholder={t.durationPlaceholder}
              />
            </div>
            {form.billing_type === "fixed" ? (
              <div className="space-y-2">
                <Label>{t.labelPrice}</Label>
                <Input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder={t.pricePlaceholder}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>{t.labelHourlyRate}</Label>
                <Input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={form.hourly_rate}
                  onChange={(e) => setForm((f) => ({ ...f, hourly_rate: e.target.value }))}
                  placeholder={t.hourlyPlaceholder}
                />
                <p className="text-xs text-muted-foreground">
                  {t.hourlyHint}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>{t.labelDescription}</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2">
              <div>
                <p className="text-sm font-medium">{t.publicBookingTitle}</p>
                <p className="text-xs text-muted-foreground">{t.publicBookingHint}</p>
              </div>
              <Switch
                checked={form.is_public_booking_visible}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, is_public_booking_visible: checked }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>{t.cancel}</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? t.saving : t.save}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

