import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { CreditCard, Euro, Pencil, PlusCircle, CheckCircle2, Banknote } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import {
  fetchPayments,
  updatePayment,
  fetchPaymentById,
  notifyPaymentRecordChange,
  fetchCustomers,
  createCustomer,
  createManualPaymentRecord,
} from "@/services/api"
import type { Customer, Payment, PaymentStatus } from "@/types"
import { CustomerForm } from "@/components/customers/CustomerForm"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

type PaymentRow = {
  id: string
  amount: number
  payment_method: string | null
  payment_status: string
  paid_amount: number | null
  remaining_balance: number | null
  created_at: string
  appointment_job?: {
    id: string
    title: string
    scheduled_date: string
    customer?: { first_name: string; last_name: string }
  }
}

export default function Payments() {
  const { businessId } = useAuth()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"edit" | "add" | "markPaid" | null>(null)
  const [activePayment, setActivePayment] = useState<PaymentRow | null>(null)
  const [amountInput, setAmountInput] = useState("")
  const [methodInput, setMethodInput] = useState("")
  const [notesInput, setNotesInput] = useState("")
  const [saving, setSaving] = useState(false)

  const [manualOpen, setManualOpen] = useState(false)
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customersLoading, setCustomersLoading] = useState(false)
  const [manualCustomerId, setManualCustomerId] = useState("")
  const [manualAmount, setManualAmount] = useState("")
  const [manualMethod, setManualMethod] = useState("")
  const [manualNotes, setManualNotes] = useState("")
  const [manualSaving, setManualSaving] = useState(false)

  useEffect(() => {
    if (!businessId) return
    fetchPayments(businessId).then((data) => setPayments(data as PaymentRow[])).finally(() => setLoading(false))
  }, [businessId])

  useEffect(() => {
    if (!manualOpen || !businessId) return
    setCustomersLoading(true)
    fetchCustomers(businessId)
      .then(setCustomers)
      .finally(() => setCustomersLoading(false))
  }, [manualOpen, businessId])

  function openManualPayment() {
    setManualCustomerId("")
    setManualAmount("")
    setManualMethod("")
    setManualNotes("")
    setManualOpen(true)
  }

  async function handleManualSave() {
    if (!businessId) return
    if (!manualCustomerId) {
      toast({
        title: "Σφάλμα",
        description: "Επιλέξτε πελάτη ή καταχωρήστε νέο πελάτη.",
        variant: "destructive",
      })
      return
    }
    const amt = Number(manualAmount.replace(",", "."))
    if (!Number.isFinite(amt) || amt <= 0) {
      toast({
        title: "Σφάλμα",
        description: "Εισάγετε έγκυρο θετικό ποσό πληρωμής.",
        variant: "destructive",
      })
      return
    }
    try {
      setManualSaving(true)
      await createManualPaymentRecord({
        businessId,
        customerId: manualCustomerId,
        amount: amt,
        paymentMethod: manualMethod.trim() || null,
        notes: manualNotes.trim() || null,
      })
      const data = await fetchPayments(businessId)
      setPayments(data as PaymentRow[])
      toast({ title: "Πληρωμή καταχωρήθηκε", description: "Η χειροκίνητη πληρωμή αποθηκεύτηκε." })
      setManualOpen(false)
    } catch (err) {
      console.error("Manual payment error:", err)
      const message = err instanceof Error ? err.message : "Αποτυχία καταχώρησης πληρωμής"
      toast({ title: "Σφάλμα", description: message, variant: "destructive" })
    } finally {
      setManualSaving(false)
    }
  }

  const statusVariant = (s: string) =>
    s === "paid" ? "completed" : s === "partial" ? "pending" : "destructive"

  function openDialog(mode: "edit" | "add" | "markPaid", payment: PaymentRow) {
    setDialogMode(mode)
    setActivePayment(payment)
    if (mode === "edit") {
      setAmountInput(String(payment.amount ?? 0))
      setMethodInput(payment.payment_method ?? "")
      setNotesInput("") // keep notes outside summary for now
    } else if (mode === "add") {
      setAmountInput("")
      setMethodInput(payment.payment_method ?? "")
      setNotesInput("")
    } else {
      setAmountInput(String(payment.amount ?? 0))
      setMethodInput(payment.payment_method ?? "")
      setNotesInput("")
    }
    setDialogOpen(true)
  }

  const paymentFromQuery = searchParams.get("payment")

  useEffect(() => {
    if (!paymentFromQuery || !businessId) return
    let cancelled = false
    ;(async () => {
      const found = payments.find((p) => p.id === paymentFromQuery)
      if (found) {
        if (!cancelled) {
          openDialog("edit", found)
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev)
              next.delete("payment")
              return next
            },
            { replace: true },
          )
        }
        return
      }
      if (loading) return
      const p = await fetchPaymentById(paymentFromQuery)
      if (cancelled) return
      if (!p) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.delete("payment")
            return next
          },
          { replace: true },
        )
        return
      }
      const aj = (p as Payment & { appointment_job?: PaymentRow["appointment_job"] }).appointment_job
      const row: PaymentRow = {
        id: p.id,
        amount: p.amount,
        payment_method: p.payment_method,
        payment_status: p.payment_status,
        paid_amount: p.paid_amount,
        remaining_balance: p.remaining_balance,
        created_at: p.created_at,
        appointment_job: aj,
      }
      openDialog("edit", row)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete("payment")
          return next
        },
        { replace: true },
      )
    })()
    return () => {
      cancelled = true
    }
  }, [paymentFromQuery, businessId, payments, loading, setSearchParams])

  async function handleSave() {
    if (!activePayment || !dialogMode || !businessId) return
    try {
      const baseAmount = Number(activePayment.amount ?? 0)
      const currentPaid = Number(activePayment.paid_amount ?? 0)
      let newAmount = baseAmount
      let newPaid = currentPaid

      if (dialogMode === "edit") {
        newAmount = Number(amountInput || 0)
        newPaid = currentPaid
      } else if (dialogMode === "add") {
        const additional = Number(amountInput || 0)
        if (additional <= 0) {
          toast({ title: "Σφάλμα", description: "Το πρόσθετο ποσό πρέπει να είναι θετικό.", variant: "destructive" })
          return
        }
        newPaid = currentPaid + additional
      } else if (dialogMode === "markPaid") {
        newAmount = baseAmount > 0 ? baseAmount : currentPaid || Number(amountInput || 0)
        newPaid = newAmount
      }

      if (!Number.isFinite(newAmount) || newAmount < 0) newAmount = 0
      if (!Number.isFinite(newPaid) || newPaid < 0) newPaid = 0

      let newStatus: "unpaid" | "partial" | "paid" = "unpaid"
      if (newPaid <= 0) newStatus = "unpaid"
      else if (newPaid < newAmount) newStatus = "partial"
      else newStatus = "paid"

      const remaining = Math.max(0, newAmount - newPaid)

      setSaving(true)
      const prevPayment: Payment = {
        id: activePayment.id,
        business_id: businessId,
        appointment_job_id: activePayment.appointment_job?.id ?? "",
        amount: baseAmount,
        payment_method: activePayment.payment_method,
        payment_status: activePayment.payment_status as PaymentStatus,
        deposit: null,
        paid_amount: activePayment.paid_amount,
        remaining_balance: activePayment.remaining_balance,
        notes: null,
        created_at: activePayment.created_at,
        updated_at: activePayment.created_at,
      }
      const updated = await updatePayment(activePayment.id, {
        amount: newAmount,
        paid_amount: newPaid,
        remaining_balance: remaining,
        payment_status: newStatus,
        payment_method: methodInput || null,
        notes: notesInput || null,
      })
      notifyPaymentRecordChange(businessId, prevPayment, updated)
      setPayments((prev) => prev.map((p) => (p.id === updated.id ? { ...(p as PaymentRow), ...updated } : p)))
      toast({ title: "Πληρωμή ενημερώθηκε", description: "Οι αλλαγές αποθηκεύτηκαν." })
      setDialogOpen(false)
    } catch (err) {
      console.error("Update payment error:", err)
      const message = err instanceof Error ? err.message : "Αποτυχία ενημέρωσης πληρωμής"
      toast({ title: "Σφάλμα", description: message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Πληρωμές</h1>
        <p className="text-muted-foreground">Ιστορικό και κατάσταση πληρωμών</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              <span>Λίστα πληρωμών</span>
            </div>
            <Button type="button" className="w-full sm:w-auto shrink-0" onClick={openManualPayment}>
              <Banknote className="h-4 w-4 mr-2" />
              Χειροκίνητη πληρωμή
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Euro className="h-12 w-12 mb-4 opacity-50" />
              <p>Δεν υπάρχουν πληρωμές</p>
            </div>
          ) : (
            <>
            <div className="space-y-2 md:hidden">
              {payments.map((p) => (
                <div key={`mobile-${p.id}`} className="rounded-lg border border-border/60 bg-card/60 p-3">
                  <p className="text-xs text-muted-foreground">{formatDate(p.created_at)}</p>
                  <p className="font-medium">{p.appointment_job?.title ?? "—"}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.appointment_job?.customer ? `${p.appointment_job.customer.first_name} ${p.appointment_job.customer.last_name}` : "—"}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span>{formatCurrency(Number(p.amount))}</span>
                    <Badge variant={statusVariant(p.payment_status) as "completed" | "pending" | "destructive"}>
                      {p.payment_status === "paid" ? "Πληρωμένο" : p.payment_status === "partial" ? "Μερικό" : "Απλήρωτο"}
                    </Badge>
                  </div>
                  <div className="mt-2 flex gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => openDialog("edit", p)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => openDialog("add", p)}>
                      <PlusCircle className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => openDialog("markPaid", p)}>
                      <CheckCircle2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden rounded-md border overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ημ/νία</TableHead>
                    <TableHead>Ραντεβού / Πελάτης</TableHead>
                    <TableHead>Ποσό</TableHead>
                    <TableHead>Τρόπος</TableHead>
                    <TableHead>Κατάσταση</TableHead>
                    <TableHead>Πληρωμένο</TableHead>
                    <TableHead>Υπόλοιπο</TableHead>
                    <TableHead className="w-[180px]">Ενέργειες</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(p.created_at)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{p.appointment_job?.title ?? "—"}</p>
                          {p.appointment_job?.customer && (
                            <p className="text-sm text-muted-foreground">
                              {p.appointment_job.customer.first_name} {p.appointment_job.customer.last_name}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(Number(p.amount))}</TableCell>
                      <TableCell>{p.payment_method ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(p.payment_status) as "completed" | "pending" | "destructive"}>
                          {p.payment_status === "paid" ? "Πληρωμένο" : p.payment_status === "partial" ? "Μερικό" : "Απλήρωτο"}
                        </Badge>
                      </TableCell>
                      <TableCell>{p.paid_amount != null ? formatCurrency(Number(p.paid_amount)) : "—"}</TableCell>
                      <TableCell>{p.remaining_balance != null ? formatCurrency(Number(p.remaining_balance)) : "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openDialog("edit", p)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openDialog("add", p)}
                          >
                            <PlusCircle className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openDialog("markPaid", p)}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                          </Button>
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

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Χειροκίνητη πληρωμή</DialogTitle>
            <DialogDescription>
              Επιλέξτε πελάτη, εισάγετε το ποσό που ελήφθη και τον τρόπο πληρωμής. Αν ο πελάτης δεν υπάρχει στη λίστα,
              χρησιμοποιήστε «Νέος πελάτης».
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="manual-customer">Πελάτης</Label>
                <Button type="button" variant="link" className="h-auto px-0 py-0 text-xs" onClick={() => setCreateCustomerOpen(true)}>
                  Νέος πελάτης
                </Button>
              </div>
              <Select
                value={manualCustomerId || "none"}
                onValueChange={(v) => setManualCustomerId(v === "none" ? "" : v)}
                disabled={customersLoading}
              >
                <SelectTrigger id="manual-customer">
                  <SelectValue placeholder={customersLoading ? "Φόρτωση..." : "Επιλέξτε πελάτη"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Επιλέξτε πελάτη —</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-amount">Ποσό που ελήφθη (€)</Label>
              <Input
                id="manual-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-method">Τρόπος πληρωμής</Label>
              <Input
                id="manual-method"
                placeholder="π.χ. Μετρητά, Κάρτα, Τραπεζική κατάθεση"
                value={manualMethod}
                onChange={(e) => setManualMethod(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-notes-pay">Σημειώσεις</Label>
              <Input
                id="manual-notes-pay"
                placeholder="Προαιρετικά"
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setManualOpen(false)} disabled={manualSaving}>
                Ακύρωση
              </Button>
              <Button type="button" onClick={handleManualSave} disabled={manualSaving}>
                {manualSaving ? "Αποθήκευση..." : "Καταχώρηση πληρωμής"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createCustomerOpen} onOpenChange={setCreateCustomerOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Νέος πελάτης</DialogTitle>
            <DialogDescription>
              Μετά την αποθήκευση ο πελάτης θα επιλεγεί αυτόματα για τη χειροκίνητη πληρωμή.
            </DialogDescription>
          </DialogHeader>
          <CustomerForm
            onCancel={() => setCreateCustomerOpen(false)}
            onSubmit={async (payload) => {
              if (!businessId) return
              try {
                const created = await createCustomer({ ...payload, business_id: businessId })
                setCustomers((prev) => [created, ...prev])
                setManualCustomerId(created.id)
                setCreateCustomerOpen(false)
                toast({ title: "Πελάτης αποθηκεύτηκε", description: "Μπορείτε να συνεχίσετε με την πληρωμή." })
              } catch (err) {
                console.error(err)
                const message = err instanceof Error ? err.message : "Αποτυχία αποθήκευσης"
                toast({ title: "Σφάλμα", description: message, variant: "destructive" })
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "edit"
                ? "Επεξεργασία πληρωμής"
                : dialogMode === "add"
                  ? "Πρόσθετη πληρωμή"
                  : "Σήμανση ως πληρωμένο"}
            </DialogTitle>
          </DialogHeader>
          {activePayment && dialogMode && (
            <div className="space-y-4">
              {dialogMode !== "edit" && (
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p className="font-medium">{activePayment.appointment_job?.title}</p>
                  {activePayment.appointment_job?.customer && (
                    <p>
                      {activePayment.appointment_job.customer.first_name}{" "}
                      {activePayment.appointment_job.customer.last_name}
                    </p>
                  )}
                </div>
              )}
              {dialogMode !== "markPaid" && (
                <div className="space-y-2">
                  <Label htmlFor="payment-amount">
                    {dialogMode === "edit" ? "Συνολικό ποσό (€)" : "Πρόσθετο ποσό (€)"}
                  </Label>
                  <Input
                    id="payment-amount"
                    type="number"
                    step="0.01"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                  />
                </div>
              )}
              {dialogMode === "markPaid" && (
                <p className="text-sm text-muted-foreground">
                  Το υπόλοιπο θα μηδενιστεί και η πληρωμή θα σημειωθεί ως πλήρως εξοφλημένη.
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="payment-method-dialog">Τρόπος πληρωμής</Label>
                <Input
                  id="payment-method-dialog"
                  placeholder="π.χ. Μετρητά, Κάρτα"
                  value={methodInput}
                  onChange={(e) => setMethodInput(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-notes-dialog">Σημειώσεις</Label>
                <Input
                  id="payment-notes-dialog"
                  placeholder="Σημειώσεις"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                  Ακύρωση
                </Button>
                <Button type="button" onClick={handleSave} disabled={saving}>
                  {saving ? "Αποθήκευση..." : "Αποθήκευση"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
