import { supabase } from "@/lib/supabase"
import { formatCurrency } from "@/lib/utils"
import type {
  Customer,
  AppointmentJob,
  User,
  Service,
  Crew,
  Business,
  Payment,
  PaymentStatus,
  StaffProfile,
  InAppNotification,
  ServiceReminder,
  Shift,
  InventoryCategory,
  InventoryItem,
} from "@/types"

const OUTSTANDING_NOTIFY_THRESHOLD_EUR = 150

export type CreateInAppNotificationOptions = {
  notificationType?: string
  relatedAppointmentId?: string
  relatedCustomerId?: string
  relatedPaymentId?: string
  relatedSupportRequestId?: string
  metadata?: Record<string, unknown>
}

export async function fetchDashboardStats(_businessId: string) {
  const today = new Date().toISOString().slice(0, 10)
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10)

  const [
    { count: todayAppointments },
    { count: pendingJobs },
    { count: inProgressJobs },
    { count: completedToday },
    { data: revenueTodayRows },
    { data: revenueMonthRows },
    { data: outstandingRows },
  ] = await Promise.all([
    supabase.from("appointments_jobs").select("id", { count: "exact", head: true }).eq("scheduled_date", today),
    supabase.from("appointments_jobs").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("appointments_jobs").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
    supabase
      .from("appointments_jobs")
      .select("id", { count: "exact", head: true })
      .eq("scheduled_date", today)
      .eq("status", "completed"),
    supabase.from("payments").select("paid_amount").gte("created_at", `${today}T00:00:00`).lt("created_at", `${today}T23:59:59`),
    supabase.from("payments").select("paid_amount").gte("created_at", `${startOfMonth}T00:00:00`).lte("created_at", `${endOfMonth}T23:59:59`),
    supabase.from("payments").select("remaining_balance").neq("payment_status", "paid"),
  ])

  const revenueToday = (revenueTodayRows as { paid_amount?: number | null }[] | null)?.reduce((s, r) => s + Number(r.paid_amount ?? 0), 0) ?? 0
  const revenueMonth = (revenueMonthRows as { paid_amount?: number | null }[] | null)?.reduce((s, r) => s + Number(r.paid_amount ?? 0), 0) ?? 0
  const outstanding = (outstandingRows as { remaining_balance?: number | null }[] | null)?.reduce((s, r) => s + Number(r.remaining_balance ?? 0), 0) ?? 0

  return {
    todayAppointments: todayAppointments ?? 0,
    pendingJobs: pendingJobs ?? 0,
    inProgressJobs: inProgressJobs ?? 0,
    completedToday: completedToday ?? 0,
    revenueToday,
    revenueMonth,
    outstandingBalances: outstanding,
  }
}

export async function fetchServiceReminders(
  businessId: string,
  filters?: { status?: "pending" | "completed" | "cancelled"; overdueOnly?: boolean },
): Promise<(ServiceReminder & { customer: Customer | null; appointment_job: AppointmentJob | null })[]> {
  let q = supabase
    .from("service_reminders")
    .select("*, customer:customers(*), appointment_job:appointments_jobs(*)")
    .eq("business_id", businessId)
    .order("due_date", { ascending: true })
    .order("created_at", { ascending: false })

  if (filters?.status) q = q.eq("status", filters.status)
  if (filters?.overdueOnly) {
    const today = new Date().toISOString().slice(0, 10)
    q = q.eq("status", "pending").lt("due_date", today)
  }

  const { data, error } = await q
  if (error) {
    // If migration is not yet applied in an environment, fail gracefully with empty list.
    const code = (error as { code?: string }).code
    const msg = (error as { message?: string }).message ?? ""
    if (code === "42P01" || /service_reminders/i.test(msg)) return []
    throw error
  }
  return (data ?? []) as (ServiceReminder & { customer: Customer | null; appointment_job: AppointmentJob | null })[]
}

export async function fetchShiftsForRange(
  businessId: string,
  from: string,
  to: string,
): Promise<Shift[]> {
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .eq("business_id", businessId)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true })
  if (error) {
    const code = (error as { code?: string }).code
    const msg = (error as { message?: string }).message ?? ""
    if (code === "42P01" || /shifts/i.test(msg)) return []
    throw error
  }
  return (data ?? []) as Shift[]
}

export async function fetchShiftForUserDate(userId: string, date: string): Promise<Shift | null> {
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle()
  if (error) {
    const code = (error as { code?: string }).code
    const msg = (error as { message?: string }).message ?? ""
    if (code === "42P01" || /shifts/i.test(msg)) return null
    return null
  }
  if (!data) return null
  return data as Shift
}

export async function upsertShift(payload: {
  business_id: string
  user_id: string
  date: string
  status: "active" | "off"
  start_time?: string | null
  end_time?: string | null
}): Promise<Shift> {
  const row = {
    business_id: payload.business_id,
    user_id: payload.user_id,
    date: payload.date,
    status: payload.status,
    start_time: payload.status === "off" ? null : payload.start_time ?? "09:00",
    end_time: payload.status === "off" ? null : payload.end_time ?? "17:00",
  }
  const { data, error } = await supabase
    .from("shifts")
    .upsert(row, { onConflict: "business_id,user_id,date" })
    .select("*")
    .single()
  if (error) throw error
  return data as Shift
}

export async function fetchWorkingStaffToday(
  businessId: string,
  todayDate: string,
): Promise<Array<{ user_id: string; full_name: string; start_time: string | null; end_time: string | null }>> {
  const { data, error } = await supabase
    .from("shifts")
    .select("user_id, start_time, end_time, status, user:users(full_name)")
    .eq("business_id", businessId)
    .eq("date", todayDate)
    .eq("status", "active")
    .order("start_time", { ascending: true })
  if (error) {
    const code = (error as { code?: string }).code
    const msg = (error as { message?: string }).message ?? ""
    if (code === "42P01" || /shifts/i.test(msg)) return []
    throw error
  }
  return ((data ?? []) as any[]).map((r) => ({
    user_id: r.user_id as string,
    full_name: (r.user?.full_name as string) ?? "Μέλος ομάδας",
    start_time: (r.start_time as string | null) ?? null,
    end_time: (r.end_time as string | null) ?? null,
  }))
}

export async function createServiceReminder(payload: Partial<ServiceReminder>): Promise<ServiceReminder> {
  const { data, error } = await supabase.from("service_reminders").insert(payload).select().single()
  if (error) throw error
  return data as ServiceReminder
}

export async function updateServiceReminder(id: string, payload: Partial<ServiceReminder>): Promise<ServiceReminder> {
  const { data, error } = await supabase.from("service_reminders").update(payload).eq("id", id).select().single()
  if (error) throw error
  return data as ServiceReminder
}

export async function fetchReportsSummary(businessId: string, params: { from: string; to: string }) {
  const { from, to } = params

  const [
    { data: paymentsInRange, error: paymentsError },
    { data: jobsCounts, error: jobsError },
    { data: revenueByServiceRows, error: serviceError },
    { data: revenueByUserRows, error: userError },
    { data: topCustomersRows, error: customersError },
    { data: recentPaymentsRows, error: recentError },
  ] = await Promise.all([
    supabase
      .from("payments")
      .select("amount, paid_amount, remaining_balance, payment_status, created_at")
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`)
      .eq("business_id", businessId),
    supabase
      .from("appointments_jobs")
      .select("status", { count: "exact", head: false })
      .gte("scheduled_date", from)
      .lte("scheduled_date", to)
      .eq("business_id", businessId),
    supabase
      .from("payments")
      .select("paid_amount, appointment_job:appointments_jobs(service_id, service:services(name))")
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`)
      .eq("business_id", businessId),
    supabase
      .from("payments")
      .select("paid_amount, appointment_job:appointments_jobs(assigned_user_id, assigned_user:users(full_name))")
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`)
      .eq("business_id", businessId),
    supabase
      .from("payments")
      .select("paid_amount, appointment_job:appointments_jobs(customer_id, customer:customers(id, first_name, last_name))")
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`)
      .eq("business_id", businessId),
    supabase
      .from("payments")
      .select("*, appointment_job:appointments_jobs(title, customer:customers(first_name, last_name))")
      .order("created_at", { ascending: false })
      .limit(10)
      .eq("business_id", businessId),
  ])

  if (paymentsError) console.error("fetchReportsSummary payments error:", paymentsError)
  if (jobsError) console.error("fetchReportsSummary jobs error:", jobsError)
  if (serviceError) console.error("fetchReportsSummary services error:", serviceError)
  if (userError) console.error("fetchReportsSummary users error:", userError)
  if (customersError) console.error("fetchReportsSummary customers error:", customersError)
  if (recentError) console.error("fetchReportsSummary recent payments error:", recentError)

  const payments = (paymentsInRange ?? []) as {
    amount: number | null
    paid_amount: number | null
    remaining_balance: number | null
    payment_status: PaymentStatus
    created_at: string
  }[]

  const revenueTotal = payments.reduce((sum, p) => sum + Number(p.paid_amount ?? 0), 0)
  const outstanding = payments.reduce((sum, p) => sum + Number(p.remaining_balance ?? 0), 0)

  const statusCounts: Record<AppointmentJob["status"], number> = {
    pending: 0,
    confirmed: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
    no_show: 0,
    rescheduled: 0,
  }
  ;(jobsCounts as { status: AppointmentJob["status"] }[] | null)?.forEach((row) => {
    if (row.status in statusCounts) statusCounts[row.status] += 1
  })

  const revenueByService: { name: string; value: number }[] = []
  ;(revenueByServiceRows as any[] | null)?.forEach((row) => {
    const name = row.appointment_job?.service?.name ?? "Άλλο"
    const amount = Number(row.paid_amount ?? 0)
    if (!amount) return
    const existing = revenueByService.find((r) => r.name === name)
    if (existing) existing.value += amount
    else revenueByService.push({ name, value: amount })
  })

  const revenueByUser: { name: string; value: number }[] = []
  ;(revenueByUserRows as any[] | null)?.forEach((row) => {
    const name = row.appointment_job?.assigned_user?.full_name ?? "Χωρίς υπεύθυνο"
    const amount = Number(row.paid_amount ?? 0)
    if (!amount) return
    const existing = revenueByUser.find((r) => r.name === name)
    if (existing) existing.value += amount
    else revenueByUser.push({ name, value: amount })
  })

  const customersMap = new Map<string, { name: string; value: number }>()
  ;(topCustomersRows as any[] | null)?.forEach((row) => {
    const customer = row.appointment_job?.customer
    if (!customer) return
    const id = customer.id as string
    const name = `${customer.first_name} ${customer.last_name}`
    const amount = Number(row.paid_amount ?? 0)
    if (!amount) return
    const existing = customersMap.get(id)
    if (existing) existing.value += amount
    else customersMap.set(id, { name, value: amount })
  })

  const topCustomers = Array.from(customersMap.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  return {
    revenueTotal,
    outstanding,
    statusCounts,
    revenueByService,
    revenueByUser,
    topCustomers,
    recentPayments: (recentPaymentsRows ?? []) as any[],
  }
}

export async function fetchCustomers(_businessId: string): Promise<Customer[]> {
  const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as Customer[]
}

export async function fetchCustomerById(id: string): Promise<Customer | null> {
  const { data, error } = await supabase.from("customers").select("*").eq("id", id).single()
  if (error) return null
  return data as Customer
}

export async function createCustomer(payload: Partial<Customer>) {
  const { data, error } = await supabase.from("customers").insert(payload).select().single()
  if (error) throw error
  return data as Customer
}

export async function updateCustomer(id: string, payload: Partial<Customer>) {
  const { data, error } = await supabase.from("customers").update(payload).eq("id", id).select().single()
  if (error) throw error
  return data as Customer
}

export async function deleteCustomer(id: string) {
  const { error } = await supabase.from("customers").delete().eq("id", id)
  if (error) throw error
}

/** Per-customer counts from appointments_jobs (for reliability indicator on Customers list). */
export async function fetchAppointmentStatusCountsByCustomer(
  businessId: string,
): Promise<Record<string, { noShow: number; completed: number }>> {
  const { data, error } = await supabase
    .from("appointments_jobs")
    .select("customer_id, status")
    .eq("business_id", businessId)
  if (error) throw error
  const map: Record<string, { noShow: number; completed: number }> = {}
  for (const row of data ?? []) {
    const cid = row.customer_id as string
    if (!map[cid]) map[cid] = { noShow: 0, completed: 0 }
    if (row.status === "no_show") map[cid].noShow += 1
    if (row.status === "completed") map[cid].completed += 1
  }
  return map
}

export async function fetchAppointments(
  _businessId: string,
  filters?: { from?: string; to?: string; status?: string; customerId?: string },
) {
  let q = supabase
    .from("appointments_jobs")
    .select(
      "*, customer:customers(*), assigned_user:users(full_name, email), crew:crews(id, name, color), service:services(id, name), payments:payments(paid_amount, amount, payment_status, remaining_balance)",
    )
    .order("scheduled_date", { ascending: true })
    .order("start_time", { ascending: true })
  if (filters?.from) q = q.gte("scheduled_date", filters.from)
  if (filters?.to) q = q.lte("scheduled_date", filters.to)
  if (filters?.status) q = q.eq("status", filters.status)
  if (filters?.customerId) q = q.eq("customer_id", filters.customerId)
  let data: unknown[] | null = null
  let error: unknown = null
  const first = await q
  data = first.data as unknown[] | null
  error = first.error
  if (error) {
    const code = (error as { code?: string }).code
    const msg = String((error as { message?: string }).message ?? "")
    if (!(code === "42P01" || /crews/i.test(msg))) throw error
    let fallback = supabase
      .from("appointments_jobs")
      .select(
        "*, customer:customers(*), assigned_user:users(full_name, email), service:services(id, name), payments:payments(paid_amount, amount, payment_status, remaining_balance)",
      )
      .order("scheduled_date", { ascending: true })
      .order("start_time", { ascending: true })
    if (filters?.from) fallback = fallback.gte("scheduled_date", filters.from)
    if (filters?.to) fallback = fallback.lte("scheduled_date", filters.to)
    if (filters?.status) fallback = fallback.eq("status", filters.status)
    if (filters?.customerId) fallback = fallback.eq("customer_id", filters.customerId)
    const second = await fallback
    if (second.error) throw second.error
    data = second.data as unknown[] | null
  }
  return (data ?? []) as (AppointmentJob & {
    customer: Customer
    assigned_user: Pick<User, "full_name" | "email"> | null
    crew?: Pick<Crew, "id" | "name" | "color"> | null
    service: Pick<Service, "id" | "name"> | null
  })[]
}

export async function fetchAppointmentById(id: string) {
  const first = await supabase
    .from("appointments_jobs")
    .select("*, customer:customers(*), assigned_user:users(*), crew:crews(*), service:services(*)")
    .eq("id", id)
    .single()
  if (!first.error) return first.data
  const code = (first.error as { code?: string }).code
  const msg = String((first.error as { message?: string }).message ?? "")
  if (!(code === "42P01" || /crews/i.test(msg))) return null
  const second = await supabase
    .from("appointments_jobs")
    .select("*, customer:customers(*), assigned_user:users(*), service:services(*)")
    .eq("id", id)
    .single()
  if (second.error) return null
  return second.data
}

export async function createAppointment(payload: Partial<AppointmentJob>) {
  const { data, error } = await supabase.from("appointments_jobs").insert(payload).select().single()
  if (error) throw error
  return data as AppointmentJob
}

export async function createInAppNotification(
  businessId: string,
  message: string,
  options?: CreateInAppNotificationOptions,
): Promise<void> {
  const { error } = await supabase.from("notifications").insert({
    business_id: businessId,
    message,
    notification_type: options?.notificationType ?? "general",
    related_appointment_id: options?.relatedAppointmentId ?? null,
    related_customer_id: options?.relatedCustomerId ?? null,
    related_payment_id: options?.relatedPaymentId ?? null,
    related_support_request_id: options?.relatedSupportRequestId ?? null,
    metadata: options?.metadata ?? {},
  })
  if (error) throw error
}

/** Fire-and-forget; never throws. Use so UI flows do not block on notification failures. */
export async function notifyInAppQuiet(
  businessId: string,
  message: string,
  options?: CreateInAppNotificationOptions,
): Promise<void> {
  try {
    await createInAppNotification(businessId, message, options)
  } catch (e) {
    console.warn("notifyInAppQuiet:", e)
  }
}

/** Compares payment rows before/after save and emits in-app alerts (paid, new row, high outstanding). */
export function notifyPaymentRecordChange(
  businessId: string,
  previous: Payment | null,
  next: Payment,
): void {
  void (async () => {
    try {
      const aptId = next.appointment_job_id
      const amt = Number(next.amount ?? 0)
      const paid = Number(next.paid_amount ?? 0)
      const remaining = Number(next.remaining_balance ?? 0)
      const prevPaid = previous ? Number(previous.paid_amount ?? 0) : 0
      const prevStatus = previous?.payment_status ?? null
      const prevRem = previous ? Number(previous.remaining_balance ?? 0) : 0

      const base: CreateInAppNotificationOptions = {
        notificationType: "payment",
        relatedPaymentId: next.id,
        relatedAppointmentId: aptId,
      }

      if (!previous) {
        const msg =
          next.payment_status === "paid"
            ? `Νέα πληρωμή ολοκληρώθηκε: ${formatCurrency(paid)}`
            : `Νέα καταχώριση πληρωμής: ${formatCurrency(amt)} · κατάσταση ${next.payment_status}`
        await createInAppNotification(businessId, msg, base)
        return
      }

      if (prevStatus !== "paid" && next.payment_status === "paid") {
        await createInAppNotification(
          businessId,
          `Ολοκληρώθηκε πληρωμή: ${formatCurrency(paid)} από ${formatCurrency(amt)}`,
          base,
        )
      } else if (paid > prevPaid + 0.009) {
        await createInAppNotification(
          businessId,
          `Ενημέρωση πληρωμής: καταβλήθηκαν ${formatCurrency(paid - prevPaid)} (σύνολο: ${formatCurrency(paid)})`,
          base,
        )
      }

      if (
        next.payment_status !== "paid" &&
        remaining >= OUTSTANDING_NOTIFY_THRESHOLD_EUR &&
        prevRem < OUTSTANDING_NOTIFY_THRESHOLD_EUR
      ) {
        await createInAppNotification(
          businessId,
          `Εκκρεμές υπόλοιπο πάνω από ${OUTSTANDING_NOTIFY_THRESHOLD_EUR}€: ${formatCurrency(remaining)}`,
          { ...base, notificationType: "payment_outstanding" },
        )
      }
    } catch (e) {
      console.warn("notifyPaymentRecordChange:", e)
    }
  })()
}

export async function fetchPaymentById(id: string): Promise<Payment | null> {
  const { data, error } = await supabase
    .from("payments")
    .select(
      "*, appointment_job:appointments_jobs(id, title, scheduled_date, customer_id, customer:customers(first_name, last_name))",
    )
    .eq("id", id)
    .maybeSingle()
  if (error || !data) return null
  return data as Payment
}

export async function fetchNotifications(businessId: string, limit = 40): Promise<InAppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as InAppNotification[]
}

export async function fetchUnreadNotificationCount(businessId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("is_read", false)
  if (error) throw error
  return count ?? 0
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId)
  if (error) throw error
}

export async function markAllNotificationsRead(businessId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("business_id", businessId)
    .eq("is_read", false)
  if (error) throw error
}

export async function updateAppointment(id: string, payload: Partial<AppointmentJob>) {
  const { data, error } = await supabase.from("appointments_jobs").update(payload).eq("id", id).select().single()
  if (error) throw error
  return data as AppointmentJob
}

export async function fetchAppointmentServiceIds(appointmentId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("appointment_job_services")
    .select("service_id")
    .eq("appointment_job_id", appointmentId)
    .order("created_at", { ascending: true })
  if (error) throw error
  return ((data ?? []) as { service_id: string }[]).map((r) => r.service_id)
}

export async function replaceAppointmentServiceIds(
  appointmentId: string,
  businessId: string,
  serviceIds: string[],
): Promise<void> {
  const unique = Array.from(new Set(serviceIds.filter(Boolean)))
  const { error: delErr } = await supabase
    .from("appointment_job_services")
    .delete()
    .eq("appointment_job_id", appointmentId)
  if (delErr) throw delErr
  if (unique.length === 0) return
  const payload = unique.map((serviceId) => ({
    appointment_job_id: appointmentId,
    business_id: businessId,
    service_id: serviceId,
  }))
  const { error: insErr } = await supabase.from("appointment_job_services").insert(payload)
  if (insErr) throw insErr
}

/** Deletes an appointment and its related payments. Call this before deleting a customer who has appointments. */
export async function deleteAppointment(id: string): Promise<void> {
  const { error: paymentsError } = await supabase.from("payments").delete().eq("appointment_job_id", id)
  if (paymentsError) throw paymentsError
  const { error: jobError } = await supabase.from("appointments_jobs").delete().eq("id", id)
  if (jobError) throw jobError
}

export async function fetchTeam(_businessId: string): Promise<User[]> {
  const { data, error } = await supabase.from("users").select("*").order("full_name")
  if (error) throw error
  return (data ?? []) as User[]
}

export async function fetchCrews(businessId: string): Promise<Crew[]> {
  const { data, error } = await supabase.from("crews").select("*").eq("business_id", businessId).order("name")
  if (error) {
    const code = (error as { code?: string }).code
    const msg = (error as { message?: string }).message ?? ""
    if (code === "42P01" || /crews/i.test(msg)) return []
    throw error
  }
  return (data ?? []) as Crew[]
}

export async function createCrew(payload: { business_id: string; name: string; color: string }): Promise<Crew> {
  const { data, error } = await supabase.from("crews").insert(payload).select("*").single()
  if (error) throw error
  return data as Crew
}

export async function deleteCrew(id: string): Promise<void> {
  const { error } = await supabase.from("crews").delete().eq("id", id)
  if (error) throw error
}

export async function fetchStaffProfiles(businessId: string): Promise<StaffProfile[]> {
  const { data, error } = await supabase.from("staff_profiles").select("*").eq("business_id", businessId)
  if (error) throw error
  return (data ?? []) as StaffProfile[]
}

export async function upsertStaffProfile(payload: {
  business_id: string
  user_id: string
  availability: Record<string, unknown> | null
}): Promise<StaffProfile> {
  const { data, error } = await supabase
    .from("staff_profiles")
    .upsert(
      {
        business_id: payload.business_id,
        user_id: payload.user_id,
        availability: payload.availability,
      },
      { onConflict: "business_id,user_id" },
    )
    .select("*")
    .single()
  if (error) throw error
  return data as StaffProfile
}

export async function fetchStaffProfileForUser(userId: string): Promise<StaffProfile | null> {
  const { data, error } = await supabase.from("staff_profiles").select("*").eq("user_id", userId).maybeSingle()
  if (error || !data) return null
  return data as StaffProfile
}

export type InviteTeamMemberRole = "admin" | "employee" | "reception"

async function invokeAuthedFunction<T>(name: string, body: Record<string, unknown>) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ""
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  let token = sessionData?.session?.access_token

  if (sessionError || !token) {
    throw new Error("Δεν είστε συνδεδεμένοι.")
  }
  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing Supabase env (URL/ANON_KEY).")
  }

  async function callWithToken(accessToken: string) {
    return await fetch(`${supabaseUrl}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      } as HeadersInit,
      body: JSON.stringify(body),
    })
  }

  let res = await callWithToken(token)
  let text = await res.text()
  let parsed: any = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = text
  }

  // If token is stale/invalid, refresh once and retry.
  if (!res.ok && res.status === 401 && typeof parsed === "object" && parsed && /invalid jwt/i.test(String((parsed as any).message ?? ""))) {
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession()
    if (!refreshErr && refreshed?.session?.access_token) {
      token = refreshed.session.access_token
      res = await callWithToken(token)
      text = await res.text()
      try {
        parsed = text ? JSON.parse(text) : null
      } catch {
        parsed = text
      }
    }
  }

  if (!res.ok) {
    const msg =
      typeof parsed === "object" && parsed && "error" in parsed
        ? String((parsed as any).error)
        : typeof parsed === "object" && parsed && "message" in parsed
          ? String((parsed as any).message)
          : `Edge Function error (status=${res.status})`
    throw new Error(msg)
  }

  return parsed as T
}

export async function inviteTeamMember(payload: {
  username: string
  full_name: string
  role: InviteTeamMemberRole
  password?: string
}): Promise<{ temporary_password: string; auth_email?: string; username?: string }> {
  const result = await invokeAuthedFunction<{ error?: string; temporary_password?: string; auth_email?: string; username?: string }>(
    "invite-team-member",
    payload
  )
  if (result?.error) throw new Error(result.error)
  return {
    temporary_password: result?.temporary_password ?? "",
    auth_email: result?.auth_email,
    username: result?.username,
  }
}

export async function setTeamMemberStatus(payload: { user_id: string; status: "active" | "inactive" }) {
  const result = await invokeAuthedFunction<{ error?: string; success?: boolean }>("set-team-member-status", payload)
  if ((result as any)?.error) throw new Error(String((result as any).error))
  return result
}

export async function deleteTeamMember(payload: { user_id: string }) {
  const result = await invokeAuthedFunction<{ error?: string; success?: boolean }>("delete-team-member", payload)
  if ((result as any)?.error) throw new Error(String((result as any).error))
  return result
}

export async function activateSubscriptionPurchase(payload: {
  business_id: string
  plan: "starter" | "pro" | "premium"
  duration_months: 1 | 3 | 6 | 12
}): Promise<{ subscription_expires_at?: string }> {
  const result = await invokeAuthedFunction<{
    success?: boolean
    error?: string
    subscription_expires_at?: string
  }>("activate-subscription", payload as unknown as Record<string, unknown>)
  if ((result as { error?: string })?.error) throw new Error(String((result as { error?: string }).error))
  if (!(result as { success?: boolean }).success) throw new Error("Αποτυχία ενεργοποίησης συνδρομής.")
  return result as { subscription_expires_at?: string }
}

export async function fetchServices(_businessId: string): Promise<Service[]> {
  const { data, error } = await supabase.from("services").select("*").order("name")
  if (error) throw error
  return (data ?? []) as Service[]
}

export async function createService(payload: Partial<Service>): Promise<Service> {
  const { data, error } = await supabase.from("services").insert(payload).select().single()
  if (error) throw error
  return data as Service
}

export async function updateService(id: string, payload: Partial<Service>): Promise<Service> {
  const { data, error } = await supabase.from("services").update(payload).eq("id", id).select().single()
  if (error) throw error
  return data as Service
}

export async function deleteService(id: string): Promise<void> {
  const { error } = await supabase.from("services").delete().eq("id", id)
  if (error) throw error
}

export async function fetchInventoryCategories(businessId: string): Promise<InventoryCategory[]> {
  const { data, error } = await supabase
    .from("inventory_categories")
    .select("*")
    .eq("business_id", businessId)
    .order("name", { ascending: true })
  if (error) throw error
  return (data ?? []) as InventoryCategory[]
}

export async function createInventoryCategory(payload: Partial<InventoryCategory>): Promise<InventoryCategory> {
  const { data, error } = await supabase.from("inventory_categories").insert(payload).select().single()
  if (error) throw error
  return data as InventoryCategory
}

export async function updateInventoryCategory(id: string, payload: Partial<InventoryCategory>): Promise<InventoryCategory> {
  const { data, error } = await supabase.from("inventory_categories").update(payload).eq("id", id).select().single()
  if (error) throw error
  return data as InventoryCategory
}

export async function deleteInventoryCategory(id: string): Promise<void> {
  const { error } = await supabase.from("inventory_categories").delete().eq("id", id)
  if (error) throw error
}

export async function fetchInventoryItems(businessId: string): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("business_id", businessId)
    .order("name", { ascending: true })
  if (error) throw error
  return (data ?? []) as InventoryItem[]
}

export async function createInventoryItem(payload: Partial<InventoryItem>): Promise<InventoryItem> {
  const { data, error } = await supabase.from("inventory_items").insert(payload).select().single()
  if (error) throw error
  return data as InventoryItem
}

export async function updateInventoryItem(id: string, payload: Partial<InventoryItem>): Promise<InventoryItem> {
  const { data, error } = await supabase.from("inventory_items").update(payload).eq("id", id).select().single()
  if (error) throw error
  return data as InventoryItem
}

export async function deleteInventoryItem(id: string): Promise<void> {
  const { error } = await supabase.from("inventory_items").delete().eq("id", id)
  if (error) throw error
}

/** Stock level from quantity vs user-defined orange/red thresholds. */
export type InventoryStockLevel = "green" | "orange" | "red"

export function inventoryStockLevel(
  item: Pick<InventoryItem, "quantity_current" | "orange_threshold" | "red_threshold">,
): InventoryStockLevel {
  const qty = Number(item.quantity_current)
  const red = Number(item.red_threshold)
  const orange = Number(item.orange_threshold)
  if (qty <= red) return "red"
  if (qty <= orange) return "orange"
  return "green"
}

/**
 * Notify only when stock enters a worse band (green→orange/red, orange→red).
 * Avoids repeating the same alert while quantity stays in orange or red.
 */
export function shouldSendInventoryLowNotification(
  previous: InventoryItem | null,
  next: InventoryItem,
): boolean {
  const nextLevel = inventoryStockLevel(next)
  if (nextLevel === "green") return false
  if (!previous) return true
  const prevLevel = inventoryStockLevel(previous)
  if (prevLevel === "green") return true
  if (prevLevel === "orange" && nextLevel === "red") return true
  return false
}

/** Sends at most one low-stock notification per transition into warning levels. */
export async function notifyInventoryLowIfNeeded(
  businessId: string,
  message: string,
  previous: InventoryItem | null,
  next: InventoryItem,
): Promise<void> {
  if (!shouldSendInventoryLowNotification(previous, next)) return
  await notifyInAppQuiet(businessId, message, {
    notificationType: "inventory_low",
    metadata: {
      related_inventory_item_id: next.id,
      inventory_stock_level: inventoryStockLevel(next),
    },
  })
}

export async function fetchPayments(_businessId: string) {
  const { data, error } = await supabase
    .from("payments")
    .select("*, appointment_job:appointments_jobs(id, title, scheduled_date, customer_id, customer:customers(first_name, last_name))")
    .order("created_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchPaymentForAppointment(appointmentId: string): Promise<Payment | null> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("appointment_job_id", appointmentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return data as Payment
}

export async function upsertPaymentForAppointment(payload: {
  id?: string
  business_id: string
  appointment_job_id: string
  amount: number
  paid_amount: number
  remaining_balance: number
  payment_status: PaymentStatus
  payment_method?: string | null
  notes?: string | null
  deposit?: number | null
  /** Pass previous row so notifications can compare (omit on first insert if unknown). */
  previousPayment?: Payment | null
}): Promise<Payment> {
  const insertOrUpdatePayload = {
    business_id: payload.business_id,
    appointment_job_id: payload.appointment_job_id,
    amount: payload.amount,
    payment_method: payload.payment_method ?? null,
    payment_status: payload.payment_status,
    deposit: payload.deposit ?? null,
    paid_amount: payload.paid_amount,
    remaining_balance: payload.remaining_balance,
    notes: payload.notes ?? null,
  }

  if (payload.id) {
    const { id } = payload
    console.debug("Supabase updatePaymentForAppointment payload:", { id, rest: insertOrUpdatePayload })
    const { data, error } = await supabase
      .from("payments")
      .update(insertOrUpdatePayload)
      .eq("id", id)
      .select()
      .single()
    if (error) {
      console.error("Supabase updatePaymentForAppointment error:", error)
      throw error
    }
    const row = data as Payment
    notifyPaymentRecordChange(payload.business_id, payload.previousPayment ?? null, row)
    return row
  }
  console.debug("Supabase insertPaymentForAppointment payload:", insertOrUpdatePayload)
  const { data, error } = await supabase
    .from("payments")
    .insert(insertOrUpdatePayload)
    .select()
    .single()
  if (error) {
    console.error("Supabase insertPaymentForAppointment error:", error)
    throw error
  }
  const row = data as Payment
  notifyPaymentRecordChange(payload.business_id, payload.previousPayment ?? null, row)
  return row
}

export async function updatePayment(id: string, payload: Partial<Payment>): Promise<Payment> {
  const { data, error } = await supabase.from("payments").update(payload).eq("id", id).select().single()
  if (error) throw error
  return data as Payment
}

export async function fetchBusiness(businessId: string): Promise<Business | null> {
  const { data, error } = await supabase.from("businesses").select("*").eq("id", businessId).single()
  if (error) return null
  return data as Business
}

export async function countAppointmentsForBusiness(businessId: string): Promise<number> {
  const { count, error } = await supabase
    .from("appointments_jobs")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
  if (error) throw error
  return count ?? 0
}

/**
 * Resets a Demo business: payments, appointments, customers, services, support_requests.
 * Only call when business subscription_plan is "demo". Order respects FK constraints.
 */
export async function resetDemoBusiness(businessId: string): Promise<void> {
  const { error: paymentsErr } = await supabase.from("payments").delete().eq("business_id", businessId)
  if (paymentsErr) throw paymentsErr
  const { error: jobsErr } = await supabase.from("appointments_jobs").delete().eq("business_id", businessId)
  if (jobsErr) throw jobsErr
  const { error: customersErr } = await supabase.from("customers").delete().eq("business_id", businessId)
  if (customersErr) throw customersErr
  const { error: servicesErr } = await supabase.from("services").delete().eq("business_id", businessId)
  if (servicesErr) throw servicesErr
  const { error: supportErr } = await supabase.from("support_requests").delete().eq("business_id", businessId)
  if (supportErr) throw supportErr
}

export async function fetchActivityLogs(_businessId: string, entityType?: string, entityId?: string) {
  let q = supabase.from("activity_logs").select("*, user:users(full_name)").order("created_at", { ascending: false }).limit(50)
  if (entityType) q = q.eq("entity_type", entityType)
  if (entityId) q = q.eq("entity_id", entityId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}
