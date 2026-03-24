import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { sendNewAppointmentTelegramIfConfigured } from "../_shared/telegramNewAppointment.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

/** TEMPORARY: remove after debugging */
const TEMP_DEBUG_TEST_CHAT_ID = "1603616406"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405)

  try {
    console.log("[telegram-debug] telegram-new-appointment: invoked", { at: new Date().toISOString() })

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ success: false, error: "Missing Supabase env" }, 500)
    }

    const tokenProbe = Deno.env.get("TELEGRAM_BOT_TOKEN")?.trim()
    console.log("[telegram-debug] TELEGRAM_BOT_TOKEN present:", Boolean(tokenProbe))

    if (tokenProbe) {
      try {
        const tempRes = await fetch(`https://api.telegram.org/bot${tokenProbe}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TEMP_DEBUG_TEST_CHAT_ID,
            text: "telegram-new-appointment reached",
          }),
        })
        const tempBody = await tempRes.text()
        console.log("[telegram-debug] TEMP hardcoded test send HTTP status:", tempRes.status)
        console.log("[telegram-debug] TEMP hardcoded test send API body (raw):", tempBody)
      } catch (tempErr) {
        console.error("[telegram-debug] TEMP hardcoded test send threw:", tempErr)
      }
    } else {
      console.warn("[telegram-debug] TEMP test send skipped (no token)")
    }

    const authHeader = req.headers.get("Authorization") ?? ""
    if (!authHeader.startsWith("Bearer ")) {
      return json({ success: false, error: "Unauthorized" }, 401)
    }
    const bearer = authHeader.slice(7).trim()
    const serviceKey = serviceRoleKey.trim()

    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return json({ success: false, error: "Invalid JSON" }, 400)
    }

    const appointmentId = String(body.appointment_id ?? "").trim()
    if (!appointmentId) {
      return json({ success: false, error: "Missing appointment_id" }, 400)
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Same edge function: trusted server caller (e.g. public-booking) uses service role key as Bearer.
    if (serviceKey && bearer === serviceKey) {
      console.log("[telegram-debug] internal service-role invoke for appointment:", appointmentId)
      const result = await sendNewAppointmentTelegramIfConfigured(supabase, appointmentId)
      console.log("[telegram-debug] sendNewAppointmentTelegramIfConfigured result (internal):", result)
      return json({ success: true, ...result, via: "service_role" }, 200)
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await supabaseUser.auth.getUser()
    if (userErr || !userData.user) {
      return json({ success: false, error: "Unauthorized" }, 401)
    }
    console.log("[telegram-debug] auth user id:", userData.user.id)

    const { data: profile, error: profileErr } = await supabase
      .from("users")
      .select("business_id")
      .eq("id", userData.user.id)
      .maybeSingle()

    if (profileErr || !profile) {
      return json({ success: false, error: "User profile not found" }, 403)
    }
    const profileBusinessId = (profile as { business_id: string }).business_id
    console.log("[telegram-debug] business_id (from user profile):", profileBusinessId)

    const { data: appt, error: apptErr } = await supabase
      .from("appointments_jobs")
      .select("business_id")
      .eq("id", appointmentId)
      .maybeSingle()

    if (apptErr || !appt) {
      return json({ success: false, error: "Appointment not found" }, 404)
    }
    const appointmentBusinessId = (appt as { business_id: string }).business_id
    console.log("[telegram-debug] business_id (from appointment):", appointmentBusinessId)

    if (profileBusinessId !== appointmentBusinessId) {
      return json({ success: false, error: "Forbidden" }, 403)
    }

    const { data: bizDebug, error: bizDebugErr } = await supabase
      .from("businesses")
      .select("telegram_enabled,telegram_chat_id")
      .eq("id", appointmentBusinessId)
      .maybeSingle()
    if (bizDebugErr) {
      console.warn("[telegram-debug] businesses row load (debug):", bizDebugErr.message)
    } else {
      console.log("[telegram-debug] businesses row (debug):", {
        telegram_enabled: (bizDebug as { telegram_enabled?: boolean } | null)?.telegram_enabled,
        telegram_chat_id: (bizDebug as { telegram_chat_id?: string | null } | null)?.telegram_chat_id ?? "(null)",
      })
    }

    const result = await sendNewAppointmentTelegramIfConfigured(supabase, appointmentId)
    console.log("[telegram-debug] sendNewAppointmentTelegramIfConfigured result:", result)
    return json({ success: true, ...result }, 200)
  } catch (err) {
    console.error("[telegram-new-appointment]", err)
    return json({ success: false, error: err instanceof Error ? err.message : "Error" }, 500)
  }
})
