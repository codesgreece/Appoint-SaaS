/**
 * Cron-triggered in-app notifications (service role).
 * Invoke with: Authorization: Bearer <CRON_SECRET>
 * Body JSON optional: { "action": "all" | "daily_digest" | "reminders_2h" | "subscription_expiry" | "plan_limits" | "weekly_stats" | "reengagement" }
 *
 * Schedule in Supabase Dashboard → Edge Functions → Cron, or external cron hitting this URL.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

function combineLocalDateTime(dateStr: string, timeStr: string): Date {
  const t = timeStr.length >= 5 ? timeStr.slice(0, 5) : "09:00"
  return new Date(`${dateStr}T${t}:00`)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405)

  const secret = Deno.env.get("CRON_SECRET") ?? ""
  const auth = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim() ?? ""
  if (!secret || auth !== secret) {
    return json({ success: false, error: "Unauthorized" }, 401)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const supabase = createClient(supabaseUrl, serviceKey)

  let action = "all"
  try {
    const body = await req.json().catch(() => ({}))
    if (typeof body?.action === "string") action = body.action
  } catch {
    /* default all */
  }

  const results: Record<string, unknown> = {}

  async function dailyDigest() {
    const today = new Date().toISOString().slice(0, 10)
    const { data: businesses, error } = await supabase.from("businesses").select("id, name")
    if (error) throw error
    let n = 0
    for (const b of businesses ?? []) {
      const bid = (b as { id: string }).id
      const { data: already } = await supabase
        .from("notifications")
        .select("id")
        .eq("business_id", bid)
        .eq("notification_type", "digest_daily")
        .gte("created_at", `${today}T00:00:00`)
        .limit(1)
      if (already && already.length > 0) continue

      const { data: rows } = await supabase
        .from("appointments_jobs")
        .select("status")
        .eq("business_id", bid)
        .eq("scheduled_date", today)
      const c = (rows ?? []).filter(
        (r: { status: string }) => !["cancelled", "no_show"].includes(r.status),
      ).length
      await supabase.from("notifications").insert({
        business_id: bid,
        message: `Σήμερα έχεις ${c} ενεργά ραντεβού (όχι ακυρωμένα/no-show).`,
        notification_type: "digest_daily",
        metadata: { digest_type: "daily", date: today },
      })
      n++
    }
    return n
  }

  async function reminders2h() {
    const now = Date.now()
    const windowStart = now + 110 * 60 * 1000
    const windowEnd = now + 130 * 60 * 1000
    const today = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(now + 86400000).toISOString().slice(0, 10)

    const { data: apps, error } = await supabase
      .from("appointments_jobs")
      .select("id, business_id, title, scheduled_date, start_time, status")
      .in("scheduled_date", [today, tomorrow])
      .in("status", ["pending", "confirmed", "in_progress"])
    if (error) throw error

    let inserted = 0
    for (const a of apps ?? []) {
      const row = a as {
        id: string
        business_id: string
        title: string
        scheduled_date: string
        start_time: string
        status: string
      }
      const start = combineLocalDateTime(row.scheduled_date, row.start_time).getTime()
      if (start < windowStart || start > windowEnd) continue

      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("business_id", row.business_id)
        .eq("related_appointment_id", row.id)
        .eq("notification_type", "appointment_reminder_2h")
        .gte("created_at", new Date(now - 86400000).toISOString())
        .limit(1)

      if (existing && existing.length > 0) continue

      await supabase.from("notifications").insert({
        business_id: row.business_id,
        message: `Υπενθύμιση: ραντεβού «${row.title}» σε περίπου 2 ώρες (${row.scheduled_date} ${String(row.start_time).slice(0, 5)}).`,
        notification_type: "appointment_reminder_2h",
        related_appointment_id: row.id,
        metadata: { reminder_hours: 2 },
      })
      inserted++
    }
    return inserted
  }

  async function subscriptionExpiry() {
    const now = new Date()
    const week = new Date(now.getTime() + 7 * 86400000)
    const { data: biz, error } = await supabase
      .from("businesses")
      .select("id, name, subscription_expires_at")
      .not("subscription_expires_at", "is", null)
      .lte("subscription_expires_at", week.toISOString())
      .gte("subscription_expires_at", now.toISOString())
    if (error) throw error
    let n = 0
    for (const b of biz ?? []) {
      const row = b as { id: string; name: string; subscription_expires_at: string }
      const { data: subDup } = await supabase
        .from("notifications")
        .select("id")
        .eq("business_id", row.id)
        .eq("notification_type", "subscription_expiring")
        .gte("created_at", new Date(now.getTime() - 3 * 86400000).toISOString())
        .limit(1)
      if (subDup && subDup.length > 0) continue

      await supabase.from("notifications").insert({
        business_id: row.id,
        message: `Η συνδρομή λήγει σύντομα (${new Date(row.subscription_expires_at).toLocaleDateString("el-GR")}). Επικοινώνησε για ανανέωση.`,
        notification_type: "subscription_expiring",
        metadata: { expires_at: row.subscription_expires_at },
      })
      n++
    }
    return n
  }

  async function planLimits() {
    const { data: businesses, error } = await supabase
      .from("businesses")
      .select("id, max_users, max_customers, max_appointments")
    if (error) throw error
    let alerts = 0
    for (const b of businesses ?? []) {
      const row = b as { id: string; max_users: number | null; max_customers: number | null; max_appointments: number | null }
      const bid = row.id
      if (row.max_users != null) {
        const { count } = await supabase.from("users").select("id", { count: "exact", head: true }).eq("business_id", bid)
        if ((count ?? 0) >= row.max_users) {
          const { data: ld } = await supabase
            .from("notifications")
            .select("id")
            .eq("business_id", bid)
            .eq("notification_type", "plan_limit_users")
            .gte("created_at", new Date(Date.now() - 72 * 3600000).toISOString())
            .limit(1)
          if (!ld || ld.length === 0) {
            await supabase.from("notifications").insert({
              business_id: bid,
              message: `Έφτασες το όριο χρηστών πλάνου (${row.max_users}).`,
              notification_type: "plan_limit_users",
              metadata: { max: row.max_users },
            })
            alerts++
          }
        }
      }
      if (row.max_customers != null) {
        const { count } = await supabase.from("customers").select("id", { count: "exact", head: true }).eq("business_id", bid)
        if ((count ?? 0) >= row.max_customers) {
          const { data: ld } = await supabase
            .from("notifications")
            .select("id")
            .eq("business_id", bid)
            .eq("notification_type", "plan_limit_customers")
            .gte("created_at", new Date(Date.now() - 72 * 3600000).toISOString())
            .limit(1)
          if (!ld || ld.length === 0) {
            await supabase.from("notifications").insert({
              business_id: bid,
              message: `Έφτασες το όριο πελατών πλάνου (${row.max_customers}).`,
              notification_type: "plan_limit_customers",
              metadata: { max: row.max_customers },
            })
            alerts++
          }
        }
      }
      if (row.max_appointments != null) {
        const { count } = await supabase.from("appointments_jobs").select("id", { count: "exact", head: true }).eq("business_id", bid)
        if ((count ?? 0) >= row.max_appointments) {
          const { data: ld } = await supabase
            .from("notifications")
            .select("id")
            .eq("business_id", bid)
            .eq("notification_type", "plan_limit_appointments")
            .gte("created_at", new Date(Date.now() - 72 * 3600000).toISOString())
            .limit(1)
          if (!ld || ld.length === 0) {
            await supabase.from("notifications").insert({
              business_id: bid,
              message: `Έφτασες το όριο ραντεβού πλάνου (${row.max_appointments}).`,
              notification_type: "plan_limit_appointments",
              metadata: { max: row.max_appointments },
            })
            alerts++
          }
        }
      }
    }
    return alerts
  }

  async function weeklyStats() {
    const now = new Date()
    const from = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10)
    const to = now.toISOString().slice(0, 10)
    const { data: businesses, error } = await supabase.from("businesses").select("id")
    if (error) throw error
    let n = 0
    for (const b of businesses ?? []) {
      const bid = (b as { id: string }).id
      const weekAgoIso = new Date(now.getTime() - 7 * 86400000).toISOString()
      const { data: wdup } = await supabase
        .from("notifications")
        .select("id")
        .eq("business_id", bid)
        .eq("notification_type", "digest_weekly")
        .gte("created_at", weekAgoIso)
        .limit(1)
      if (wdup && wdup.length > 0) continue
      const { data: apps } = await supabase
        .from("appointments_jobs")
        .select("id")
        .eq("business_id", bid)
        .gte("scheduled_date", from)
        .lte("scheduled_date", to)
      const ac = (apps ?? []).length
      const { data: pay } = await supabase.from("payments").select("paid_amount").eq("business_id", bid).gte("created_at", `${from}T00:00:00`)
      const revenue = (pay ?? []).reduce((s, p) => s + Number((p as { paid_amount: number }).paid_amount ?? 0), 0)
      await supabase.from("notifications").insert({
        business_id: bid,
        message: `Εβδομαδιαία σύνοψη: ${ac} ραντεβού στο διάστημα · έσοδα καταχωρημένων πληρωμών ~${revenue.toFixed(0)}€.`,
        notification_type: "digest_weekly",
        metadata: { digest_type: "weekly", from, to },
      })
      n++
    }
    return n
  }

  async function reengagement() {
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
    const { data: businesses, error } = await supabase.from("businesses").select("id")
    if (error) throw error
    let n = 0
    for (const b of businesses ?? []) {
      const bid = (b as { id: string }).id
      const { data: customers } = await supabase.from("customers").select("id").eq("business_id", bid)
      if (!customers?.length) continue
      let stale = 0
      for (const c of customers) {
        const cid = (c as { id: string }).id
        const { data: last } = await supabase
          .from("appointments_jobs")
          .select("scheduled_date")
          .eq("customer_id", cid)
          .order("scheduled_date", { ascending: false })
          .limit(1)
          .maybeSingle()
        const sd = last ? (last as { scheduled_date: string }).scheduled_date : null
        if (!sd || sd < cutoff) stale++
      }
      if (stale > 0) {
        const { data: rdup } = await supabase
          .from("notifications")
          .select("id")
          .eq("business_id", bid)
          .eq("notification_type", "reengagement_summary")
          .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
          .limit(1)
        if (!rdup || rdup.length === 0) {
          await supabase.from("notifications").insert({
            business_id: bid,
            message: `Επαναφορά επαφής: ${stale} πελάτες χωρίς πρόσφατο ραντεβού (90+ ημέρες).`,
            notification_type: "reengagement_summary",
            metadata: { stale_count: stale },
          })
          n++
        }
      }
    }
    return n
  }

  try {
    if (action === "all" || action === "daily_digest") {
      results.daily_digest = await dailyDigest()
    }
    if (action === "all" || action === "reminders_2h") {
      results.reminders_2h = await reminders2h()
    }
    if (action === "all" || action === "subscription_expiry") {
      results.subscription_expiry = await subscriptionExpiry()
    }
    if (action === "all" || action === "plan_limits") {
      results.plan_limits = await planLimits()
    }
    if (action === "all" || action === "weekly_stats") {
      results.weekly_stats = await weeklyStats()
    }
    if (action === "all" || action === "reengagement") {
      results.reengagement = await reengagement()
    }

    return json({ success: true, action, results }, 200)
  } catch (e) {
    console.error("scheduled-notifications:", e)
    return json({ success: false, error: e instanceof Error ? e.message : "Error" }, 500)
  }
})
