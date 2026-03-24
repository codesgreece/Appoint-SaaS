import { useEffect, useState } from "react"
import { CreditCard, Euro, Pencil, PlusCircle, CheckCircle2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { fetchPayments, updatePayment } from "@/services/api"
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"edit" | "add" | "markPaid" | null>(null)
  const [activePayment, setActivePayment] = useState<PaymentRow | null>(null)
  const [amountInput, setAmountInput] = useState("")
  const [methodInput, setMethodInput] = useState("")
  const [notesInput, setNotesInput] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!businessId) return
    fetchPayments(businessId).then((data) => setPayments(data as PaymentRow[])).finally(() => setLoading(false))
  }, [businessId])

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

  async function handleSave() {
    if (!activePayment || !dialogMode) return
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
      const updated = await updatePayment(activePayment.id, {
        amount: newAmount,
        paid_amount: newPaid,
        remaining_balance: remaining,
        payment_status: newStatus,
        payment_method: methodInput || null,
        notes: notesInput || null,
      })
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
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            <span>Λίστα πληρωμών</span>
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
            <div className="rounded-md border overflow-x-auto">
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
          )}
        </CardContent>
      </Card>

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
