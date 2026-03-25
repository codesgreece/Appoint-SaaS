import { useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type { AppointmentJob, AppointmentJobStatus, Customer, User, Service, Payment, PaymentStatus } from "@/types"
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
import { cn, formatDate } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
const statusOptions: AppointmentJobStatus[] = [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
  "rescheduled",
]

const STATUS_LABELS: Record<AppointmentJobStatus, string> = {
  pending: "Εκκρεμεί",
  confirmed: "Επιβεβαιωμένο",
  in_progress: "Σε εξέλιξη",
  completed: "Ολοκληρώθηκε",
  cancelled: "Ακυρώθηκε",
  no_show: "Δεν εμφανίστηκε",
  rescheduled: "Επαναπρογραμματισμένο",
}

const schema = z.object({
  title: z.string().min(1, "Απαιτείται"),
  customer_id: z.string().min(1, "Επιλέξτε πελάτη"),
  assigned_user_id: z.string().optional(),
  service_id: z.string().optional(),
  // keep enum values in sync with AppointmentJobStatus
  status: z.enum(
    ["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show", "rescheduled"] as [
      AppointmentJobStatus,
      ...AppointmentJobStatus[],
    ],
  ),
  scheduled_date: z.string().min(1, "Απαιτείται ημερομηνία"),
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

type FormValues = z.infer<typeof schema>

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
  excludeAppointmentId?: string,
): string[] {
  const dur = Math.max(15, durationMin)
  const out: string[] = []
  const lastStart = BUSINESS_DAY_END_MIN - dur
  if (lastStart < BUSINESS_DAY_START_MIN) return out
  for (let m = BUSINESS_DAY_START_MIN; m <= lastStart; m += SLOT_STEP_MIN) {
    const endM = m + dur
    if (endM > BUSINESS_DAY_END_MIN) break
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
  services,
  businessId,
  presetDate,
  onSaved,
  onCancel,
}: AppointmentFormProps) {
  const { toast } = useToast()
  const safeCustomers = Array.isArray(customers) ? customers : []
  const safeTeam = Array.isArray(team) ? team : []
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

  const today = new Date().toISOString().slice(0, 10)
  const defaultDate = presetDate ?? today

  let initError: string | null = null
  let defaultValues: FormValues

  try {
    defaultValues = initial
      ? {
          title: initial.title ?? "",
          customer_id: initial.customer_id ?? "",
          assigned_user_id: initial.assigned_user_id ?? "",
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
    initError = e instanceof Error ? e.message : "Απροσδόκητο σφάλμα φόρτωσης φόρμας."
    defaultValues = {
      title: "",
      customer_id: "",
      assigned_user_id: "",
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

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  const customerIdRaw = watch("customer_id") ?? ""
  const assignedUserIdRaw = watch("assigned_user_id") ?? ""
  const serviceIdRaw = watch("service_id") ?? ""
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

  const slotDurationMinutesForPicker = useMemo(() => {
    if (selectedServices.length === 0) return 60
    const t = selectedServices.reduce((sum, svc) => sum + Number(svc.duration_minutes ?? 0), 0)
    return t > 0 ? t : 60
  }, [selectedServices])

  const availableStartSlots = useMemo(() => {
    return generateAvailableStartTimes(
      slotDurationMinutesForPicker,
      dayAppointments,
      assignedUserIdRaw || undefined,
      initial?.id,
    )
  }, [slotDurationMinutesForPicker, dayAppointments, assignedUserIdRaw, initial?.id])

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
  const serviceSelectValue = serviceIdRaw || "none"

  async function onFormSubmit(data: FormValues) {
    try {
      if (!businessId) {
        throw new Error("Λείπει το αναγνωριστικό επιχείρησης. Κάντε επαναφόρτωση και δοκιμάστε ξανά.")
      }

      const { fetchAppointments, fetchStaffProfileForUser, fetchBusiness, countAppointmentsForBusiness, notifyInAppQuiet } =
        await import("@/services/api")

      // Έλεγχος ορίων πλάνου για συνολικά ραντεβού (max_appointments).
      const biz = await fetchBusiness(businessId)
      if (biz?.max_appointments != null) {
        const totalAppointments = await countAppointmentsForBusiness(businessId)
        if (!initial?.id && totalAppointments >= biz.max_appointments) {
          toast({
            title: "Όριο ραντεβού πλάνου",
            description: "Έχεις φτάσει το μέγιστο πλήθος ραντεβού για το τρέχον πλάνο επιχείρησης.",
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
        if (data.assigned_user_id && a.assigned_user_id && a.assigned_user_id !== data.assigned_user_id) {
          return false
        }
        const existingStart = timeToMinutes(a.start_time)
        const existingEnd = timeToMinutes(a.end_time)
        return newStart < existingEnd && newEnd > existingStart
      })

      if (hasOverlap) {
        void notifyInAppQuiet(
          businessId,
          `Αποφεύχθηκε διπλοκράτηση: η ώρα ${(data.start_time ?? "").slice(0, 5)}–${(data.end_time ?? "").slice(0, 5)} (${formatDate(data.scheduled_date)}) συγκρούεται με άλλο ραντεβού.`,
          { notificationType: "appointment_overlap_blocked", metadata: { source: "panel" } },
        )
        toast({
          title: "Μη διαθέσιμη ώρα",
          description: "Υπάρχει ήδη ραντεβού σε αυτό το διάστημα. Διάλεξε άλλη ώρα ή υπεύθυνο.",
          variant: "destructive",
        })
        return
      }

      // Έλεγχος ωραρίου εργασίας υπεύθυνου (αν έχει οριστεί).
      if (data.assigned_user_id) {
        const profile = await fetchStaffProfileForUser(data.assigned_user_id)
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
                title: "Εκτός ωραρίου εργασίας",
                description: `Το ραντεβού είναι εκτός δηλωμένου ωραρίου για τον υπεύθυνο (${def.from}–${def.to}). Προσαρμόστε την ώρα ή το ωράριο.`,
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
        assigned_user_id: data.assigned_user_id && data.assigned_user_id.length > 0 ? data.assigned_user_id : null,
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
          const customerLabel = customer
            ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() || "Πελάτης"
            : "Πελάτης"
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
              `Αλλαγή ώρας/ημερομηνίας: ${customerLabel} — ${dateLabel} ${timeLabel}${svcPart} · Πίνακας`,
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
                `Ακύρωση ραντεβού: ${customerLabel} — ${dateLabel} ${timeLabel}${svcPart}`,
                { notificationType: "appointment_cancelled", relatedAppointmentId: initial.id },
              )
            } else if (data.status === "no_show") {
              await notifyInAppQuiet(
                businessId,
                `No-show (δεν εμφανίστηκε): ${customerLabel} — ${dateLabel} ${timeLabel}${svcPart}`,
                { notificationType: "appointment_no_show", relatedAppointmentId: initial.id },
              )
            }
          }
          const newRec = (data.recurrence_rule || "").trim()
          const oldRec = (b.recurrence_rule ?? "").trim()
          if (newRec && newRec !== oldRec) {
            await notifyInAppQuiet(
              businessId,
              `Επαναλαμβανόμενο ραντεβού (κανόνας): ${customerLabel} — «${newRec}»`,
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
          const customerLabel = customer
            ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() || "Πελάτης"
            : "Πελάτης"
          const dateLabel = formatDate(data.scheduled_date)
          const timeLabel = (data.start_time ?? "").slice(0, 5)
          const svcLabels = selectedServiceIds
            .map((sid) => safeServices.find((s) => s.id === sid)?.name)
            .filter(Boolean) as string[]
          const svcPart = svcLabels.length ? ` · ${svcLabels.join(", ")}` : ""
          const msg = `Νέο ραντεβού (πίνακας): ${customerLabel} — ${dateLabel} ${timeLabel}${svcPart}`
          await notifyInAppQuiet(businessId, msg, {
            notificationType: "appointment_created",
            relatedAppointmentId: created.id,
            metadata: { source: "panel" },
          })
          const rec = (data.recurrence_rule || "").trim()
          if (rec) {
            await notifyInAppQuiet(
              businessId,
              `Ορίστηκε επανάληψη για τις επόμενες περιόδους: ${customerLabel} — «${rec}»`,
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
            title: "Υπενθύμιση συντήρησης",
            description: "Επίλεξε ημερομηνία για την υπενθύμιση.",
            variant: "destructive",
          })
          return
        }

        await createServiceReminder({
          business_id: businessId,
          customer_id: data.customer_id,
          appointment_job_id: savedAppointmentId,
          title: "Υπενθύμιση συντήρησης",
          notes: reminderNotes.trim() || null,
          due_date: dueDate,
          status: "pending",
        })
      }
      onSaved()
    } catch (err) {
      console.error("Appointment save error:", err)
      const message = err instanceof Error ? err.message : "Αποτυχία αποθήκευσης"
      toast({ title: "Σφάλμα", description: message, variant: "destructive" })
    }
  }

  async function handleSavePayment() {
    try {
      if (!initial?.id) {
        toast({ title: "Σφάλμα", description: "Η πληρωμή μπορεί να αποθηκευτεί μόνο για υπάρχον ραντεβού.", variant: "destructive" })
        return
      }
      if (!businessId) {
        toast({ title: "Σφάλμα", description: "Λείπει το αναγνωριστικό επιχείρησης.", variant: "destructive" })
        return
      }
      if (derivedAmount <= 0 && paidAmount <= 0) {
        toast({ title: "Σφάλμα", description: "Ορίστε ποσό ή πληρωμένο ποσό πριν την αποθήκευση.", variant: "destructive" })
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
      toast({ title: "Πληρωμή αποθηκεύτηκε", description: "Η πληρωμή ενημερώθηκε επιτυχώς." })
    } catch (err) {
      console.error("Save payment error:", err)
      const message = err instanceof Error ? err.message : "Αποτυχία αποθήκευσης πληρωμής"
      toast({ title: "Σφάλμα", description: message, variant: "destructive" })
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
            <p className="font-medium">Σφάλμα φόρτωσης φόρμας</p>
            <p className="text-xs text-destructive/80">
              {initError} Αν το πρόβλημα συνεχιστεί, ελέγξτε τα δεδομένα του ραντεβού ή δημιουργήστε νέο.
            </p>
          </div>
        </div>
      )}
      <Card className="border-border/60 bg-card/60">
        <CardHeader className="space-y-1.5">
          <CardTitle className="flex items-center justify-between gap-2 text-sm">
            <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
              {initial?.id ? "Επεξεργασία ραντεβού" : "Νέο ραντεβού"}
            </span>
            <span className="inline-flex items-center rounded-full border border-border/60 bg-background/60 px-2.5 py-0.5 text-[11px] text-muted-foreground">
              {formatDate(defaultValues.scheduled_date)} • {defaultValues.start_time}–{defaultValues.end_time}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Τίτλος</Label>
              <Input {...register("title")} placeholder="Τίτλος ραντεβού" />
              {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Πελάτης</Label>
                <Button
                  type="button"
                  variant="link"
                  className="px-0 text-[11px]"
                  onClick={() => setCreateCustomerOpen(true)}
                >
                  Νέος πελάτης
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
                <SelectTrigger><SelectValue placeholder="Επιλέξτε πελάτη" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Επιλέξτε πελάτη —</SelectItem>
                  {customerOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.customer_id && <p className="text-sm text-destructive">{errors.customer_id.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Υπεύθυνος</Label>
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
                <SelectTrigger><SelectValue placeholder="Επιλέξτε" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">—</SelectItem>
                  {safeTeam.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Υπηρεσίες</Label>
              <details className="group rounded-xl border border-border/60 bg-gradient-to-b from-card/80 to-muted/20 open:border-primary/25 open:shadow-md open:shadow-primary/5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-medium outline-none transition hover:bg-muted/30 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-2">
                    Επιλογή υπηρεσιών
                    {selectedServiceIds.length > 0 ? (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        {selectedServiceIds.length} επιλεγμένες
                      </span>
                    ) : (
                      <span className="text-[11px] font-normal text-muted-foreground">(προαιρετικό)</span>
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
                    Επιλέξτε μία ή περισσότερες υπηρεσίες. Το κόστος και η διάρκεια υπολογίζονται αυτόματα.
                  </p>
                  <input type="hidden" value={serviceSelectValue} {...register("service_id")} />
                </div>
              </details>
            </div>
            <div className="space-y-2">
              <Label>Κατάσταση</Label>
              <Select
                value={status}
                onValueChange={(v) => setValue("status", (v as FormValues["status"]) ?? "pending")}
              >
                <SelectTrigger>
                  <SelectValue>{STATUS_LABELS[status as AppointmentJobStatus] ?? status}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Ημ/νία</Label>
              <Input type="date" {...register("scheduled_date")} />
              {errors.scheduled_date && <p className="text-sm text-destructive">{errors.scheduled_date.message}</p>}
            </div>
            <div className="space-y-2 lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-primary" />
                  Ώρα ραντεβού
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-[11px] text-muted-foreground"
                  onClick={() => setManualTimeMode((m) => !m)}
                >
                  {manualTimeMode ? "Χρήση διαθέσιμων κουλάκιων" : "Χειροκίνητη ώρα"}
                </Button>
              </div>
              {manualTimeMode ? (
                <div className="flex flex-wrap gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Έναρξη</span>
                    <Input type="time" className="w-[8.5rem]" {...register("start_time")} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Λήξη</span>
                    <Input type="time" className="w-[8.5rem]" {...register("end_time")} />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-background via-muted/20 to-muted/40 p-3 shadow-inner sm:p-4">
                    <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
                      Εμφανίζονται μόνο ελεύθερα κουλάκια (08:00–22:00, βήμα 15 λεπτά
                      {assignedUserIdRaw ? " · ίδιος υπεύθυνος" : " · όλοι οι υπεύθυνοι"}).
                    </p>
                    <div className="max-h-48 overflow-y-auto pr-1">
                      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5">
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
                        Δεν υπάρχουν ελεύθερα κουλάκια για αυτή την ημερομηνία και διάρκεια. Άλλαξε ημερομηνία, υπεύθυνο ή
                        χρησιμοποίησε χειροκίνητη ώρα.
                      </p>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Λήξη:{" "}
                    <span className="font-medium text-foreground tabular-nums">
                      {toTimeInputValue(watchedEndTime)}
                    </span>{" "}
                    <span className="text-muted-foreground">({slotDurationMinutesForPicker} λεπ.)</span>
                  </p>
                  <input type="hidden" {...register("start_time")} />
                  <input type="hidden" {...register("end_time")} />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Εκτίμηση κόστους (€)</Label>
              <Input type="number" step="0.01" {...register("cost_estimate")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="appointment-location-address">Διεύθυνση ραντεβού (προαιρετικό)</Label>
            <Input
              id="appointment-location-address"
              {...register("location_address")}
              placeholder="Οδός, αριθμός, περιοχή — τόπος επίσκεψης για αυτό το ραντεβού"
              autoComplete="street-address"
            />
            <p className="text-[11px] text-muted-foreground">
              Ξεχωριστά από τη διεύθυνση πελάτη· χρησιμοποιείται όταν η επίσκεψη γίνεται σε άλλο σημείο.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Περιγραφή</Label>
              <Input {...register("description")} placeholder="Σύντομη περιγραφή εργασίας..." />
            </div>
            <div className="space-y-2">
              <Label>Σημειώσεις δημιουργίας</Label>
              <Input {...register("creation_notes")} placeholder="Ειδικές οδηγίες, προτιμήσεις κ.λπ." />
            </div>
          </div>
          {status === "completed" && (
            <Card className="border-border/60 bg-background/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Ολοκλήρωση & Χρέωση</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Διάρκεια ραντεβού (λεπτά)</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={completionDurationInput}
                      onChange={(e) => setCompletionDurationInput(e.target.value)}
                      placeholder="π.χ. 90"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Έξτρα χρεώσεις (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={extraChargesInput}
                      onChange={(e) => setExtraChargesInput(e.target.value)}
                      placeholder="π.χ. 15.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Τελική τιμή συνόλου (€)</Label>
                    <Input value={completionTotalAmount.toFixed(2)} readOnly />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Βάση υπηρεσιών: {completionBaseAmount.toFixed(2)} € + έξτρα χρεώσεις.
                </div>
                <div className="space-y-2">
                  <Label>Σημειώσεις ολοκλήρωσης</Label>
                  <Input {...register("completion_notes")} placeholder="Τι έγινε στο ραντεβού" />
                </div>
                <div className="space-y-3 rounded-lg border border-border/70 bg-card/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Χρειάζεται επόμενο service</p>
                      <p className="text-xs text-muted-foreground">Δημιούργησε υπενθύμιση συντήρησης για μελλοντική επικοινωνία.</p>
                    </div>
                    <Switch checked={needsServiceReminder} onCheckedChange={setNeedsServiceReminder} />
                  </div>
                  {needsServiceReminder && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant={reminderPresetMonths === "3" ? "default" : "outline"} onClick={() => setReminderPresetMonths("3")}>
                          3 μήνες
                        </Button>
                        <Button type="button" size="sm" variant={reminderPresetMonths === "6" ? "default" : "outline"} onClick={() => setReminderPresetMonths("6")}>
                          6 μήνες
                        </Button>
                        <Button type="button" size="sm" variant={reminderPresetMonths === "12" ? "default" : "outline"} onClick={() => setReminderPresetMonths("12")}>
                          12 μήνες
                        </Button>
                        <Button type="button" size="sm" variant={reminderPresetMonths === "custom" ? "default" : "outline"} onClick={() => setReminderPresetMonths("custom")}>
                          Προσαρμοσμένη
                        </Button>
                      </div>
                      {reminderPresetMonths === "custom" && (
                        <div className="space-y-1">
                          <Label>Ημερομηνία υπενθύμισης</Label>
                          <Input type="date" value={reminderCustomDate} onChange={(e) => setReminderCustomDate(e.target.value)} />
                        </div>
                      )}
                      <div className="space-y-1">
                        <Label>Σημειώσεις υπενθύμισης (προαιρετικά)</Label>
                        <Textarea
                          value={reminderNotes}
                          onChange={(e) => setReminderNotes(e.target.value)}
                          placeholder="Υπενθύμισε μου ξανά για φίλτρα, έλεγχο συντήρησης κ.λπ."
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
            <CardTitle className="text-base">Πληρωμή</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {paymentLoading ? (
              <p className="text-sm text-muted-foreground">Φόρτωση στοιχείων πληρωμής...</p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Τελικό ποσό (€)</Label>
                    <p className="text-sm text-muted-foreground">
                      {derivedAmount > 0 ? derivedAmount.toFixed(2) : "0.00"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label>Κατάσταση πληρωμής</Label>
                    <p className="text-sm text-muted-foreground">
                      {paymentStatus === "paid" ? "Πληρωμένο" : paymentStatus === "partial" ? "Μερικό" : "Απλήρωτο"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paid-amount">Πληρωμένο ποσό (€)</Label>
                    <Input
                      id="paid-amount"
                      type="number"
                      step="0.01"
                      value={paidAmountInput}
                      onChange={(e) => setPaidAmountInput(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Υπόλοιπο (€)</Label>
                    <p className="text-sm text-muted-foreground">
                      {remainingBalance.toFixed(2)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment-method">Τρόπος πληρωμής</Label>
                    <Input
                      id="payment-method"
                      placeholder="π.χ. Μετρητά, Κάρτα"
                      value={paymentMethodInput}
                      onChange={(e) => setPaymentMethodInput(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment-notes">Σημειώσεις πληρωμής</Label>
                    <Input
                      id="payment-notes"
                      placeholder="Σημειώσεις"
                      value={paymentNotesInput}
                      onChange={(e) => setPaymentNotesInput(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Ημερομηνία πληρωμής</Label>
                    <p className="text-sm text-muted-foreground">
                      {payment?.created_at ? formatDate(payment.created_at) : "Θα οριστεί κατά την πρώτη πληρωμή"}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="button" variant="outline" onClick={handleSavePayment} disabled={paymentSaving}>
                    {paymentSaving ? "Αποθήκευση..." : "Αποθήκευση πληρωμής"}
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
            <DialogTitle>Νέος πελάτης</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-first-name">Όνομα *</Label>
                <Input
                  id="new-first-name"
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-last-name">Επώνυμο *</Label>
                <Input
                  id="new-last-name"
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-phone">Τηλέφωνο</Label>
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
                <Label htmlFor="new-address">Διεύθυνση (προαιρετικό)</Label>
                <Input
                  id="new-address"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="Οδός, αριθμός…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-area">Περιοχή</Label>
                <Input
                  id="new-area"
                  value={newArea}
                  onChange={(e) => setNewArea(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-postal-code">Τ.Κ.</Label>
                <Input
                  id="new-postal-code"
                  value={newPostalCode}
                  onChange={(e) => setNewPostalCode(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-company">Εταιρεία</Label>
                <Input
                  id="new-company"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-vat-number">ΑΦΜ</Label>
                <Input
                  id="new-vat-number"
                  value={newVatNumber}
                  onChange={(e) => setNewVatNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="new-notes">Σημειώσεις</Label>
                <Input
                  id="new-notes"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="new-tags">Tags (χωρισμένα με κόμμα)</Label>
                <Input
                  id="new-tags"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              * Όνομα και επώνυμο υποχρεωτικά. Απαιτείται τουλάχιστον ένα από Τηλέφωνο ή Email. Η διεύθυνση είναι προαιρετική.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateCustomerOpen(false)}
                disabled={creatingCustomer}
              >
                Ακύρωση
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  try {
                    if (!businessId) {
                      toast({
                        title: "Σφάλμα",
                        description: "Λείπει το αναγνωριστικό επιχείρησης. Δεν μπορεί να δημιουργηθεί πελάτης.",
                        variant: "destructive",
                      })
                      return
                    }
                    if (!newFirstName.trim() || !newLastName.trim()) {
                      toast({
                        title: "Σφάλμα",
                        description: "Συμπληρώστε όνομα και επώνυμο.",
                        variant: "destructive",
                      })
                      return
                    }
                    if (!newPhone.trim() && !newEmail.trim()) {
                      toast({
                        title: "Σφάλμα",
                        description: "Συμπληρώστε τουλάχιστον τηλέφωνο ή email.",
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
                        title: "Υπάρχει ήδη πελάτης",
                        description: "Βρέθηκε πελάτης με ίδιο τηλέφωνο ή email. Επιλέχθηκε ο υπάρχων πελάτης.",
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
                        title: "Όριο πελατών πλάνου",
                        description: "Έχεις φτάσει το μέγιστο πλήθος πελατών για το τρέχον πλάνο επιχείρησης.",
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
                      `Νέος πελάτης από φόρμα ραντεβού: ${created.first_name} ${created.last_name}`.trim(),
                      {
                        notificationType: "customer_created",
                        relatedCustomerId: created.id,
                        metadata: { source: "appointment_form" },
                      },
                    )
                    toast({
                      title: "Πελάτης δημιουργήθηκε",
                      description: "Ο νέος πελάτης προστέθηκε και επιλέχθηκε στο ραντεβού.",
                    })
                    setCreateCustomerOpen(false)
                  } catch (err) {
                    console.error("Create inline customer error:", err)
                    const message = err instanceof Error ? err.message : "Αποτυχία δημιουργίας πελάτη"
                    toast({ title: "Σφάλμα", description: message, variant: "destructive" })
                  } finally {
                    setCreatingCustomer(false)
                  }
                }}
                disabled={creatingCustomer}
              >
                {creatingCustomer ? "Δημιουργία..." : "Αποθήκευση πελάτη"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Ακύρωση
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Αποθήκευση..." : "Αποθήκευση"}
        </Button>
      </div>
    </form>
  )
}
