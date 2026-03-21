// Activate Starter/Pro/Premium for a business that is currently "unsubscribed".
// Body: { business_id, plan: "starter"|"pro"|"premium", duration_months: 1|3|6|12 }
// 6-month purchases get +2 months (8 months total); 12-month get +2 (14 months total).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

const LIMITS: Record<string, { max_users: number; max_customers: number; max_appointments: number }> = {
  starter: { max_users: 3, max_customers: 300, max_appointments: 1000 },
  pro: { max_users: 10, max_customers: 2000, max_appointments: 10000 },
  premium: { max_users: 30, max_customers: 10000, max_appointments: 50000 },
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })
  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return json({ success: false, error: "Missing Authorization" }, 401)
    const jwt = authHeader.replace("Bearer ", "").trim()

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(jwt)
    if (authError || !authUser) return json({ success: false, error: authError?.message ?? "Invalid token" }, 401)

    const { data: caller, error: callerErr } = await supabase
      .from("users")
      .select("id, role, business_id")
      .eq("id", authUser.id)
      .maybeSingle()
    if (callerErr || !caller) return json({ success: false, error: "Forbidden" }, 403)
    if (caller.role !== "admin") return json({ success: false, error: "Μόνο ο διαχειριστής μπορεί να ενεργοποιήσει συνδρομή." }, 403)
    if (!caller.business_id) return json({ success: false, error: "Forbidden" }, 403)

    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return json({ success: false, error: "Invalid JSON" }, 400)
    }

    const business_id = typeof body.business_id === "string" ? body.business_id.trim() : ""
    const plan = typeof body.plan === "string" ? body.plan.trim().toLowerCase() : ""
    const duration_months = Number(body.duration_months)

    if (!business_id || business_id !== caller.business_id) {
      return json({ success: false, error: "Μη έγκυρη επιχείρηση." }, 403)
    }
    if (!["starter", "pro", "premium"].includes(plan)) {
      return json({ success: false, error: "Μη έγκυρο πλάνο." }, 400)
    }
    if (![1, 3, 6, 12].includes(duration_months)) {
      return json({ success: false, error: "Μη έγκυρη διάρκεια." }, 400)
    }

    const { data: biz, error: bizErr } = await supabase
      .from("businesses")
      .select("id, subscription_plan")
      .eq("id", business_id)
      .maybeSingle()
    if (bizErr || !biz) return json({ success: false, error: "Επιχείρηση δεν βρέθηκε." }, 404)
    if (biz.subscription_plan !== "unsubscribed") {
      return json({ success: false, error: "Η επιχείρηση έχει ήδη ενεργό πλάνο." }, 400)
    }

    const lim = LIMITS[plan]!
    let months = duration_months
    if (months === 6) months = 8
    if (months === 12) months = 14

    const started = new Date()
    const expires = new Date(started)
    expires.setMonth(expires.getMonth() + months)

    const { error: updErr } = await supabase
      .from("businesses")
      .update({
        subscription_plan: plan,
        subscription_status: "active",
        subscription_started_at: started.toISOString(),
        subscription_expires_at: expires.toISOString(),
        max_users: lim.max_users,
        max_customers: lim.max_customers,
        max_appointments: lim.max_appointments,
      })
      .eq("id", business_id)
      .eq("subscription_plan", "unsubscribed")

    if (updErr) return json({ success: false, error: updErr.message }, 400)

    return json({ success: true, subscription_expires_at: expires.toISOString() }, 200)
  } catch (err) {
    return json({ success: false, error: err instanceof Error ? err.message : "Error" }, 500)
  }
})
