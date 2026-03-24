// New appointment → optional Telegram notify. Secrets: TELEGRAM_BOT_TOKEN, Supabase URL/keys.
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

function formatDateEl(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString("el-GR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatTime(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim()
  if (!s) return "—"
  return s.slice(0, 5)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")?.trim() ?? ""

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "Server configuration error" }, 500)
    }

    const authHeader = req.headers.get("Authorization") ?? ""
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401)
    const bearer = authHeader.slice(7)

    const body = (await req.json()) as { appointment_id?: string }
    const appointmentId = typeof body.appointment_id === "string" ? body.appointment_id.trim() : ""
    if (!appointmentId) return json({ error: "appointment_id required" }, 400)

    const admin = createClient(supabaseUrl, serviceRoleKey)

    if (bearer !== serviceRoleKey) {
      const anon = createClient(supabaseUrl, anonKey)
      const { data: { user }, error: userErr } = await anon.auth.getUser(bearer)
      if (userErr || !user) return json({ error: "Unauthorized" }, 401)

      const { data: profile } = await admin.from("users").select("business_id").eq("id", user.id).maybeSingle()
      const profileBusinessId = (profile as { business_id?: string } | null)?.business_id
      if (!profileBusinessId) return json({ error: "Forbidden" }, 403)

      const { data: apptRow } = await admin.from("appointments_jobs").select("business_id").eq("id", appointmentId).maybeSingle()
      const bid = (apptRow as { business_id?: string } | null)?.business_id
      if (!bid || bid !== profileBusinessId) return json({ error: "Forbidden" }, 403)
    }

    const { data: appointment, error: apptErr } = await admin
      .from("appointments_jobs")
      .select(
        "id,business_id,customer_id,service_id,scheduled_date,start_time, customer:customers(first_name,last_name), service:services(name)",
      )
      .eq("id", appointmentId)
      .maybeSingle()

    if (apptErr || !appointment) return json({ error: "Appointment not found" }, 404)

    const appt = appointment as {
      business_id: string
      scheduled_date: string
      start_time: string
      customer: { first_name?: string | null; last_name?: string | null } | null
      service: { name?: string | null } | null
    }

    const { data: business, error: bizErr } = await admin
      .from("businesses")
      .select("telegram_enabled,telegram_chat_id")
      .eq("id", appt.business_id)
      .maybeSingle()

    if (bizErr || !business) return json({ error: "Business not found" }, 404)

    const biz = business as { telegram_enabled?: boolean; telegram_chat_id?: string | null }
    if (!biz.telegram_enabled) {
      return json({ ok: true, sent: false, skipped: "disabled" })
    }

    const chatId = String(biz.telegram_chat_id ?? "").trim()
    if (!chatId) {
      return json({ ok: true, sent: false, skipped: "no_chat_id" })
    }

    if (!botToken) {
      return json({ ok: true, sent: false, skipped: "no_bot_token" })
    }

    const c = appt.customer
    const customerName = c
      ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—"
      : "—"
    const serviceName = appt.service?.name?.trim() || "—"
    const dateStr = formatDateEl(appt.scheduled_date)
    const timeStr = formatTime(appt.start_time)

    const text = [
      "📅 Νέο ραντεβού",
      `Πελάτης: ${customerName}`,
      `Υπηρεσία: ${serviceName}`,
      `Ημερομηνία: ${dateStr}`,
      `Ώρα: ${timeStr}`,
    ].join("\n")

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    })

    if (!tgRes.ok) {
      const errText = await tgRes.text()
      console.error("Telegram API error:", tgRes.status, errText)
      return json({ ok: false, sent: false, error: "telegram_api_error" }, 502)
    }

    return json({ ok: true, sent: true })
  } catch (e) {
    console.error("telegram-new-appointment:", e)
    return json({ error: e instanceof Error ? e.message : "Error" }, 500)
  }
})
