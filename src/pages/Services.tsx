import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Plus, Search, Briefcase, MoreHorizontal } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"
import type { Service } from "@/types"
import { fetchServices, createService, updateService, deleteService } from "@/services/api"
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

type FormState = {
  name: string
  description: string
  duration_minutes: string
  price: string
}

const emptyForm: FormState = { name: "", description: "", duration_minutes: "", price: "" }

export default function Services() {
  const { businessId } = useAuth()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
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
      .catch((e) => toast({ title: "Σφάλμα", description: e instanceof Error ? e.message : "Αποτυχία φόρτωσης υπηρεσιών", variant: "destructive" }))
      .finally(() => setLoading(false))
  }, [businessId])

  useEffect(() => {
    const q = searchParams.get("q") ?? ""
    if (q && q !== search) setSearch(q)
  }, [searchParams])

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
        toast({ title: "Σφάλμα", description: "Το όνομα υπηρεσίας είναι υποχρεωτικό.", variant: "destructive" })
        return
      }
      setSaving(true)
      const payload: Partial<Service> = {
        business_id: businessId,
        name: form.name.trim(),
        description: form.description.trim() ? form.description.trim() : null,
        duration_minutes: form.duration_minutes.trim() ? Number(form.duration_minutes) : null,
        price: form.price.trim() ? Number(form.price) : null,
      }
      if (editing) {
        await updateService(editing.id, payload)
        toast({ title: "Αποθηκεύτηκε", description: "Η υπηρεσία ενημερώθηκε." })
      } else {
        await createService(payload)
        toast({ title: "Προστέθηκε", description: "Η υπηρεσία δημιουργήθηκε." })
      }
      setDialogOpen(false)
      setEditing(null)
      setForm(emptyForm)
      await refresh()
    } catch (e) {
      toast({ title: "Σφάλμα", description: e instanceof Error ? e.message : "Αποτυχία αποθήκευσης", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(s: Service) {
    if (!confirm(`Διαγραφή υπηρεσίας "${s.name}";`)) return
    try {
      await deleteService(s.id)
      toast({ title: "Διαγράφηκε", description: "Η υπηρεσία διαγράφηκε." })
      setRows((prev) => prev.filter((x) => x.id !== s.id))
    } catch (e) {
      toast({ title: "Σφάλμα", description: e instanceof Error ? e.message : "Αποτυχία διαγραφής", variant: "destructive" })
    }
  }

  const totalServices = rows.length
  const pricedServices = rows.filter((s) => s.price != null).length
  const withDuration = rows.filter((s) => s.duration_minutes != null).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <div className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-r from-primary/20 via-purple-500/10 to-transparent blur-2xl" />
          <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/40 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Briefcase className="h-4 w-4 text-primary" />
            Επιχείρηση • Υπηρεσίες
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Υπηρεσίες</h1>
          <p className="text-muted-foreground">Ορίστε τις υπηρεσίες που προσφέρει η επιχείρησή σας</p>
          <div className="mt-3 h-px w-full max-w-xl bg-gradient-to-r from-primary/40 via-purple-500/20 to-transparent" />
        </div>
        <Button
          onClick={openCreate}
          className="bg-gradient-to-r from-primary to-purple-500 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30"
        >
          <Plus className="h-4 w-4 mr-2" />
          Νέα υπηρεσία
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Σύνολο υπηρεσιών</p>
              <p className="text-xl font-semibold tracking-tight">{totalServices}</p>
            </div>
            <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/5">
              Όλες
            </Badge>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Με τιμή</p>
              <p className="text-xl font-semibold tracking-tight">{pricedServices}</p>
            </div>
            <Badge variant="outline" className="text-xs border-emerald-400/40 text-emerald-500 bg-emerald-500/5">
              Billing
            </Badge>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Με διάρκεια</p>
              <p className="text-xl font-semibold tracking-tight">{withDuration}</p>
            </div>
            <Badge variant="outline" className="text-xs border-blue-400/40 text-blue-500 bg-blue-500/5">
              Scheduling
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-sm mt-1">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
              Λίστα υπηρεσιών
            </CardTitle>
            <Badge variant="secondary" className="border border-border/50 bg-background/40 backdrop-blur">
              {filtered.length} υπηρεσίες
            </Badge>
          </div>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Αναζήτηση..."
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
              <p className="font-medium text-foreground/80">Δεν υπάρχουν υπηρεσίες</p>
              <p className="text-sm">Πρόσθεσε την πρώτη υπηρεσία για να την επιλέγεις στα ραντεβού.</p>
              <Button variant="outline" className="mt-4" onClick={openCreate}>
                Νέα υπηρεσία
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
                          {s.duration_minutes != null ? `${s.duration_minutes}’` : "—"} • {s.price != null ? `${Number(s.price).toFixed(2)} €` : "—"}
                        </div>
                        {s.description ? (
                          <div className="text-xs text-muted-foreground">{s.description}</div>
                        ) : null}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">Ενέργειες</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(s)}>Επεξεργασία</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(s)}>
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
                      <TableHead>Διάρκεια</TableHead>
                      <TableHead>Τιμή</TableHead>
                      <TableHead>Περιγραφή</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((s) => (
                      <TableRow key={s.id} className="odd:bg-muted/25 hover:bg-primary/10 transition-colors">
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{s.duration_minutes != null ? `${s.duration_minutes}’` : "—"}</TableCell>
                        <TableCell>{s.price != null ? `${Number(s.price).toFixed(2)} €` : "—"}</TableCell>
                        <TableCell className="max-w-[420px] truncate">{s.description ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Ενέργειες">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(s)}>Επεξεργασία</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(s)}>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Επεξεργασία υπηρεσίας" : "Νέα υπηρεσία"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Όνομα</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Διάρκεια (λεπτά)</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={form.duration_minutes}
                onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))}
                placeholder="π.χ. 30"
              />
            </div>
            <div className="space-y-2">
              <Label>Τιμή (€)</Label>
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="π.χ. 25.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Περιγραφή</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Ακύρωση</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "Αποθήκευση..." : "Αποθήκευση"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

