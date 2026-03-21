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
      .select("id,name,business_type,phone,logo_url,booking_enabled,booking_slug,booking_requires_approval,booking_window_days,booking_theme")
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
        .select("id,name,duration_minutes,price,billing_type,hourly_rate")
        .eq("business_id", businessId)
        .order("name")
      return json({
        success: true,
        business: biz,
        services: services ?? [],
      })
    }

    if (action === "get_slots") {
      const date = String(body.date ?? "")
      const serviceId = String(body.service_id ?? "")
      if (!date || !serviceId) return json({ success: false, error: "Missing date/service_id" }, 400)

      const { data: service } = await supabase
        .from("services")
        .select("duration_minutes")
        .eq("id", serviceId)
        .eq("business_id", businessId)
        .maybeSingle()
      const duration = Number((service as { duration_minutes?: number | null } | null)?.duration_minutes ?? 60)
      const slotMinutes = Math.max(15, duration || 60)

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

      const open = 9 * 60
      const close = 20 * 60
      const slots: string[] = []
      for (let t = open; t + slotMinutes <= close; t += 15) {
        const overlap = busy.some((b) => t < b.end && t + slotMinutes > b.start)
        if (!overlap) slots.push(toHHMM(t))
      }
      return json({ success: true, slots })
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

      return json({ success: true, appointment_id: appointmentId, status: requiresApproval ? "pending" : "confirmed" })
    }

    return json({ success: false, error: "Unknown action" }, 400)
  } catch (err) {
    return json({ success: false, error: err instanceof Error ? err.message : "Error" }, 500)
  }
})
