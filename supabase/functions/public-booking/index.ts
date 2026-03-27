import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0
  return h * 60 + m
}

function toHHMM(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`
}

function dateWithMinutes(date: string, minutes: number): Date {
  const hh = Math.floor(minutes / 60)
  const mm = minutes % 60
  return new Date(`${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`)
}

function isSameDate(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405)
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    if (!supabaseUrl || !serviceRoleKey) return json({ success: false, error: "Missing Supabase env" }, 500)
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const body = (await req.json()) as Record<string, unknown>
    const action = String(body.action ?? "")
    const slug = String(body.slug ?? "").trim().toLowerCase()
    if (!slug) return json({ success: false, error: "Missing slug" }, 400)

    const { data: biz, error: bizErr } = await supabase
      .from("businesses")
      .select("id,name,business_type,phone,logo_url,booking_enabled,booking_slug,booking_requires_approval,booking_window_days,booking_theme,booking_start_hour,booking_end_hour,booking_slot_interval_minutes,booking_min_notice_hours")
      .ilike("booking_slug", slug)
      .maybeSingle()
    if (bizErr || !biz) return json({ success: false, error: "Business not found" }, 404)
    if (!(biz as { booking_enabled?: boolean }).booking_enabled) {
      return json({ success: false, error: "Online booking is disabled." }, 403)
    }
    const businessId = (biz as { id: string }).id

    if (action === "get_config") {
      const { data: services } = await supabase
        .from("services")
        .select("id,name,duration_minutes,price,billing_type,hourly_rate,is_public_booking_visible")
        .eq("business_id", businessId)
        .eq("is_public_booking_visible", true)
        .order("name")
      return json({
        success: true,
        business: biz,
        services: services ?? [],
      })
    }

    const windowDays = Math.max(1, Number((biz as { booking_window_days?: number | null }).booking_window_days ?? 30))
    const startHour = Math.min(23, Math.max(0, Number((biz as { booking_start_hour?: number | null }).booking_start_hour ?? 9)))
    const endHour = Math.min(24, Math.max(1, Number((biz as { booking_end_hour?: number | null }).booking_end_hour ?? 20)))
    const interval = Number((biz as { booking_slot_interval_minutes?: number | null }).booking_slot_interval_minutes ?? 15)
    const slotStep = [5, 10, 15, 20, 30, 60].includes(interval) ? interval : 15
    const minNoticeHours = Math.min(168, Math.max(0, Number((biz as { booking_min_notice_hours?: number | null }).booking_min_notice_hours ?? 0)))
    const open = startHour * 60
    const close = endHour * 60

    async function resolveDuration(serviceIdsRaw: unknown, serviceIdRaw: unknown): Promise<number> {
      const ids = Array.isArray(serviceIdsRaw)
        ? serviceIdsRaw.map((x) => String(x)).filter(Boolean)
        : String(serviceIdRaw ?? "")
            .trim()
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
      const uniqueIds = Array.from(new Set(ids))
      if (uniqueIds.length === 0) return 60
      const { data: selected } = await supabase
        .from("services")
        .select("duration_minutes")
        .eq("business_id", businessId)
        .eq("is_public_booking_visible", true)
        .in("id", uniqueIds)
      const total = ((selected ?? []) as Array<{ duration_minutes?: number | null }>)
        .reduce((sum, s) => sum + Number(s.duration_minutes ?? 0), 0)
      return total > 0 ? total : 60
    }

    async function computeSlotsForDate(date: string, duration: number): Promise<string[]> {
      const today = new Date()
      const from = new Date(today)
      from.setHours(0, 0, 0, 0)
      const to = new Date(from)
      to.setDate(to.getDate() + windowDays)
      const targetDate = new Date(`${date}T00:00:00`)
      if (targetDate < from || targetDate > to) return []

      const { data: appointments } = await supabase
        .from("appointments_jobs")
        .select("start_time,end_time,status")
        .eq("business_id", businessId)
        .eq("scheduled_date", date)
        .in("status", ["pending", "confirmed", "in_progress", "rescheduled"])

      const busy = ((appointments ?? []) as { start_time: string; end_time: string }[]).map((a) => ({
        start: toMinutes(a.start_time.slice(0, 5)),
        end: toMinutes(a.end_time.slice(0, 5)),
      }))

      const slots: string[] = []
      const minStartAt = new Date(Date.now() + minNoticeHours * 60 * 60 * 1000)
      for (let t = open; t + duration <= close; t += slotStep) {
        if (isSameDate(targetDate, minStartAt)) {
          const slotDate = dateWithMinutes(date, t)
          if (slotDate < minStartAt) continue
        }
        const overlap = busy.some((b) => t < b.end && t + duration > b.start)
        if (!overlap) slots.push(toHHMM(t))
      }
      return slots
    }

    if (action === "get_slots") {
      const date = String(body.date ?? "")
      if (!date) return json({ success: false, error: "Missing date" }, 400)
      const duration = await resolveDuration(body.service_ids, body.service_id)
      const slots = await computeSlotsForDate(date, duration)
      return json({ success: true, slots })
    }

    if (action === "get_available_dates") {
      const duration = await resolveDuration(body.service_ids, body.service_id)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const dates: string[] = []
      for (let i = 0; i <= windowDays; i += 1) {
        const d = new Date(today)
        d.setDate(today.getDate() + i)
        const date = d.toISOString().slice(0, 10)
        const slots = await computeSlotsForDate(date, duration)
        if (slots.length > 0) dates.push(date)
      }
      return json({ success: true, dates })
    }

    if (action === "create_booking") {
      const customerFirstName = String(body.customer_first_name ?? "").trim()
      const customerLastName = String(body.customer_last_name ?? "").trim()
      const customerPhone = String(body.customer_phone ?? "").trim()
      const serviceIds = (body.service_ids as string[] | undefined) ?? []
      const date = String(body.date ?? "")
      const startTime = String(body.start_time ?? "")
      const notes = String(body.notes ?? "").trim()
      if (!customerFirstName || !customerLastName || !customerPhone || !date || !startTime || serviceIds.length === 0) {
        return json({ success: false, error: "Missing required booking fields" }, 400)
      }

      const { data: services } = await supabase
        .from("services")
        .select("id,name,duration_minutes,price,billing_type,hourly_rate")
        .eq("business_id", businessId)
        .eq("is_public_booking_visible", true)
        .in("id", serviceIds)
      const selected = (services ?? []) as Array<{
        id: string
        name: string
        duration_minutes: number | null
        price: number | null
        billing_type: string
        hourly_rate: number | null
      }>
      if (selected.length === 0) return json({ success: false, error: "No valid services selected" }, 400)
      if (selected.length !== Array.from(new Set(serviceIds)).length) {
        return json({ success: false, error: "One or more selected services are not available for public booking" }, 400)
      }
      const totalDuration = selected.reduce((sum, s) => sum + Number(s.duration_minutes ?? 0), 0) || 60
      const start = toMinutes(startTime.slice(0, 5))
      const end = start + totalDuration
      const endTime = toHHMM(end)
      const estimate = selected.reduce((sum, s) => {
        if (s.billing_type === "hourly" && s.hourly_rate != null && s.duration_minutes != null) {
          return sum + (Number(s.hourly_rate) * Number(s.duration_minutes)) / 60
        }
        return sum + Number(s.price ?? 0)
      }, 0)

      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("business_id", businessId)
        .eq("phone", customerPhone)
        .maybeSingle()

      let customerId = (existingCustomer as { id?: string } | null)?.id
      if (!customerId) {
        const { data: createdCustomer, error: customerErr } = await supabase
          .from("customers")
          .insert({
            business_id: businessId,
            first_name: customerFirstName,
            last_name: customerLastName,
            phone: customerPhone,
            address: "Online booking",
            notes: notes || null,
          })
          .select("id")
          .single()
        if (customerErr || !createdCustomer) return json({ success: false, error: "Failed to create customer" }, 500)
        customerId = (createdCustomer as { id: string }).id
      }

      const requiresApproval = Boolean((biz as { booking_requires_approval?: boolean }).booking_requires_approval)
      const availableSlots = await computeSlotsForDate(date, totalDuration)
      if (!availableSlots.includes(startTime)) {
        return json({ success: false, error: "Η ώρα δεν είναι πλέον διαθέσιμη. Επίλεξε νέα ώρα." }, 409)
      }
      const primaryService = selected[0]
      const { data: appointment, error: appErr } = await supabase
        .from("appointments_jobs")
        .insert({
          business_id: businessId,
          customer_id: customerId,
          service_id: primaryService.id,
          title: `Online booking - ${customerFirstName} ${customerLastName}`,
          description: notes || null,
          status: requiresApproval ? "pending" : "confirmed",
          scheduled_date: date,
          start_time: startTime,
          end_time: endTime,
          cost_estimate: Number(estimate.toFixed(2)),
          creation_notes: "Created from public booking page",
          public_booking_unread: true,
        })
        .select("id")
        .single()
      if (appErr || !appointment) return json({ success: false, error: "Failed to create appointment" }, 500)

      const appointmentId = (appointment as { id: string }).id
      const junction = selected.map((s) => ({
        business_id: businessId,
        appointment_job_id: appointmentId,
        service_id: s.id,
      }))
      await supabase.from("appointment_job_services").insert(junction)

      const svcNames = selected.map((s) => s.name).join(", ")
      const timeShort = startTime.length >= 5 ? startTime.slice(0, 5) : startTime
      const notifMessage =
        `Νέα online κράτηση: ${customerFirstName} ${customerLastName} — ${date} ${timeShort}` +
        (svcNames ? ` · ${svcNames}` : "")

      const { error: notifErr } = await supabase.from("notifications").insert({
        business_id: businessId,
        message: notifMessage,
        notification_type: "appointment_online_booking",
        related_appointment_id: appointmentId,
        metadata: { source: "online_booking" },
      })
      if (notifErr) {
        console.error("public-booking: notification insert failed:", notifErr.message)
      }

      return json({ success: true, appointment_id: appointmentId, status: requiresApproval ? "pending" : "confirmed" })
    }

    return json({ success: false, error: "Unknown action" }, 400)
  } catch (err) {
    return json({ success: false, error: err instanceof Error ? err.message : "Error" }, 500)
  }
})
