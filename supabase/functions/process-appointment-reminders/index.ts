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

type AppointmentRow = {
  id: string
  business_id: string
  scheduled_date: string
  start_time: string
  end_time: string
  status: string
  customer: { first_name: string; last_name: string } | null
  service: { name: string } | null
  business: { telegram_enabled: boolean; telegram_chat_id: string | null } | null
}

function toDateTime(date: string, time: string): Date | null {
  const value = new Date(`${date}T${time}`)
  return Number.isNaN(value.getTime()) ? null : value
}

async function sendTelegram(token: string, chatId: string, text: string) {
  const endpoint = `https://api.telegram.org/bot${token}/sendMessage`
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`Telegram API error (${res.status})${detail ? `: ${detail}` : ""}`)
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })
  try {
    const cronSecret = Deno.env.get("CRON_SECRET")?.trim()
    if (cronSecret) {
      const authHeader = req.headers.get("Authorization") ?? ""
      const expected = `Bearer ${cronSecret}`
      if (authHeader !== expected) {
        return json({ success: false, error: "Unauthorized" }, 401)
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? ""
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing supabase env" }, 500)
    if (!botToken) return json({ error: "Missing TELEGRAM_BOT_TOKEN env" }, 500)

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data, error } = await supabase
      .from("appointments_jobs")
      .select(
        "id, business_id, scheduled_date, start_time, end_time, status, customer:customers(first_name,last_name), service:services(name), business:businesses(telegram_enabled,telegram_chat_id)",
      )
      .in("status", ["pending", "confirmed", "in_progress"])
    if (error) throw error

    const now = new Date()
    const targetStart = new Date(now.getTime() + 29 * 60 * 1000)
    const targetEnd = new Date(now.getTime() + 31 * 60 * 1000)
    let sent = 0
    let skipped = 0

    for (const row of (data ?? []) as AppointmentRow[]) {
      const b = row.business
      if (!b?.telegram_enabled || !b.telegram_chat_id) {
        skipped += 1
        continue
      }
      const startAt = toDateTime(row.scheduled_date, row.start_time)
      if (!startAt) {
        skipped += 1
        continue
      }
      if (startAt < targetStart || startAt > targetEnd) continue

      const reminderFor = startAt.toISOString()
      const { data: existing } = await supabase
        .from("appointment_telegram_reminders")
        .select("id")
        .eq("appointment_id", row.id)
        .eq("reminder_for", reminderFor)
        .maybeSingle()
      if (existing?.id) continue

      const customerName = row.customer ? `${row.customer.first_name} ${row.customer.last_name}` : "—"
      const serviceName = row.service?.name ?? "—"
      const text = [
        "<b>Υπενθύμιση 30 λεπτά πριν</b>",
        `Πελάτης: ${customerName}`,
        `Ημερομηνία: ${row.scheduled_date}`,
        `Ώρα: ${row.start_time} - ${row.end_time}`,
        `Υπηρεσία: ${serviceName}`,
      ].join("\n")

      await sendTelegram(botToken, b.telegram_chat_id, text)

      const { error: insErr } = await supabase.from("appointment_telegram_reminders").insert({
        appointment_id: row.id,
        business_id: row.business_id,
        reminder_for: reminderFor,
      })
      if (insErr) {
        // Do not fail the whole cron call; reminder was sent and duplicate protection might fail only once.
        console.error("Failed to persist reminder log:", insErr)
      }
      sent += 1
    }

    return json({ success: true, sent, skipped, window: "29-31 minutes before start" }, 200)
  } catch (err) {
    return json({ success: false, error: err instanceof Error ? err.message : "Error" }, 500)
  }
})

