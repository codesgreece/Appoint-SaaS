import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { CalendarView } from "@/components/appointments/CalendarView"
import { AppointmentForm } from "@/components/appointments/AppointmentForm"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { useToast } from "@/hooks/use-toast"
import { fetchCustomers, fetchServices, fetchTeam } from "@/services/api"
import type { Customer, Service, User } from "@/types"

export default function Calendar() {
  const { businessId } = useAuth()
  const { toast } = useToast()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [team, setTeam] = useState<User[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [presetDate, setPresetDate] = useState<string | null>(null)

  useEffect(() => {
    if (!businessId) return
    Promise.all([fetchCustomers(businessId), fetchTeam(businessId), fetchServices(businessId)])
      .then(([cust, tm, svc]) => {
        setCustomers(cust)
        setTeam(tm)
        setServices(svc)
      })
      .catch(() =>
        toast({
          title: "Σφάλμα",
          description: "Αποτυχία φόρτωσης δεδομένων για το ημερολόγιο.",
          variant: "destructive",
        }),
      )
  }, [businessId])

  function handleSaved() {
    setDialogOpen(false)
    setPresetDate(null)
    toast({ title: "Αποθηκεύτηκε", description: "Το ραντεβού δημιουργήθηκε." })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ημερολόγιο</h1>
          <p className="text-muted-foreground">Ραντεβού ανά ημέρα</p>
        </div>
      </div>
      <CalendarView
        businessId={businessId}
        onCreateFromDate={(date) => {
          setPresetDate(date)
          setDialogOpen(true)
        }}
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setPresetDate(null)
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Νέο ραντεβού</DialogTitle>
          </DialogHeader>
          <ErrorBoundary
            onReset={() => {
              setDialogOpen(false)
              setPresetDate(null)
            }}
          >
            <AppointmentForm
              presetDate={presetDate ?? undefined}
              customers={customers}
              team={team}
              services={services}
              businessId={businessId}
              onSaved={handleSaved}
              onCancel={() => {
                setDialogOpen(false)
                setPresetDate(null)
              }}
            />
          </ErrorBoundary>
        </DialogContent>
      </Dialog>
    </div>
  )
}
