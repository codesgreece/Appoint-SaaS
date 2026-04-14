import { useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type { AppointmentJob, AppointmentJobStatus, Customer, User, Service, Crew, Payment, PaymentStatus } from "@/types"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertCircle, ChevronDown, Clock } from "lucide-react"
import { cn, formatDate, localIsoDate } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useLanguage } from "@/contexts/LanguageContext"
import type { AppLanguage } from "@/contexts/LanguageContext"
import { uiLang } from "@/lib/app-language"

const statusOptions: AppointmentJobStatus[] = [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
  "rescheduled",
]

function statusLabelsFor(lang: AppLanguage): Record<AppointmentJobStatus, string> {
  if (lang === "en") {
    return {
      pending: "Pending",
      confirmed: "Confirmed",
      in_progress: "In progress",
      completed: "Completed",
      cancelled: "Cancelled",
      no_show: "No-show",
      rescheduled: "Rescheduled",
    }
  }
  if (lang === "de") {
    return {
      pending: "Ausstehend",
      confirmed: "Bestätigt",
      in_progress: "In Bearbeitung",
      completed: "Abgeschlossen",
      cancelled: "Storniert",
      no_show: "Nicht erschienen",
      rescheduled: "Verschoben",
    }
  }
  return {
    pending: "Εκκρεμεί",
    confirmed: "Επιβεβαιωμένο",
    in_progress: "Σε εξέλιξη",
    completed: "Ολοκληρώθηκε",
    cancelled: "Ακυρώθηκε",
    no_show: "Δεν εμφανίστηκε",
    rescheduled: "Επαναπρογραμματισμένο",
  }
}

function buildAppointmentSchema(lang: AppLanguage) {
  const req = lang === "en" ? "Required" : lang === "de" ? "Erforderlich" : "Απαιτείται"
  const pickCustomer = lang === "en" ? "Select a customer" : lang === "de" ? "Kunde wählen" : "Επιλέξτε πελάτη"
  const reqDate = lang === "en" ? "Date is required" : lang === "de" ? "Datum ist erforderlich" : "Απαιτείται ημερομηνία"
  return z.object({
    title: z.string().min(1, req),
    customer_id: z.string().min(1, pickCustomer),
    assigned_user_id: z.string().optional(),
    crew_id: z.string().optional(),
    service_id: z.string().optional(),
    status: z.enum(
      ["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show", "rescheduled"] as [
        AppointmentJobStatus,
        ...AppointmentJobStatus[],
      ],
    ),
    scheduled_date: z.string().min(1, reqDate),
    start_time: z.string().min(1),
    end_time: z.string().min(1),
    description: z.string().optional(),
    cost_estimate: z.coerce.number().optional().nullable(),
    final_cost: z.coerce.number().optional().nullable(),
    creation_notes: z.string().optional(),
    completion_notes: z.string().optional(),
    recurrence_rule: z.string().optional().nullable(),
    location_address: z.string().optional(),
  })
}

type FormValues = z.infer<ReturnType<typeof buildAppointmentSchema>>

function toTimeInputValue(t: string | undefined | null): string {
  if (!t) return "09:00"
  const s = String(t)
  if (/^\d{2}:\d{2}$/.test(s)) return s
  const match = s.match(/^(\d{1,2}):(\d{2})/)
  if (match) return `${match[1].padStart(2, "0")}:${match[2]}`
  return "09:00"
}

function addMinutesToTime(timeHHMM: string, minutes: number): string {
  const [hh, mm] = timeHHMM.split(":").map((x) => Number(x))
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return timeHHMM
  const total = hh * 60 + mm + minutes
  const next = ((total % (24 * 60)) + (24 * 60)) % (24 * 60)
  const nh = Math.floor(next / 60)
  const nm = next % 60
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`
}

function timeToMinutes(timeHHMM: string): number {
  const [hh, mm] = timeHHMM.split(":").map((x) => Number(x))
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0
  return hh * 60 + mm
}

function minutesToHHMM(total: number): string {
  const h = Math.floor(total / 60) % 24
  const mm = total % 60
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
}

/** Ίδιο φίλτρο με το overlap στο submit: μπλοκάρει μόνο αν ίδιος υπεύθυνος ή κενό από τη μία πλευρά. */
function appointmentCanBlockSlot(myAssigned: string | undefined | null, a: AppointmentJob): boolean {
  if (myAssigned && a.assigned_user_id && a.assigned_user_id !== myAssigned) return false
  return true
}

function slotOverlapsExisting(
  startMin: number,
  endMin: number,
  dayApps: AppointmentJob[],
  myAssigned: string | undefined | null,
  excludeAppointmentId?: string,
): boolean {
  if (endMin <= startMin) return true
  return dayApps.some((a) => {
    if (excludeAppointmentId && a.id === excludeAppointmentId) return false
    if (!appointmentCanBlockSlot(myAssigned, a)) return false
    const ex = timeToMinutes(toTimeInputValue(a.start_time))
    const ee = timeToMinutes(toTimeInputValue(a.end_time))
    return startMin < ee && endMin > ex
  })
}

const SLOT_STEP_MIN = 15
const BUSINESS_DAY_START_MIN = 8 * 60
const BUSINESS_DAY_END_MIN = 22 * 60

function generateAvailableStartTimes(
  durationMin: number,
  dayApps: AppointmentJob[],
  myAssigned: string | undefined | null,
  windowStartMin = BUSINESS_DAY_START_MIN,
  windowEndMin = BUSINESS_DAY_END_MIN,
  excludeAppointmentId?: string,
): string[] {
  const dur = Math.max(15, durationMin)
  const out: string[] = []
  const lastStart = windowEndMin - dur
  if (lastStart < windowStartMin) return out
  for (let m = windowStartMin; m <= lastStart; m += SLOT_STEP_MIN) {
    const endM = m + dur
    if (endM > windowEndMin) break
    if (!slotOverlapsExisting(m, endM, dayApps, myAssigned, excludeAppointmentId)) {
      out.push(minutesToHHMM(m))
    }
  }
  return out
}

function parseNonNegativeNumber(raw: string): number {
  const normalized = String(raw ?? "").trim().replace(",", ".")
  if (!normalized) return 0
  const n = Number(normalized)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

function toDateInputValue(d: string | Date | undefined | null): string {
  if (!d) return ""
  const date = typeof d === "string" ? new Date(d) : d
  if (isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}

function addMonthsToDate(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number)
  const base = new Date(y, (m ?? 1) - 1, d ?? 1)
  const target = new Date(base.getFullYear(), base.getMonth() + months, base.getDate())
  return target.toISOString().slice(0, 10)
}

interface AppointmentFormProps {
  initial?: Partial<AppointmentJob> & {
    customer?: Customer
    assigned_user?: User | Pick<User, "full_name" | "email"> | null
  }
  customers?: Customer[] | null
  team?: User[] | null
  crews?: Crew[] | null
  services?: Service[] | null
  businessId: string | null
  presetDate?: string
  onSaved: () => void
  onCancel: () => void
}

export function AppointmentForm({
  initial,
  customers,
  team,
  crews,
  services,
  businessId,
  presetDate,
  onSaved,
  onCancel,
}: AppointmentFormProps) {
  const { toast } = useToast()
  const { language } = useLanguage()
  const tr = (en: string, el: string, de: string) => uiLang(language, en, el, de)
  const safeCustomers = Array.isArray(customers) ? customers : []
  const safeTeam = Array.isArray(team) ? team : []
  const safeCrews = Array.isArray(crews) ? crews : []
  const safeServices = Array.isArray(services) ? services : []

  const [customerOptions, setCustomerOptions] = useState<Customer[]>(safeCustomers)
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false)
  const [newFirstName, setNewFirstName] = useState("")
  const [newLastName, setNewLastName] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newAddress, setNewAddress] = useState("")
  const [newArea, setNewArea] = useState("")
  const [newPostalCode, setNewPostalCode] = useState("")
  const [newCompany, setNewCompany] = useState("")
  const [newVatNumber, setNewVatNumber] = useState("")
  const [newNotes, setNewNotes] = useState("")
  const [newTags, setNewTags] = useState("")
  const [creatingCustomer, setCreatingCustomer] = useState(false)

  useEffect(() => {
    setCustomerOptions(Array.isArray(customers) ? customers : [])
  }, [customers])

  const today = localIsoDate(new Date())
  const defaultDate = presetDate ?? today

  let initError: string | null = null
  let defaultValues: FormValues

  try {
    defaultValues = initial
      ? {
          title: initial.title ?? "",
          customer_id: initial.customer_id ?? "",
          assigned_user_id: initial.assigned_user_id ?? "",
          crew_id: initial.crew_id ?? "",
          service_id: initial.service_id ?? "",
          status: (initial.status as FormValues["status"]) || "pending",
          scheduled_date: toDateInputValue(initial.scheduled_date),
          start_time: toTimeInputValue(initial.start_time),
          end_time: toTimeInputValue(initial.end_time),
          description: initial.description ?? "",
          cost_estimate: initial.cost_estimate != null ? Number(initial.cost_estimate) : undefined,
          final_cost: initial.final_cost != null ? Number(initial.final_cost) : undefined,
          creation_notes: initial.creation_notes ?? "",
          completion_notes: initial.completion_notes ?? "",
          recurrence_rule: initial.recurrence_rule ?? "",
          location_address: initial.location_address ?? "",
        }
      : {
          title: "",
          customer_id: "",
          assigned_user_id: "",
          crew_id: "",
          service_id: "",
          status: "pending",
          scheduled_date: defaultDate,
          start_time: "09:00",
          end_time: "10:00",
          description: "",
          cost_estimate: undefined,
          final_cost: undefined,
          creation_notes: "",
          completion_notes: "",
          recurrence_rule: "",
          location_address: "",
        }
  } catch (e) {
    console.error("AppointmentForm init error:", e)
    initError =
      e instanceof Error
        ? e.message
        : uiLang(
            language,
            "Unexpected error loading the form.",
            "Απροσδόκητο σφάλμα φόρτωσης φόρμας.",
            "Unerwarteter Fehler beim Laden des Formulars.",
          )
    defaultValues = {
      title: "",
      customer_id: "",
      assigned_user_id: "",
      crew_id: "",
      service_id: "",
      status: "pending",
      scheduled_date: defaultDate,
      start_time: "09:00",
      end_time: "10:00",
      description: "",
      cost_estimate: undefined,
      final_cost: undefined,
      creation_notes: "",
      completion_notes: "",
      recurrence_rule: "",
      location_address: "",
    }
  }

  const schema = useMemo(() => buildAppointmentSchema(language), [language])
  const statusLabels = useMemo(() => statusLabelsFor(language), [language])

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  const customerIdRaw = watch("customer_id") ?? ""
  const assignedUserIdRaw = watch("assigned_user_id") ?? ""
  const crewIdRaw = watch("crew_id") ?? ""
  const serviceIdRaw = watch("service_id") ?? ""
  const [assignmentMode, setAssignmentMode] = useState<"responsible" | "crew">(
    initial?.crew_id ? "crew" : "responsible",
  )
  const activeAssigneeUserId = assignmentMode === "responsible" ? assignedUserIdRaw : ""
  const status = watch("status") ?? "pending"
  const watchedFinalCost = watch("final_cost")
  const watchedCostEstimate = watch("cost_estimate")
  const watchedStartTime = watch("start_time") ?? "09:00"
  const watchedEndTime = watch("end_time") ?? "10:00"

  const serviceById = useMemo(() => {
    const map = new Map<string, Service>()
    for (const s of safeServices) map.set(s.id, s)
    return map
  }, [safeServices])
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(
    serviceIdRaw ? [serviceIdRaw] : [],
  )
  const selectedServices = useMemo(
    () => selectedServiceIds.map((id) => serviceById.get(id)).filter(Boolean) as Service[],
    [selectedServiceIds, serviceById],
  )
  const selectedService = selectedServices[0] ?? null

  const scheduledDateWatch = watch("scheduled_date")
  const [dayAppointments, setDayAppointments] = useState<AppointmentJob[]>([])
  const [manualTimeMode, setManualTimeMode] = useState(false)
  const [shiftsByUserId, setShiftsByUserId] = useState<Record<string, { status: "active" | "off"; start_time: string | null; end_time: string | null }>>({})

  const slotDurationMinutesForPicker = useMemo(() => {
    if (selectedServices.length === 0) return 60
    const t = selectedServices.reduce((sum, svc) => sum + Number(svc.duration_minutes ?? 0), 0)
    return t > 0 ? t : 60
  }, [selectedServices])

  const availableStartSlots = useMemo(() => {
    const selectedShift = activeAssigneeUserId ? shiftsByUserId[activeAssigneeUserId] : null
    const windowStart = selectedShift?.status === "active" && selectedShift.start_time ? timeToMinutes(selectedShift.start_time.slice(0, 5)) : BUSINESS_DAY_START_MIN
    const windowEnd = selectedShift?.status === "active" && selectedShift.end_time ? timeToMinutes(selectedShift.end_time.slice(0, 5)) : BUSINESS_DAY_END_MIN
    return generateAvailableStartTimes(
      slotDurationMinutesForPicker,
      dayAppointments,
      activeAssigneeUserId || undefined,
      windowStart,
      windowEnd,
      initial?.id,
    )
  }, [slotDurationMinutesForPicker, dayAppointments, activeAssigneeUserId, initial?.id, shiftsByUserId])

  useEffect(() => {
    if (!businessId || !scheduledDateWatch || safeTeam.length === 0) {
      setShiftsByUserId({})
      return
    }
    let cancelled = false
    import("@/services/api")
      .then(({ fetchShiftsForRange }) => fetchShiftsForRange(businessId, scheduledDateWatch, scheduledDateWatch))
      .then((rows) => {
        if (cancelled) return
        const map: Record<string, { status: "active" | "off"; start_time: string | null; end_time: string | null }> = {}
        rows.forEach((r) => {
          map[r.user_id] = {
            status: r.status as "active" | "off",
            start_time: r.start_time,
            end_time: r.end_time,
          }
        })
        setShiftsByUserId(map)
      })
      .catch(() => {
        if (!cancelled) setShiftsByUserId({})
      })
    return () => {
      cancelled = true
    }
  }, [businessId, scheduledDateWatch, safeTeam.length])

  useEffect(() => {
    if (assignmentMode !== "responsible" || !assignedUserIdRaw) return
    const selectedShift = shiftsByUserId[assignedUserIdRaw]
    if (selectedShift?.status === "off") {
      setValue("assigned_user_id", "")
      toast({
        title: tr("Member off shift", "Μέλος εκτός βάρδιας", "Teammitglied nicht im Dienst"),
        description: tr(
          "The selected team member is OFF for this day.",
          "Το επιλεγμένο μέλος είναι OFF για τη συγκεκριμένη ημέρα.",
          "Das ausgewählte Teammitglied ist an diesem Tag nicht im Dienst.",
        ),
        variant: "destructive",
      })
    }
  }, [assignedUserIdRaw, assignmentMode, shiftsByUserId, setValue, toast, language])

  useEffect(() => {
    if (!businessId || !scheduledDateWatch) {
      setDayAppointments([])
      return
    }
    let cancelled = false
    import("@/services/api")
      .then(({ fetchAppointments }) =>
        fetchAppointments(businessId, {
          from: scheduledDateWatch,
          to: scheduledDateWatch,
        }),
      )
      .then((apps) => {
        if (!cancelled) setDayAppointments(apps as AppointmentJob[])
      })
      .catch(() => {
        if (!cancelled) setDayAppointments([])
      })
    return () => {
      cancelled = true
    }
  }, [businessId, scheduledDateWatch])

  useEffect(() => {
    if (manualTimeMode) return
    if (availableStartSlots.length === 0) return
    const st = toTimeInputValue(watchedStartTime)
    if (availableStartSlots.includes(st)) return
    const first = availableStartSlots[0]
    setValue("start_time", first, { shouldDirty: true })
    setValue("end_time", addMinutesToTime(first, slotDurationMinutesForPicker), { shouldDirty: true })
  }, [
    availableStartSlots,
    manualTimeMode,
    slotDurationMinutesForPicker,
    setValue,
    watchedStartTime,
  ])

  const lastAutoRef = useRef<{ serviceId: string | null; endTime: string | null }>({ serviceId: null, endTime: null })
  const editBaselineRef = useRef<{
    scheduled_date: string
    start_time: string
    end_time: string
    status: AppointmentJobStatus
    recurrence_rule: string | null
  } | null>(null)

  useEffect(() => {
    if (!initial?.id) {
      editBaselineRef.current = null
      return
    }
    editBaselineRef.current = {
      scheduled_date: toDateInputValue(initial.scheduled_date),
      start_time: toTimeInputValue(initial.start_time),
      end_time: toTimeInputValue(initial.end_time),
      status: (initial.status as AppointmentJobStatus) ?? "pending",
      recurrence_rule: initial.recurrence_rule ?? null,
    }
  }, [initial?.id, initial?.scheduled_date, initial?.start_time, initial?.end_time, initial?.status, initial?.recurrence_rule])
  const initialDurationMinutes = Math.max(0, timeToMinutes(toTimeInputValue(defaultValues.end_time)) - timeToMinutes(toTimeInputValue(defaultValues.start_time)))
  const [completionDurationInput, setCompletionDurationInput] = useState(() =>
    initialDurationMinutes > 0 ? String(initialDurationMinutes) : selectedService?.duration_minutes != null ? String(selectedService.duration_minutes) : "",
  )
  const [extraChargesInput, setExtraChargesInput] = useState("")
  const [needsServiceReminder, setNeedsServiceReminder] = useState(false)
  const [reminderPresetMonths, setReminderPresetMonths] = useState<"3" | "6" | "12" | "custom">("6")
  const [reminderCustomDate, setReminderCustomDate] = useState("")
  const [reminderNotes, setReminderNotes] = useState("")

  useEffect(() => {
    if (!initial?.id) return
    import("@/services/api")
      .then(({ fetchAppointmentServiceIds }) => fetchAppointmentServiceIds(initial.id!))
      .then((ids) => {
        if (ids.length > 0) {
          setSelectedServiceIds(ids)
          setValue("service_id", ids[0], { shouldDirty: false })
        }
      })
      .catch((e) => console.warn("Failed to load appointment services:", e))
  }, [initial?.id, setValue])

  // Recalculate cost + duration when services change.
  useEffect(() => {
    if (selectedServices.length === 0) {
      setValue("service_id", "", { shouldDirty: true })
      lastAutoRef.current = { serviceId: null, endTime: null }
      return
    }
    const primaryServiceId = selectedServices[0]?.id ?? ""
    setValue("service_id", primaryServiceId, { shouldDirty: true })

    const estimatedCost = selectedServices.reduce((sum, svc) => {
      if (svc.billing_type === "hourly" && svc.hourly_rate != null && svc.duration_minutes != null) {
        return sum + (Number(svc.hourly_rate) * Number(svc.duration_minutes)) / 60
      }
      return sum + Number(svc.price ?? 0)
    }, 0)
    setValue("cost_estimate", Number(estimatedCost.toFixed(2)) as any, { shouldDirty: true })

    const totalDurationMinutes = selectedServices.reduce((sum, svc) => sum + Number(svc.duration_minutes ?? 0), 0)
    if (totalDurationMinutes > 0) {
      const nextEnd = addMinutesToTime(toTimeInputValue(watchedStartTime), totalDurationMinutes)
      const prevAuto = lastAutoRef.current.endTime
      const currentEnd = toTimeInputValue(watchedEndTime)
      const shouldUpdateEnd = !prevAuto || currentEnd === prevAuto || currentEnd === "10:00"
      if (shouldUpdateEnd) {
        setValue("end_time", nextEnd, { shouldDirty: true })
        lastAutoRef.current = { serviceId: primaryServiceId, endTime: nextEnd }
      }
    }
  }, [selectedServices, setValue, watchedStartTime, watchedEndTime])

  useEffect(() => {
    if (selectedServices.length === 0) return
    if (completionDurationInput.trim()) return
    const totalDuration = selectedServices.reduce((sum, svc) => sum + Number(svc.duration_minutes ?? 0), 0)
    if (totalDuration > 0) setCompletionDurationInput(String(totalDuration))
  }, [selectedServices, completionDurationInput])

  const completionDurationMinutes = parseNonNegativeNumber(completionDurationInput)
  const extraCharges = parseNonNegativeNumber(extraChargesInput)

  const completionBaseAmount = useMemo(() => {
    if (selectedServices.length > 0) {
      const servicePriceTotal = selectedServices.reduce((sum, svc) => {
        if (svc.billing_type === "hourly" && svc.hourly_rate != null && svc.duration_minutes != null) {
          return sum + (Number(svc.hourly_rate) * Number(svc.duration_minutes)) / 60
        }
        return sum + Number(svc.price ?? 0)
      }, 0)
      return Number(servicePriceTotal.toFixed(2))
    }
    if (watchedCostEstimate != null && watchedCostEstimate !== undefined && String(watchedCostEstimate) !== "") {
      return Number(watchedCostEstimate || 0)
    }
    return 0
  }, [selectedServices, watchedCostEstimate, completionDurationMinutes])

  const completionTotalAmount = Number((completionBaseAmount + extraCharges).toFixed(2))

  useEffect(() => {
    if (status !== "completed") return
    setValue("final_cost", completionTotalAmount as any, { shouldDirty: true })
  }, [status, completionTotalAmount, setValue])

  // Payment state (for existing appointments)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [paidAmountInput, setPaidAmountInput] = useState("")
  const [paymentMethodInput, setPaymentMethodInput] = useState("")
  const [paymentNotesInput, setPaymentNotesInput] = useState("")

  useEffect(() => {
    if (!initial?.id) return
    setPaymentLoading(true)
    import("@/services/api")
      .then(({ fetchPaymentForAppointment }) => fetchPaymentForAppointment(initial.id!))
      .then((p) => {
        if (p) {
          setPayment(p)
          setPaidAmountInput(p.paid_amount != null ? String(p.paid_amount) : "")
          setPaymentMethodInput(p.payment_method ?? "")
          setPaymentNotesInput(p.notes ?? "")
        }
      })
      .finally(() => setPaymentLoading(false))
  }, [initial?.id])

  const totalAmountRaw =
    watchedFinalCost != null && watchedFinalCost !== undefined
      ? Number(watchedFinalCost || 0)
      : watchedCostEstimate != null && watchedCostEstimate !== undefined
        ? Number(watchedCostEstimate || 0)
        : payment?.amount ?? 0

  const totalAmount = Number.isFinite(totalAmountRaw) ? Math.max(0, totalAmountRaw) : 0
  const paidAmount = Number.isFinite(Number(paidAmountInput)) ? Math.max(0, Number(paidAmountInput || 0)) : 0

  let derivedAmount = totalAmount
  if (derivedAmount <= 0 && paidAmount > 0) {
    derivedAmount = paidAmount
  }

  let paymentStatus: PaymentStatus = "unpaid"
  if (paidAmount <= 0) {
    paymentStatus = "unpaid"
  } else if (paidAmount < derivedAmount) {
    paymentStatus = "partial"
  } else {
    paymentStatus = "paid"
  }

  const remainingBalance = Math.max(0, derivedAmount - paidAmount)

  // Radix Select does not allow empty-string values; map internal empty/undefined to sentinel values.
  const customerSelectValue = customerIdRaw || "none"
  const assignedUserSelectValue = assignedUserIdRaw || "unassigned"
  const crewSelectValue = crewIdRaw || "unassigned"
  const serviceSelectValue = serviceIdRaw || "none"
  const availableTeam = safeTeam.filter((u) => shiftsByUserId[u.id]?.status !== "off")

  async function onFormSubmit(data: FormValues) {
    try {
      if (!businessId) {
        throw new Error(
          tr(
            "Missing business ID. Reload the page and try again.",
            "Λείπει το αναγνωριστικό επιχείρησης. Κάντε επαναφόρτωση και δοκιμάστε ξανά.",
            "Fehlende Unternehmens-ID. Seite neu laden und erneut versuchen.",
          ),
        )
      }

      const { fetchAppointments, fetchStaffProfileForUser, fetchBusiness, countAppointmentsForBusiness, notifyInAppQuiet } =
        await import("@/services/api")

      // Έλεγχος ορίων πλάνου για συνολικά ραντεβού (max_appointments).
      const biz = await fetchBusiness(businessId)
      if (biz?.max_appointments != null) {
        const totalAppointments = await countAppointmentsForBusiness(businessId)
        if (!initial?.id && totalAppointments >= biz.max_appointments) {
          toast({
            title: tr("Appointment plan limit", "Όριο ραντεβού πλάνου", "Terminlimit des Plans"),
            description: tr(
              "You reached the maximum number of appointments for your current business plan.",
              "Έχεις φτάσει το μέγιστο πλήθος ραντεβού για το τρέχον πλάνο επιχείρησης.",
              "Sie haben die maximale Anzahl an Terminen für Ihren aktuellen Plan erreicht.",
            ),
            variant: "destructive",
          })
          return
        }
      }

      // Έλεγχος για επικαλυπτόμενα ραντεβού στην ίδια ημέρα (και, αν έχει οριστεί, για τον ίδιο υπεύθυνο).
      const sameDayAppointments = await fetchAppointments(businessId, {
        from: data.scheduled_date,
        to: data.scheduled_date,
      })

      const newStart = timeToMinutes(data.start_time)
      const newEnd = timeToMinutes(data.end_time)

      const hasOverlap = sameDayAppointments.some((a) => {
        if (initial?.id && a.id === initial.id) return false
        // Αν έχει οριστεί υπεύθυνος, ελέγχουμε μόνο για τον ίδιο υπεύθυνο.
        if (activeAssigneeUserId && a.assigned_user_id && a.assigned_user_id !== activeAssigneeUserId) {
          return false
        }
        const existingStart = timeToMinutes(a.start_time)
        const existingEnd = timeToMinutes(a.end_time)
        return newStart < existingEnd && newEnd > existingStart
      })

      if (hasOverlap) {
        void notifyInAppQuiet(
          businessId,
          tr(
            `Double-booking prevented: ${(data.start_time ?? "").slice(0, 5)}–${(data.end_time ?? "").slice(0, 5)} (${formatDate(data.scheduled_date)}) overlaps another appointment.`,
            `Αποφεύχθηκε διπλοκράτηση: η ώρα ${(data.start_time ?? "").slice(0, 5)}–${(data.end_time ?? "").slice(0, 5)} (${formatDate(data.scheduled_date)}) συγκρούεται με άλλο ραντεβού.`,
            `Doppelbuchung verhindert: ${(data.start_time ?? "").slice(0, 5)}–${(data.end_time ?? "").slice(0, 5)} (${formatDate(data.scheduled_date)}) kollidiert mit einem anderen Termin.`,
          ),
          { notificationType: "appointment_overlap_blocked", metadata: { source: "panel" } },
        )
        toast({
          title: tr("Time unavailable", "Μη διαθέσιμη ώρα", "Zeit nicht verfügbar"),
          description: tr(
            "Another appointment already uses this time slot. Choose a different time or assignee.",
            "Υπάρχει ήδη ραντεβού σε αυτό το διάστημα. Διάλεξε άλλη ώρα ή υπεύθυνο.",
            "Dieser Zeitraum ist bereits belegt. Wählen Sie eine andere Zeit oder Person.",
          ),
          variant: "destructive",
        })
        return
      }

      // Έλεγχος ωραρίου εργασίας υπεύθυνου (αν έχει οριστεί).
      if (activeAssigneeUserId) {
        const shift = shiftsByUserId[activeAssigneeUserId]
        if (shift?.status === "off") {
          toast({
            title: tr("Member off shift", "Μέλος εκτός βάρδιας", "Teammitglied nicht im Dienst"),
            description: tr(
              "The selected team member is OFF for this day.",
              "Το μέλος που επέλεξες είναι OFF για αυτή την ημέρα.",
              "Das ausgewählte Teammitglied ist an diesem Tag nicht im Dienst.",
            ),
            variant: "destructive",
          })
          return
        }
        if (shift?.status === "active" && shift.start_time && shift.end_time) {
          const shiftStart = timeToMinutes(shift.start_time.slice(0, 5))
          const shiftEnd = timeToMinutes(shift.end_time.slice(0, 5))
          if (newStart < shiftStart || newEnd > shiftEnd) {
            toast({
              title: tr("Outside shift", "Εκτός βάρδιας", "Außerhalb der Schicht"),
              description: tr(
                `The appointment is outside the shift (${shift.start_time.slice(0, 5)}–${shift.end_time.slice(0, 5)}).`,
                `Το ραντεβού είναι εκτός βάρδιας (${shift.start_time.slice(0, 5)}–${shift.end_time.slice(0, 5)}).`,
                `Der Termin liegt außerhalb der Schicht (${shift.start_time.slice(0, 5)}–${shift.end_time.slice(0, 5)}).`,
              ),
              variant: "destructive",
            })
            return
          }
        }
        const profile = await fetchStaffProfileForUser(activeAssigneeUserId)
        const availability = profile?.availability as any | null
        const schedule = availability?.schedule as
          | {
              [day: string]: { enabled: boolean; from: string; to: string }
            }
          | undefined
        if (schedule) {
          const weekday = new Date(`${data.scheduled_date}T00:00:00`).getDay() // 0 Κυρ, 1 Δευ...
          const keyMap: Record<number, string> = {
            0: "sun",
            1: "mon",
            2: "tue",
            3: "wed",
            4: "thu",
            5: "fri",
            6: "sat",
          }
          const key = keyMap[weekday]
          const def = schedule[key]
          if (def?.enabled && def.from && def.to) {
            const workStart = timeToMinutes(def.from)
            const workEnd = timeToMinutes(def.to)
            const outside =
              newStart < workStart ||
              newEnd > workEnd ||
              newStart >= workEnd ||
              newEnd <= workStart
            if (outside) {
              toast({
                title: tr("Outside working hours", "Εκτός ωραρίου εργασίας", "Außerhalb der Arbeitszeiten"),
                description: tr(
                  `The appointment is outside the assignee's declared hours (${def.from}–${def.to}). Adjust the time or their schedule.`,
                  `Το ραντεβού είναι εκτός δηλωμένου ωραρίου για τον υπεύθυνο (${def.from}–${def.to}). Προσαρμόστε την ώρα ή το ωράριο.`,
                  `Der Termin liegt außerhalb der angegebenen Zeiten (${def.from}–${def.to}). Passen Sie die Zeit oder den Plan an.`,
                ),
                variant: "destructive",
              })
              return
            }
          }
        }
      }

      const payload = {
        business_id: businessId,
        title: data.title,
        customer_id: data.customer_id,
        assigned_user_id:
          assignmentMode === "responsible" && data.assigned_user_id && data.assigned_user_id.length > 0
            ? data.assigned_user_id
            : null,
        crew_id:
          assignmentMode === "crew" && data.crew_id && data.crew_id.length > 0
            ? data.crew_id
            : null,
        service_id: selectedServiceIds.length > 0 ? selectedServiceIds[0] : null,
        status: data.status as AppointmentJobStatus,
        scheduled_date: data.scheduled_date,
        start_time: data.start_time,
        end_time: data.end_time,
        description: data.description || null,
        cost_estimate: data.cost_estimate ?? null,
        final_cost: data.final_cost ?? null,
        creation_notes: data.creation_notes || null,
        completion_notes: data.completion_notes || null,
        recurrence_rule: data.recurrence_rule || null,
      }
      const { createAppointment, updateAppointment, replaceAppointmentServiceIds, createServiceReminder } = await import("@/services/api")
      let savedAppointmentId: string
      if (initial?.id) {
        await updateAppointment(initial.id, payload)
        savedAppointmentId = initial.id
        await replaceAppointmentServiceIds(initial.id, businessId, selectedServiceIds)
        const b = editBaselineRef.current
        if (b && businessId) {
          const customer = customerOptions.find((c) => c.id === data.customer_id)
          const fallbackCustomer = tr("Customer", "Πελάτης", "Kunde")
          const customerLabel = customer
            ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() || fallbackCustomer
            : fallbackCustomer
          const dateLabel = formatDate(data.scheduled_date)
          const timeLabel = (data.start_time ?? "").slice(0, 5)
          const svcLabels = selectedServiceIds
            .map((sid) => safeServices.find((s) => s.id === sid)?.name)
            .filter(Boolean) as string[]
          const svcPart = svcLabels.length ? ` · ${svcLabels.join(", ")}` : ""
          const dateTimeChanged =
            b.scheduled_date !== data.scheduled_date ||
            b.start_time !== data.start_time ||
            b.end_time !== data.end_time
          if (dateTimeChanged) {
            await notifyInAppQuiet(
              businessId,
              tr(
                `Date/time changed: ${customerLabel} — ${dateLabel} ${timeLabel}${svcPart} · Panel`,
                `Αλλαγή ώρας/ημερομηνίας: ${customerLabel} — ${dateLabel} ${timeLabel}${svcPart} · Πίνακας`,
                `Datum/Zeit geändert: ${customerLabel} — ${dateLabel} ${timeLabel}${svcPart} · Panel`,
              ),
              {
                notificationType: "appointment_rescheduled",
                relatedAppointmentId: initial.id,
                metadata: { source: "panel" },
              },
            )
          }
          if (b.status !== data.status) {
            if (data.status === "cancelled") {
              await notifyInAppQuiet(
                businessId,
                tr(
                  `Appointment cancelled: ${customerLabel} — ${dateLabel} ${timeLabel}${svcPart}`,
                  `Ακύρωση ραντεβού: ${customerLabel} — ${dateLabel} ${timeLabel}${svcPart}`,
                  `Termin storniert: ${customerLabel} — ${dateLabel} ${timeLabel}${svcPart}`,
                ),
                { notificationType: "appointment_cancelled", relatedAppointmentId: initial.id },
              )
            } else if (data.status === "no_show") {
              await notifyInAppQuiet(
                businessId,
                tr(
                  `No-show: ${customerLabel} — ${dateLabel} ${timeLabel}${svcPart}`,
                  `No-show (δεν εμφανίστηκε): ${customerLabel} — ${dateLabel} ${timeLabel}${svcPart}`,
                  `Nicht erschienen: ${customerLabel} — ${dateLabel} ${timeLabel}${svcPart}`,
                ),
                { notificationType: "appointment_no_show", relatedAppointmentId: initial.id },
              )
            }
          }
          const newRec = (data.recurrence_rule || "").trim()
          const oldRec = (b.recurrence_rule ?? "").trim()
          if (newRec && newRec !== oldRec) {
            await notifyInAppQuiet(
              businessId,
              tr(
                `Recurring appointment (rule): ${customerLabel} — «${newRec}»`,
                `Επαναλαμβανόμενο ραντεβού (κανόνας): ${customerLabel} — «${newRec}»`,
                `Wiederkehrender Termin (Regel): ${customerLabel} — «${newRec}»`,
              ),
              { notificationType: "appointment_recurrence", relatedAppointmentId: initial.id },
            )
          }
        }
      } else {
        const created = await createAppointment(payload)
        savedAppointmentId = created.id
        await replaceAppointmentServiceIds(created.id, businessId, selectedServiceIds)
        try {
          const customer = customerOptions.find((c) => c.id === data.customer_id)
          const fallbackCustomer = tr("Customer", "Πελάτης", "Kunde")
          const customerLabel = customer
            ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() || fallbackCustomer
            : fallbackCustomer
          const dateLabel = formatDate(data.scheduled_date)
          const timeLabel = (data.start_time ?? "").slice(0, 5)
          const svcLabels = selectedServiceIds
            .map((sid) => safeServices.find((s) => s.id === sid)?.name)
            .filter(Boolean) as string[]
          const svcPart = svcLabels.length ? ` · ${svcLabels.join(", ")}` : ""
          const msg = tr(
            `New appointment (panel): ${customerLabel} — ${dateLabel} ${timeLabel}${svcPart}`,
            `Νέο ραντεβού (πίνακας): ${customerLabel} — ${dateLabel} ${timeLabel}${svcPart}`,
            `Neuer Termin (Panel): ${customerLabel} — ${dateLabel} ${timeLabel}${svcPart}`,
          )
          await notifyInAppQuiet(businessId, msg, {
            notificationType: "appointment_created",
            relatedAppointmentId: created.id,
            metadata: { source: "panel" },
          })
          const rec = (data.recurrence_rule || "").trim()
          if (rec) {
            await notifyInAppQuiet(
              businessId,
              tr(
                `Recurrence set for upcoming periods: ${customerLabel} — «${rec}»`,
                `Ορίστηκε επανάληψη για τις επόμενες περιόδους: ${customerLabel} — «${rec}»`,
                `Wiederholung für künftige Zeiträume: ${customerLabel} — «${rec}»`,
              ),
              { notificationType: "appointment_recurrence", relatedAppointmentId: created.id },
            )
          }
        } catch {
          // Non-blocking
        }
      }

      if (data.status === "completed" && needsServiceReminder) {
        const dueDate =
          reminderPresetMonths === "custom"
            ? reminderCustomDate
            : addMonthsToDate(data.scheduled_date || new Date().toISOString().slice(0, 10), Number(reminderPresetMonths))

        if (!dueDate) {
          toast({
            title: tr("Maintenance reminder", "Υπενθύμιση συντήρησης", "Wartungserinnerung"),
            description: tr(
              "Pick a date for the reminder.",
              "Επίλεξε ημερομηνία για την υπενθύμιση.",
              "Wählen Sie ein Datum für die Erinnerung.",
            ),
            variant: "destructive",
          })
          return
        }

        await createServiceReminder({
          business_id: businessId,
          customer_id: data.customer_id,
          appointment_job_id: savedAppointmentId,
          title: tr("Maintenance reminder", "Υπενθύμιση συντήρησης", "Wartungserinnerung"),
          notes: reminderNotes.trim() || null,
          due_date: dueDate,
          status: "pending",
        })
      }
      onSaved()
    } catch (err) {
      console.error("Appointment save error:", err)
      const message =
        err instanceof Error ? err.message : tr("Failed to save", "Αποτυχία αποθήκευσης", "Speichern fehlgeschlagen")
      toast({ title: tr("Error", "Σφάλμα", "Fehler"), description: message, variant: "destructive" })
    }
  }

  async function handleSavePayment() {
    try {
      if (!initial?.id) {
        toast({
          title: tr("Error", "Σφάλμα", "Fehler"),
          description: tr(
            "Payment can only be saved for an existing appointment.",
            "Η πληρωμή μπορεί να αποθηκευτεί μόνο για υπάρχον ραντεβού.",
            "Zahlungen können nur für einen bestehenden Termin gespeichert werden.",
          ),
          variant: "destructive",
        })
        return
      }
      if (!businessId) {
        toast({
          title: tr("Error", "Σφάλμα", "Fehler"),
          description: tr("Missing business ID.", "Λείπει το αναγνωριστικό επιχείρησης.", "Fehlende Unternehmens-ID."),
          variant: "destructive",
        })
        return
      }
      if (derivedAmount <= 0 && paidAmount <= 0) {
        toast({
          title: tr("Error", "Σφάλμα", "Fehler"),
          description: tr(
            "Enter an amount or paid amount before saving.",
            "Ορίστε ποσό ή πληρωμένο ποσό πριν την αποθήκευση.",
            "Geben Sie vor dem Speichern einen Betrag oder gezahlten Betrag ein.",
          ),
          variant: "destructive",
        })
        return
      }

      setPaymentSaving(true)
      const { upsertPaymentForAppointment } = await import("@/services/api")
      const payload = {
        id: payment?.id,
        business_id: businessId,
        appointment_job_id: initial.id!,
        amount: derivedAmount,
        paid_amount: paidAmount,
        remaining_balance: remainingBalance,
        payment_status: paymentStatus,
        payment_method: paymentMethodInput || null,
        notes: paymentNotesInput || null,
        deposit: null,
        previousPayment: payment ?? null,
      } as const

      console.debug("Saving appointment payment with payload:", payload)
      const updated = await upsertPaymentForAppointment(payload)
      setPayment(updated)
      toast({
        title: tr("Payment saved", "Πληρωμή αποθηκεύτηκε", "Zahlung gespeichert"),
        description: tr(
          "Payment updated successfully.",
          "Η πληρωμή ενημερώθηκε επιτυχώς.",
          "Zahlung wurde erfolgreich aktualisiert.",
        ),
      })
    } catch (err) {
      console.error("Save payment error:", err)
      const message =
        err instanceof Error
          ? err.message
          : tr("Failed to save payment", "Αποτυχία αποθήκευσης πληρωμής", "Zahlung konnte nicht gespeichert werden")
      toast({ title: tr("Error", "Σφάλμα", "Fehler"), description: message, variant: "destructive" })
    } finally {
      setPaymentSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-5">
      {initError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <div>
            <p className="font-medium">{tr("Form load error", "Σφάλμα φόρτωσης φόρμας", "Fehler beim Laden des Formulars")}</p>
            <p className="text-xs text-destructive/80">
              {initError}{" "}
              {tr(
                "If this continues, check the appointment data or create a new one.",
                "Αν το πρόβλημα συνεχιστεί, ελέγξτε τα δεδομένα του ραντεβού ή δημιουργήστε νέο.",
                "Wenn das weiterhin auftritt, prüfen Sie die Termindaten oder legen Sie einen neuen an.",
              )}
            </p>
          </div>
        </div>
      )}
      <Card className="border-border/60 bg-card/60">
        <CardHeader className="space-y-1.5">
          <CardTitle className="flex items-center justify-between gap-2 text-sm">
            <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
              {initial?.id
                ? tr("Edit appointment", "Επεξεργασία ραντεβού", "Termin bearbeiten")
                : tr("New appointment", "Νέο ραντεβού", "Neuer Termin")}
            </span>
            <span className="inline-flex items-center rounded-full border border-border/60 bg-background/60 px-2.5 py-0.5 text-[11px] text-muted-foreground">
              {formatDate(defaultValues.scheduled_date)} • {defaultValues.start_time}–{defaultValues.end_time}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>{tr("Title", "Τίτλος", "Titel")}</Label>
              <Input {...register("title")} placeholder={tr("Appointment title", "Τίτλος ραντεβού", "Termintitel")} />
              {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{tr("Customer", "Πελάτης", "Kunde")}</Label>
                <Button
                  type="button"
                  variant="link"
                  className="px-0 text-[11px]"
                  onClick={() => setCreateCustomerOpen(true)}
                >
                  {tr("New customer", "Νέος πελάτης", "Neuer Kunde")}
                </Button>
              </div>
              <Select
                value={customerSelectValue}
                onValueChange={(v) => {
                  if (v === "none") {
                    setValue("customer_id", "")
                  } else {
                    setValue("customer_id", v)
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tr("Select customer", "Επιλέξτε πελάτη", "Kunde wählen")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {tr("— Select customer —", "— Επιλέξτε πελάτη —", "— Kunde wählen —")}
                  </SelectItem>
                  {customerOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.customer_id && <p className="text-sm text-destructive">{errors.customer_id.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>{tr("Assignment", "Ανάθεση", "Zuweisung")}</Label>
              <div className="space-y-2 rounded-lg border border-border/60 bg-card/40 p-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={assignmentMode === "responsible" ? "default" : "outline"}
                    onClick={() => {
                      setAssignmentMode("responsible")
                      setValue("crew_id", "")
                    }}
                  >
                    {tr("Assignee", "Υπεύθυνος", "Zuständig")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={assignmentMode === "crew" ? "default" : "outline"}
                    onClick={() => {
                      setAssignmentMode("crew")
                      setValue("assigned_user_id", "")
                    }}
                  >
                    {tr("Crew", "Συνεργείο", "Team")}
                  </Button>
                </div>
                {assignmentMode === "responsible" ? (
                  <Select
                    value={assignedUserSelectValue}
                    onValueChange={(v) => {
                      if (v === "unassigned") {
                        setValue("assigned_user_id", "")
                      } else {
                        setValue("assigned_user_id", v)
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={tr("Select assignee", "Επιλέξτε υπεύθυνο", "Zuständige Person wählen")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">—</SelectItem>
                      {availableTeam.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select
                    value={crewSelectValue}
                    onValueChange={(v) => {
                      if (v === "unassigned") {
                        setValue("crew_id", "")
                      } else {
                        setValue("crew_id", v)
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={tr("Select crew", "Επιλέξτε συνεργείο", "Team wählen")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">—</SelectItem>
                      {safeCrews.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <input type="hidden" {...register("assigned_user_id")} />
                <input type="hidden" {...register("crew_id")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{tr("Services", "Υπηρεσίες", "Leistungen")}</Label>
              <details className="group rounded-xl border border-border/60 bg-gradient-to-b from-card/80 to-muted/20 open:border-primary/25 open:shadow-md open:shadow-primary/5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-medium outline-none transition hover:bg-muted/30 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-2">
                    {tr("Choose services", "Επιλογή υπηρεσιών", "Leistungen wählen")}
                    {selectedServiceIds.length > 0 ? (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        {selectedServiceIds.length}{" "}
                        {tr("selected", "επιλεγμένες", "ausgewählt")}
                      </span>
                    ) : (
                      <span className="text-[11px] font-normal text-muted-foreground">
                        {tr("(optional)", "(προαιρετικό)", "(optional)")}
                      </span>
                    )}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
                </summary>
                <div className="space-y-2 border-t border-border/50 px-3 pb-3 pt-2">
                  <div className="flex flex-wrap gap-2">
                    {safeServices.map((s) => {
                      const selected = selectedServiceIds.includes(s.id)
                      return (
                        <Button
                          key={s.id}
                          type="button"
                          variant={selected ? "default" : "outline"}
                          size="sm"
                          className="rounded-full"
                          onClick={() => {
                            setSelectedServiceIds((prev) =>
                              prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id],
                            )
                          }}
                        >
                          {s.name}
                        </Button>
                      )
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {tr(
                      "Select one or more services. Cost and duration are calculated automatically.",
                      "Επιλέξτε μία ή περισσότερες υπηρεσίες. Το κόστος και η διάρκεια υπολογίζονται αυτόματα.",
                      "Wählen Sie eine oder mehrere Leistungen. Kosten und Dauer werden automatisch berechnet.",
                    )}
                  </p>
                  <input type="hidden" value={serviceSelectValue} {...register("service_id")} />
                </div>
              </details>
            </div>
            <div className="space-y-2">
              <Label>{tr("Status", "Κατάσταση", "Status")}</Label>
              <Select
                value={status}
                onValueChange={(v) => setValue("status", (v as FormValues["status"]) ?? "pending")}
              >
                <SelectTrigger>
                  <SelectValue>{statusLabels[status as AppointmentJobStatus] ?? status}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {statusLabels[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>{tr("Date", "Ημ/νία", "Datum")}</Label>
              <Input type="date" {...register("scheduled_date")} />
              {errors.scheduled_date && <p className="text-sm text-destructive">{errors.scheduled_date.message}</p>}
            </div>
            <div className="space-y-2 lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-primary" />
                  {tr("Appointment time", "Ώρα ραντεβού", "Terminzeit")}
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-[11px] text-muted-foreground"
                  onClick={() => setManualTimeMode((m) => !m)}
                >
                  {manualTimeMode
                    ? tr("Use available slots", "Χρήση διαθέσιμων κουλάκιων", "Freie Zeiten nutzen")
                    : tr("Manual time", "Χειροκίνητη ώρα", "Manuelle Zeit")}
                </Button>
              </div>
              {manualTimeMode ? (
                <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {tr("Start", "Έναρξη", "Beginn")}
                    </span>
                    <Input type="time" className="w-full sm:w-[8.5rem]" {...register("start_time")} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {tr("End", "Λήξη", "Ende")}
                    </span>
                    <Input type="time" className="w-full sm:w-[8.5rem]" {...register("end_time")} />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-background via-muted/20 to-muted/40 p-3 shadow-inner sm:p-4">
                    <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
                      {tr(
                        `Only free slots are shown (08:00–22:00, 15-minute steps${
                          activeAssigneeUserId ? " · same assignee" : " · all assignees"
                        }).`,
                        `Εμφανίζονται μόνο ελεύθερα κουλάκια (08:00–22:00, βήμα 15 λεπτά${
                          activeAssigneeUserId ? " · ίδιος υπεύθυνος" : " · όλοι οι υπεύθυνοι"
                        }).`,
                        `Es werden nur freie Zeiten angezeigt (08:00–22:00, 15-Minuten-Schritte${
                          activeAssigneeUserId ? " · gleiche Person" : " · alle Personen"
                        }).`,
                      )}
                    </p>
                    <div className="max-h-48 overflow-y-auto pr-1">
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 md:grid-cols-5">
                        {availableStartSlots.map((slot) => {
                          const active = toTimeInputValue(watchedStartTime) === slot
                          return (
                            <Button
                              key={slot}
                              type="button"
                              variant={active ? "default" : "secondary"}
                              className={cn(
                                "h-9 min-w-0 px-1 text-xs font-semibold tabular-nums",
                                active && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                              )}
                              onClick={() => {
                                setValue("start_time", slot, { shouldDirty: true })
                                setValue(
                                  "end_time",
                                  addMinutesToTime(slot, slotDurationMinutesForPicker),
                                  { shouldDirty: true },
                                )
                              }}
                            >
                              {slot}
                            </Button>
                          )
                        })}
                      </div>
                    </div>
                    {availableStartSlots.length === 0 && (
                      <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                        {tr(
                          "No free slots for this date and duration. Change the date, assignee, or use manual time.",
                          "Δεν υπάρχουν ελεύθερα κουλάκια για αυτή την ημερομηνία και διάρκεια. Άλλαξε ημερομηνία, υπεύθυνο ή χρησιμοποίησε χειροκίνητη ώρα.",
                          "Keine freien Zeiten für dieses Datum und diese Dauer. Datum, Person ändern oder manuelle Zeit.",
                        )}
                      </p>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {tr("Ends:", "Λήξη:", "Ende:")}{" "}
                    <span className="font-medium text-foreground tabular-nums">
                      {toTimeInputValue(watchedEndTime)}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      ({slotDurationMinutesForPicker} {tr("min", "λεπ.", "Min.")})
                    </span>
                  </p>
                  <input type="hidden" {...register("start_time")} />
                  <input type="hidden" {...register("end_time")} />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>{tr("Cost estimate (€)", "Εκτίμηση κόστους (€)", "Kostenschätzung (€)")}</Label>
              <Input type="number" step="0.01" {...register("cost_estimate")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="appointment-location-address">
              {tr("Appointment address (optional)", "Διεύθυνση ραντεβού (προαιρετικό)", "Terminadresse (optional)")}
            </Label>
            <Input
              id="appointment-location-address"
              {...register("location_address")}
              placeholder={tr(
                "Street, number, area — visit location for this appointment",
                "Οδός, αριθμός, περιοχή — τόπος επίσκεψης για αυτό το ραντεβού",
                "Straße, Nr., Ort — Besuchsort für diesen Termin",
              )}
              autoComplete="street-address"
            />
            <p className="text-[11px] text-muted-foreground">
              {tr(
                "Separate from the customer address; use when the visit is at a different location.",
                "Ξεχωριστά από τη διεύθυνση πελάτη· χρησιμοποιείται όταν η επίσκεψη γίνεται σε άλλο σημείο.",
                "Getrennt von der Kundenadresse; nutzen, wenn der Besuch woanders stattfindet.",
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{tr("Description", "Περιγραφή", "Beschreibung")}</Label>
              <Input
                {...register("description")}
                placeholder={tr(
                  "Short description of the work...",
                  "Σύντομη περιγραφή εργασίας...",
                  "Kurze Beschreibung der Arbeit...",
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>{tr("Creation notes", "Σημειώσεις δημιουργίας", "Anmerkungen (Anlage)")}</Label>
              <Input
                {...register("creation_notes")}
                placeholder={tr(
                  "Special instructions, preferences, etc.",
                  "Ειδικές οδηγίες, προτιμήσεις κ.λπ.",
                  "Besondere Hinweise, Wünsche usw.",
                )}
              />
            </div>
          </div>
          {status === "completed" && (
            <Card className="border-border/60 bg-background/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{tr("Completion & billing", "Ολοκλήρωση & Χρέωση", "Abschluss & Abrechnung")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{tr("Appointment duration (minutes)", "Διάρκεια ραντεβού (λεπτά)", "Termindauer (Minuten)")}</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={completionDurationInput}
                      onChange={(e) => setCompletionDurationInput(e.target.value)}
                      placeholder={tr("e.g. 90", "π.χ. 90", "z. B. 90")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{tr("Extra charges (€)", "Έξτρα χρεώσεις (€)", "Zusatzkosten (€)")}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={extraChargesInput}
                      onChange={(e) => setExtraChargesInput(e.target.value)}
                      placeholder={tr("e.g. 15.00", "π.χ. 15.00", "z. B. 15,00")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{tr("Total price (€)", "Τελική τιμή συνόλου (€)", "Gesamtpreis (€)")}</Label>
                    <Input value={completionTotalAmount.toFixed(2)} readOnly />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {tr(
                    `Services base: ${completionBaseAmount.toFixed(2)} € + extra charges.`,
                    `Βάση υπηρεσιών: ${completionBaseAmount.toFixed(2)} € + έξτρα χρεώσεις.`,
                    `Leistungsbasis: ${completionBaseAmount.toFixed(2)} € + Zusatzkosten.`,
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{tr("Completion notes", "Σημειώσεις ολοκλήρωσης", "Abschlussnotizen")}</Label>
                  <Input
                    {...register("completion_notes")}
                    placeholder={tr(
                      "What was done at the appointment",
                      "Τι έγινε στο ραντεβού",
                      "Was wurde beim Termin erledigt",
                    )}
                  />
                </div>
                <div className="space-y-3 rounded-lg border border-border/70 bg-card/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        {tr("Needs follow-up service", "Χρειάζεται επόμενο service", "Nachfolgetermin nötig")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tr(
                          "Create a maintenance reminder for future follow-up.",
                          "Δημιούργησε υπενθύμιση συντήρησης για μελλοντική επικοινωνία.",
                          "Wartungserinnerung für späteren Kontakt anlegen.",
                        )}
                      </p>
                    </div>
                    <Switch checked={needsServiceReminder} onCheckedChange={setNeedsServiceReminder} />
                  </div>
                  {needsServiceReminder && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant={reminderPresetMonths === "3" ? "default" : "outline"} onClick={() => setReminderPresetMonths("3")}>
                          {tr("3 months", "3 μήνες", "3 Monate")}
                        </Button>
                        <Button type="button" size="sm" variant={reminderPresetMonths === "6" ? "default" : "outline"} onClick={() => setReminderPresetMonths("6")}>
                          {tr("6 months", "6 μήνες", "6 Monate")}
                        </Button>
                        <Button type="button" size="sm" variant={reminderPresetMonths === "12" ? "default" : "outline"} onClick={() => setReminderPresetMonths("12")}>
                          {tr("12 months", "12 μήνες", "12 Monate")}
                        </Button>
                        <Button type="button" size="sm" variant={reminderPresetMonths === "custom" ? "default" : "outline"} onClick={() => setReminderPresetMonths("custom")}>
                          {tr("Custom", "Προσαρμοσμένη", "Benutzerdefiniert")}
                        </Button>
                      </div>
                      {reminderPresetMonths === "custom" && (
                        <div className="space-y-1">
                          <Label>{tr("Reminder date", "Ημερομηνία υπενθύμισης", "Erinnerungsdatum")}</Label>
                          <Input type="date" value={reminderCustomDate} onChange={(e) => setReminderCustomDate(e.target.value)} />
                        </div>
                      )}
                      <div className="space-y-1">
                        <Label>{tr("Reminder notes (optional)", "Σημειώσεις υπενθύμισης (προαιρετικά)", "Erinnerungsnotizen (optional)")}</Label>
                        <Textarea
                          value={reminderNotes}
                          onChange={(e) => setReminderNotes(e.target.value)}
                          placeholder={tr(
                            "e.g. follow up on filters, maintenance check…",
                            "Υπενθύμισε μου ξανά για φίλτρα, έλεγχο συντήρησης κ.λπ.",
                            "z. B. Filter nachziehen, Wartung prüfen …",
                          )}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {initial?.id && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">{tr("Payment", "Πληρωμή", "Zahlung")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {paymentLoading ? (
              <p className="text-sm text-muted-foreground">
                {tr("Loading payment details...", "Φόρτωση στοιχείων πληρωμής...", "Zahlungsdetails werden geladen...")}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>{tr("Total amount (€)", "Τελικό ποσό (€)", "Gesamtbetrag (€)")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {derivedAmount > 0 ? derivedAmount.toFixed(2) : "0.00"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label>{tr("Payment status", "Κατάσταση πληρωμής", "Zahlungsstatus")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {paymentStatus === "paid"
                        ? tr("Paid", "Πληρωμένο", "Bezahlt")
                        : paymentStatus === "partial"
                          ? tr("Partial", "Μερικό", "Teilweise")
                          : tr("Unpaid", "Απλήρωτο", "Unbezahlt")}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paid-amount">{tr("Amount paid (€)", "Πληρωμένο ποσό (€)", "Gezahlter Betrag (€)")}</Label>
                    <Input
                      id="paid-amount"
                      type="number"
                      step="0.01"
                      value={paidAmountInput}
                      onChange={(e) => setPaidAmountInput(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{tr("Balance (€)", "Υπόλοιπο (€)", "Saldo (€)")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {remainingBalance.toFixed(2)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment-method">{tr("Payment method", "Τρόπος πληρωμής", "Zahlungsart")}</Label>
                    <Input
                      id="payment-method"
                      placeholder={tr("e.g. Cash, Card", "π.χ. Μετρητά, Κάρτα", "z. B. Bar, Karte")}
                      value={paymentMethodInput}
                      onChange={(e) => setPaymentMethodInput(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment-notes">{tr("Payment notes", "Σημειώσεις πληρωμής", "Zahlungsnotizen")}</Label>
                    <Input
                      id="payment-notes"
                      placeholder={tr("Notes", "Σημειώσεις", "Notizen")}
                      value={paymentNotesInput}
                      onChange={(e) => setPaymentNotesInput(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{tr("Payment date", "Ημερομηνία πληρωμής", "Zahlungsdatum")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {payment?.created_at
                        ? formatDate(payment.created_at)
                        : tr("Set on first payment", "Θα οριστεί κατά την πρώτη πληρωμή", "Wird bei erster Zahlung gesetzt")}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="button" variant="outline" onClick={handleSavePayment} disabled={paymentSaving}>
                    {paymentSaving
                      ? tr("Saving...", "Αποθήκευση...", "Speichern...")
                      : tr("Save payment", "Αποθήκευση πληρωμής", "Zahlung speichern")}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
      <Dialog open={createCustomerOpen} onOpenChange={setCreateCustomerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{tr("New customer", "Νέος πελάτης", "Neuer Kunde")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-first-name">{tr("First name *", "Όνομα *", "Vorname *")}</Label>
                <Input
                  id="new-first-name"
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-last-name">{tr("Last name *", "Επώνυμο *", "Nachname *")}</Label>
                <Input
                  id="new-last-name"
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-phone">{tr("Phone", "Τηλέφωνο", "Telefon")}</Label>
                <Input
                  id="new-phone"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-email">Email</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="new-address">{tr("Address (optional)", "Διεύθυνση (προαιρετικό)", "Adresse (optional)")}</Label>
                <Input
                  id="new-address"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder={tr("Street, number…", "Οδός, αριθμός…", "Straße, Nr. …")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-area">{tr("Area", "Περιοχή", "Ort")}</Label>
                <Input
                  id="new-area"
                  value={newArea}
                  onChange={(e) => setNewArea(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-postal-code">{tr("Postal code", "Τ.Κ.", "PLZ")}</Label>
                <Input
                  id="new-postal-code"
                  value={newPostalCode}
                  onChange={(e) => setNewPostalCode(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-company">{tr("Company", "Εταιρεία", "Firma")}</Label>
                <Input
                  id="new-company"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-vat-number">{tr("VAT / Tax ID", "ΑΦΜ", "USt-ID / Steuernummer")}</Label>
                <Input
                  id="new-vat-number"
                  value={newVatNumber}
                  onChange={(e) => setNewVatNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="new-notes">{tr("Notes", "Σημειώσεις", "Notizen")}</Label>
                <Input
                  id="new-notes"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="new-tags">{tr("Tags (comma-separated)", "Tags (χωρισμένα με κόμμα)", "Tags (kommagetrennt)")}</Label>
                <Input
                  id="new-tags"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {tr(
                "* First and last name required. At least one of phone or email. Address is optional.",
                "* Όνομα και επώνυμο υποχρεωτικά. Απαιτείται τουλάχιστον ένα από Τηλέφωνο ή Email. Η διεύθυνση είναι προαιρετική.",
                "* Vor- und Nachname erforderlich. Mindestens Telefon oder E-Mail. Adresse optional.",
              )}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateCustomerOpen(false)}
                disabled={creatingCustomer}
              >
                {tr("Cancel", "Ακύρωση", "Abbrechen")}
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  try {
                    if (!businessId) {
                      toast({
                        title: tr("Error", "Σφάλμα", "Fehler"),
                        description: tr(
                          "Missing business ID. Cannot create customer.",
                          "Λείπει το αναγνωριστικό επιχείρησης. Δεν μπορεί να δημιουργηθεί πελάτης.",
                          "Fehlende Unternehmens-ID. Kunde kann nicht angelegt werden.",
                        ),
                        variant: "destructive",
                      })
                      return
                    }
                    if (!newFirstName.trim() || !newLastName.trim()) {
                      toast({
                        title: tr("Error", "Σφάλμα", "Fehler"),
                        description: tr(
                          "Enter first and last name.",
                          "Συμπληρώστε όνομα και επώνυμο.",
                          "Vor- und Nachname eingeben.",
                        ),
                        variant: "destructive",
                      })
                      return
                    }
                    if (!newPhone.trim() && !newEmail.trim()) {
                      toast({
                        title: tr("Error", "Σφάλμα", "Fehler"),
                        description: tr(
                          "Enter at least a phone number or email.",
                          "Συμπληρώστε τουλάχιστον τηλέφωνο ή email.",
                          "Mindestens Telefonnummer oder E-Mail eingeben.",
                        ),
                        variant: "destructive",
                      })
                      return
                    }

                    const normalizedEmail = newEmail.trim().toLowerCase()
                    const normalizedPhone = newPhone.trim()
                    const duplicate = customerOptions.find((c) => {
                      const samePhone = normalizedPhone && c.phone === normalizedPhone
                      const sameEmail =
                        normalizedEmail && c.email && c.email.toLowerCase() === normalizedEmail
                      return samePhone || sameEmail
                    })
                    if (duplicate) {
                      toast({
                        title: tr("Customer already exists", "Υπάρχει ήδη πελάτης", "Kunde existiert bereits"),
                        description: tr(
                          "A customer with the same phone or email was found. The existing customer was selected.",
                          "Βρέθηκε πελάτης με ίδιο τηλέφωνο ή email. Επιλέχθηκε ο υπάρχων πελάτης.",
                          "Ein Kunde mit derselben Telefonnummer oder E-Mail wurde gefunden. Der bestehende Kunde wurde ausgewählt.",
                        ),
                      })
                      setValue("customer_id", duplicate.id)
                      setCreateCustomerOpen(false)
                      return
                    }

                    setCreatingCustomer(true)
                    const { createCustomer, fetchBusiness } = await import("@/services/api")

                    const biz = await fetchBusiness(businessId)
                    if (biz?.max_customers != null && customerOptions.length >= biz.max_customers) {
                      toast({
                        title: tr("Customer plan limit", "Όριο πελατών πλάνου", "Kundenlimit des Plans"),
                        description: tr(
                          "You reached the maximum customers for your current business plan.",
                          "Έχεις φτάσει το μέγιστο πλήθος πελατών για το τρέχον πλάνο επιχείρησης.",
                          "Sie haben die maximale Kundenanzahl für Ihren aktuellen Plan erreicht.",
                        ),
                        variant: "destructive",
                      })
                      setCreatingCustomer(false)
                      return
                    }
                    const payload = {
                      business_id: businessId,
                      first_name: newFirstName.trim(),
                      last_name: newLastName.trim(),
                      phone: normalizedPhone || null,
                      email: normalizedEmail || null,
                      address: newAddress.trim() || null,
                      area: newArea.trim() || null,
                      postal_code: newPostalCode.trim() || null,
                      company: newCompany.trim() || null,
                      vat_number: newVatNumber.trim() || null,
                      notes: newNotes.trim() || null,
                      tags: newTags
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    } as Partial<Customer> & { business_id: string }

                    const created = (await createCustomer(payload)) as Customer
                    setCustomerOptions((prev) => [created, ...prev])
                    setValue("customer_id", created.id)
                    const { notifyInAppQuiet } = await import("@/services/api")
                    await notifyInAppQuiet(
                      businessId,
                      tr(
                        `New customer from appointment form: ${created.first_name} ${created.last_name}`.trim(),
                        `Νέος πελάτης από φόρμα ραντεβού: ${created.first_name} ${created.last_name}`.trim(),
                        `Neuer Kunde aus Terminformular: ${created.first_name} ${created.last_name}`.trim(),
                      ),
                      {
                        notificationType: "customer_created",
                        relatedCustomerId: created.id,
                        metadata: { source: "appointment_form" },
                      },
                    )
                    toast({
                      title: tr("Customer created", "Πελάτης δημιουργήθηκε", "Kunde angelegt"),
                      description: tr(
                        "The new customer was added and selected for this appointment.",
                        "Ο νέος πελάτης προστέθηκε και επιλέχθηκε στο ραντεβού.",
                        "Der neue Kunde wurde hinzugefügt und für diesen Termin ausgewählt.",
                      ),
                    })
                    setCreateCustomerOpen(false)
                  } catch (err) {
                    console.error("Create inline customer error:", err)
                    const message =
                      err instanceof Error
                        ? err.message
                        : tr("Failed to create customer", "Αποτυχία δημιουργίας πελάτη", "Kunde konnte nicht angelegt werden")
                    toast({ title: tr("Error", "Σφάλμα", "Fehler"), description: message, variant: "destructive" })
                  } finally {
                    setCreatingCustomer(false)
                  }
                }}
                disabled={creatingCustomer}
              >
                {creatingCustomer
                  ? tr("Creating...", "Δημιουργία...", "Wird erstellt...")
                  : tr("Save customer", "Αποθήκευση πελάτη", "Kunde speichern")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {tr("Cancel", "Ακύρωση", "Abbrechen")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? tr("Saving...", "Αποθήκευση...", "Speichern...") : tr("Save", "Αποθήκευση", "Speichern")}
        </Button>
      </div>
    </form>
  )
}
