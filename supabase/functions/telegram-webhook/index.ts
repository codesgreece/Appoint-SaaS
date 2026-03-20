import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

async function telegramApi(token: string, method: string, payload: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`Telegram ${method} failed (${res.status})${detail ? `: ${detail}` : ""}`)
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405)

  try {
    const expectedSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET")?.trim()
    if (expectedSecret) {
      const got = req.headers.get("x-telegram-bot-api-secret-token")?.trim()
      if (!got || got !== expectedSecret) return json({ success: false, error: "Unauthorized" }, 401)
    }

    const body = (await req.json()) as Record<string, unknown>
    const callback = body.callback_query as Record<string, unknown> | undefined
    if (!callback) return json({ success: true, ignored: true })

    const callbackId = String(callback.id ?? "")
    const callbackData = String(callback.data ?? "")
    const message = callback.message as Record<string, unknown> | undefined
    const chat = (message?.chat ?? {}) as Record<string, unknown>
    const chatId = String(chat.id ?? "")
    if (!callbackData || !chatId) return json({ success: true, ignored: true })

    const [prefix, appointmentId, action] = callbackData.split(":")
    if (prefix !== "appt" || !appointmentId || !action) return json({ success: true, ignored: true })

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const fallbackToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? ""
    if (!supabaseUrl || !serviceRoleKey) return json({ success: false, error: "Missing Supabase env" }, 500)

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data: appointment } = await supabase
      .from("appointments_jobs")
      .select("id,business_id,status")
      .eq("id", appointmentId)
      .maybeSingle()
    if (!appointment) return json({ success: true, ignored: true, reason: "appointment_missing" })

    const { data: business } = await supabase
      .from("businesses")
      .select("telegram_chat_id,telegram_bot_token")
      .eq("id", appointment.business_id)
      .maybeSingle()
    if (!business) return json({ success: true, ignored: true, reason: "business_missing" })

    const businessChatId = String((business as { telegram_chat_id?: string | null }).telegram_chat_id ?? "")
    if (businessChatId !== chatId) return json({ success: true, ignored: true, reason: "chat_mismatch" })

    const token = String((business as { telegram_bot_token?: string | null }).telegram_bot_token ?? "").trim() || fallbackToken
    if (!token) return json({ success: false, error: "Missing bot token" }, 500)

    if (action === "confirm") {
      await supabase.from("appointments_jobs").update({ status: "confirmed" }).eq("id", appointmentId)
      await telegramApi(token, "answerCallbackQuery", {
        callback_query_id: callbackId,
        text: "Το ραντεβού επιβεβαιώθηκε.",
        show_alert: false,
      })
    } else if (action === "cancel") {
      await supabase.from("appointments_jobs").update({ status: "cancelled" }).eq("id", appointmentId)
      await telegramApi(token, "answerCallbackQuery", {
        callback_query_id: callbackId,
        text: "Το ραντεβού ακυρώθηκε.",
        show_alert: false,
      })
    } else if (action === "reschedule") {
      await telegramApi(token, "answerCallbackQuery", {
        callback_query_id: callbackId,
        text: "Άνοιξε την εφαρμογή για νέα ημερομηνία/ώρα.",
        show_alert: false,
      })
    } else {
      await telegramApi(token, "answerCallbackQuery", {
        callback_query_id: callbackId,
        text: "Μη υποστηριζόμενη ενέργεια.",
        show_alert: false,
      })
    }

    return json({ success: true })
  } catch (err) {
    return json({ success: false, error: err instanceof Error ? err.message : "Error" }, 500)
  }
})
