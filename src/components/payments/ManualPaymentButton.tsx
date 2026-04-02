import { useEffect, useState } from "react"
import { Banknote } from "lucide-react"
import { useLanguage } from "@/contexts/LanguageContext"
import type { AppLanguage } from "@/contexts/LanguageContext"
import { fetchCustomers, createCustomer, createManualPaymentRecord } from "@/services/api"
import type { Customer } from "@/types"
import { CustomerForm } from "@/components/customers/CustomerForm"
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

const copy: Record<
  AppLanguage,
  {
    button: string
    title: string
    description: string
    customer: string
    newCustomer: string
    selectPlaceholder: string
    loadingCustomers: string
    selectNone: string
    amount: string
    method: string
    methodPlaceholder: string
    notes: string
    notesPlaceholder: string
    cancel: string
    submit: string
    saving: string
    errorTitle: string
    errNoCustomer: string
    errAmount: string
    successTitle: string
    successDesc: string
    errSave: string
    newCustomerTitle: string
    newCustomerDesc: string
    customerSavedTitle: string
    customerSavedDesc: string
    errCustomerSave: string
  }
> = {
  el: {
    button: "Χειροκίνητη πληρωμή",
    title: "Χειροκίνητη πληρωμή",
    description:
      "Επιλέξτε πελάτη, εισάγετε το ποσό που ελήφθη και τον τρόπο πληρωμής. Αν ο πελάτης δεν υπάρχει στη λίστα, χρησιμοποιήστε «Νέος πελάτης».",
    customer: "Πελάτης",
    newCustomer: "Νέος πελάτης",
    selectPlaceholder: "Επιλέξτε πελάτη",
    loadingCustomers: "Φόρτωση...",
    selectNone: "— Επιλέξτε πελάτη —",
    amount: "Ποσό που ελήφθη (€)",
    method: "Τρόπος πληρωμής",
    methodPlaceholder: "π.χ. Μετρητά, Κάρτα, Τραπεζική κατάθεση",
    notes: "Σημειώσεις",
    notesPlaceholder: "Προαιρετικά",
    cancel: "Ακύρωση",
    submit: "Καταχώρηση πληρωμής",
    saving: "Αποθήκευση...",
    errorTitle: "Σφάλμα",
    errNoCustomer: "Επιλέξτε πελάτη ή καταχωρήστε νέο πελάτη.",
    errAmount: "Εισάγετε έγκυρο θετικό ποσό πληρωμής.",
    successTitle: "Πληρωμή καταχωρήθηκε",
    successDesc: "Η χειροκίνητη πληρωμή αποθηκεύτηκε.",
    errSave: "Αποτυχία καταχώρησης πληρωμής",
    newCustomerTitle: "Νέος πελάτης",
    newCustomerDesc: "Μετά την αποθήκευση ο πελάτης θα επιλεγεί αυτόματα για τη χειροκίνητη πληρωμή.",
    customerSavedTitle: "Πελάτης αποθηκεύτηκε",
    customerSavedDesc: "Μπορείτε να συνεχίσετε με την πληρωμή.",
    errCustomerSave: "Αποτυχία αποθήκευσης",
  },
  en: {
    button: "Record payment",
    title: "Manual payment",
    description:
      "Select a customer, enter the amount received and payment method. If the customer is not in the list, use “New customer”.",
    customer: "Customer",
    newCustomer: "New customer",
    selectPlaceholder: "Select customer",
    loadingCustomers: "Loading...",
    selectNone: "— Select customer —",
    amount: "Amount received (€)",
    method: "Payment method",
    methodPlaceholder: "e.g. Cash, Card, Bank transfer",
    notes: "Notes",
    notesPlaceholder: "Optional",
    cancel: "Cancel",
    submit: "Save payment",
    saving: "Saving...",
    errorTitle: "Error",
    errNoCustomer: "Select a customer or add a new one.",
    errAmount: "Enter a valid positive amount.",
    successTitle: "Payment recorded",
    successDesc: "The manual payment was saved.",
    errSave: "Could not save payment",
    newCustomerTitle: "New customer",
    newCustomerDesc: "After saving, this customer will be selected for the payment.",
    customerSavedTitle: "Customer saved",
    customerSavedDesc: "You can continue with the payment.",
    errCustomerSave: "Could not save customer",
  },
}

type ManualPaymentButtonProps = {
  businessId: string | null
  /** Called after a successful payment save (e.g. refresh lists / stats). */
  onSuccess?: () => void | Promise<void>
  className?: string
  /** Full width on small screens (e.g. in Payments card). */
  fullWidthMobile?: boolean
}

export function ManualPaymentButton({
  businessId,
  onSuccess,
  className,
  fullWidthMobile = true,
}: ManualPaymentButtonProps) {
  const { language } = useLanguage()
  const t = copy[language]
  const { toast } = useToast()

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
    if (!manualOpen || !businessId) return
    setCustomersLoading(true)
    fetchCustomers(businessId)
      .then(setCustomers)
      .finally(() => setCustomersLoading(false))
  }, [manualOpen, businessId])

  function openManual() {
    setManualCustomerId("")
    setManualAmount("")
    setManualMethod("")
    setManualNotes("")
    setManualOpen(true)
  }

  async function handleManualSave() {
    if (!businessId) return
    if (!manualCustomerId) {
      toast({ title: t.errorTitle, description: t.errNoCustomer, variant: "destructive" })
      return
    }
    const amt = Number(manualAmount.replace(",", "."))
    if (!Number.isFinite(amt) || amt <= 0) {
      toast({ title: t.errorTitle, description: t.errAmount, variant: "destructive" })
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
      await onSuccess?.()
      toast({ title: t.successTitle, description: t.successDesc })
      setManualOpen(false)
    } catch (err) {
      console.error("Manual payment error:", err)
      const message = err instanceof Error ? err.message : t.errSave
      toast({ title: t.errorTitle, description: message, variant: "destructive" })
    } finally {
      setManualSaving(false)
    }
  }

  if (!businessId) return null

  return (
    <>
      <Button
        type="button"
        className={fullWidthMobile ? `w-full sm:w-auto shrink-0 ${className ?? ""}` : className}
        onClick={openManual}
      >
        <Banknote className="h-4 w-4 mr-2" />
        {t.button}
      </Button>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.title}</DialogTitle>
            <DialogDescription>{t.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="mp-customer">{t.customer}</Label>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto px-0 py-0 text-xs"
                  onClick={() => setCreateCustomerOpen(true)}
                >
                  {t.newCustomer}
                </Button>
              </div>
              <Select
                value={manualCustomerId || "none"}
                onValueChange={(v) => setManualCustomerId(v === "none" ? "" : v)}
                disabled={customersLoading}
              >
                <SelectTrigger id="mp-customer">
                  <SelectValue placeholder={customersLoading ? t.loadingCustomers : t.selectPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t.selectNone}</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mp-amount">{t.amount}</Label>
              <Input
                id="mp-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mp-method">{t.method}</Label>
              <Input
                id="mp-method"
                placeholder={t.methodPlaceholder}
                value={manualMethod}
                onChange={(e) => setManualMethod(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mp-notes">{t.notes}</Label>
              <Input
                id="mp-notes"
                placeholder={t.notesPlaceholder}
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setManualOpen(false)} disabled={manualSaving}>
                {t.cancel}
              </Button>
              <Button type="button" onClick={handleManualSave} disabled={manualSaving}>
                {manualSaving ? t.saving : t.submit}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createCustomerOpen} onOpenChange={setCreateCustomerOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.newCustomerTitle}</DialogTitle>
            <DialogDescription>{t.newCustomerDesc}</DialogDescription>
          </DialogHeader>
          <CustomerForm
            onCancel={() => setCreateCustomerOpen(false)}
            onSubmit={async (payload) => {
              try {
                const created = await createCustomer({ ...payload, business_id: businessId })
                setCustomers((prev) => [created, ...prev])
                setManualCustomerId(created.id)
                setCreateCustomerOpen(false)
                toast({ title: t.customerSavedTitle, description: t.customerSavedDesc })
              } catch (err) {
                console.error(err)
                const message = err instanceof Error ? err.message : t.errCustomerSave
                toast({ title: t.errCustomerSave, description: message, variant: "destructive" })
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
