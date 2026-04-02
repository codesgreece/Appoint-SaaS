import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useLanguage } from "@/contexts/LanguageContext"
import { CalendarView } from "@/components/appointments/CalendarView"
import { AppointmentForm } from "@/components/appointments/AppointmentForm"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { useToast } from "@/hooks/use-toast"
import { fetchCustomers, fetchServices, fetchTeam, fetchCrews } from "@/services/api"
import type { Customer, Service, User, Crew } from "@/types"

const i18n = {
  el: {
    errorLoad: "Αποτυχία φόρτωσης δεδομένων για το ημερολόγιο.",
    saved: "Αποθηκεύτηκε",
    created: "Το ραντεβού δημιουργήθηκε.",
    title: "Ημερολόγιο",
    subtitle: "Ραντεβού ανά ημέρα",
    newAppointment: "Νέο ραντεβού",
  },
  en: {
    errorLoad: "Failed to load calendar data.",
    saved: "Saved",
    created: "Appointment created.",
    title: "Calendar",
    subtitle: "Appointments per day",
    newAppointment: "New appointment",
  },
  de: {
    errorLoad: "Kalenderdaten konnten nicht geladen werden.",
    saved: "Gespeichert",
    created: "Termin wurde angelegt.",
    title: "Kalender",
    subtitle: "Termine pro Tag",
    newAppointment: "Neuer Termin",
  },
} as const

export default function Calendar() {
  const { businessId } = useAuth()
  const { language } = useLanguage()
  const t = i18n[language]
  const { toast } = useToast()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [team, setTeam] = useState<User[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [presetDate, setPresetDate] = useState<string | null>(null)

  useEffect(() => {
    if (!businessId) return
    Promise.all([fetchCustomers(businessId), fetchTeam(businessId), fetchCrews(businessId), fetchServices(businessId)])
      .then(([cust, tm, cr, svc]) => {
        setCustomers(cust)
        setTeam(tm)
        setCrews(cr)
        setServices(svc)
      })
      .catch(() =>
        toast({
          title: language === "en" ? "Error" : language === "de" ? "Fehler" : "Σφάλμα",
          description: t.errorLoad,
          variant: "destructive",
        }),
      )
  }, [businessId])

  function handleSaved() {
    setDialogOpen(false)
    setPresetDate(null)
    toast({ title: t.saved, description: t.created })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-muted-foreground">{t.subtitle}</p>
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
            <DialogTitle>{t.newAppointment}</DialogTitle>
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
              crews={crews}
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
