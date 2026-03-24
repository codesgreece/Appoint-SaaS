/**
 * TEMPORARY DEBUG — simplified: requires appointment_id, ignores business Telegram settings.
 * Revert to production behavior when done debugging.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
}

const HARDCODED_CHAT_ID = 1603616406
const DEBUG_MESSAGE = "NEW APPOINTMENT FLOW REACHED"

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405)

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")?.trim() ?? ""

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ ok: false, error: "server_misconfigured" }, 500)
    }
    if (!botToken) {
      return json({ ok: false, error: "missing_telegram_bot_token" }, 500)
    }

    const body = (await req.json().catch(() => ({}))) as { appointment_id?: string }
    const appointmentId = typeof body.appointment_id === "string" ? body.appointment_id.trim() : ""
    if (!appointmentId) {
      return json({ ok: false, error: "appointment_id_required" }, 400)
    }

    const authHeader = req.headers.get("Authorization") ?? ""
    if (!authHeader.startsWith("Bearer ")) {
      return json({ ok: false, error: "unauthorized" }, 401)
    }
    const bearer = authHeader.slice(7)

    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: row, error: rowErr } = await admin
      .from("appointments_jobs")
      .select("id,business_id")
      .eq("id", appointmentId)
      .maybeSingle()

    if (rowErr || !row) {
      return json({ ok: false, error: "appointment_not_found", appointment_id: appointmentId }, 404)
    }

    const businessId = (row as { business_id: string }).business_id

    if (bearer !== serviceRoleKey) {
      const anon = createClient(supabaseUrl, anonKey)
      const { data: { user }, error: userErr } = await anon.auth.getUser(bearer)
      if (userErr || !user) return json({ ok: false, error: "unauthorized" }, 401)

      const { data: profile } = await admin.from("users").select("business_id").eq("id", user.id).maybeSingle()
      const uid = (profile as { business_id?: string } | null)?.business_id
      if (!uid || uid !== businessId) return json({ ok: false, error: "forbidden" }, 403)
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: HARDCODED_CHAT_ID,
        text: DEBUG_MESSAGE,
      }),
    })

    const raw = await tgRes.text()
    let telegramParsed: unknown
    try {
      telegramParsed = JSON.parse(raw)
    } catch {
      telegramParsed = { raw }
    }

    if (!tgRes.ok) {
      return json(
        {
          ok: false,
          error: "telegram_api_error",
          appointment_id: appointmentId,
          telegram: telegramParsed,
        },
        502,
      )
    }

    return json({
      ok: true,
      sent: true,
      appointment_id: appointmentId,
      telegram: telegramParsed,
    })
  } catch (e) {
    return json(
      { ok: false, error: "exception", message: e instanceof Error ? e.message : String(e) },
      500,
    )
  }
})
