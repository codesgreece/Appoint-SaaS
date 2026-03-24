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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405)

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ success: false, error: "Missing Supabase env" }, 500)
    }

    const authHeader = req.headers.get("Authorization") ?? ""
    if (!authHeader.startsWith("Bearer ")) {
      return json({ success: false, error: "Unauthorized" }, 401)
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await supabaseUser.auth.getUser()
    if (userErr || !userData.user) {
      return json({ success: false, error: "Unauthorized" }, 401)
    }

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

    const { data: profile, error: profileErr } = await supabase
      .from("users")
      .select("business_id")
      .eq("id", userData.user.id)
      .maybeSingle()

    if (profileErr || !profile) {
      return json({ success: false, error: "User profile not found" }, 403)
    }

    const { data: appt, error: apptErr } = await supabase
      .from("appointments_jobs")
      .select("business_id")
      .eq("id", appointmentId)
      .maybeSingle()

    if (apptErr || !appt) {
      return json({ success: false, error: "Appointment not found" }, 404)
    }

    if ((profile as { business_id: string }).business_id !== (appt as { business_id: string }).business_id) {
      return json({ success: false, error: "Forbidden" }, 403)
    }

    const result = await sendNewAppointmentTelegramIfConfigured(supabase, appointmentId)
    return json({ success: true, ...result }, 200)
  } catch (err) {
    console.error("[telegram-new-appointment]", err)
    return json({ success: false, error: err instanceof Error ? err.message : "Error" }, 500)
  }
})
