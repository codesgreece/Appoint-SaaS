import { supabase } from "@/lib/supabase"

function getTelegramBotToken(): string {
  const env = import.meta.env as Record<string, string | undefined>
  return (env.TELEGRAM_BOT_TOKEN ?? env.VITE_TELEGRAM_BOT_TOKEN ?? "").trim()
}

async function sendTelegramMessageWithToken(
  token: string,
  chatId: string,
  message: string,
): Promise<void> {
  if (!token?.trim()) {
    throw new Error("Missing Telegram bot token.")
  }
  if (!chatId?.trim()) {
    throw new Error("Missing Telegram chat id.")
  }

  const endpoint = `https://api.telegram.org/bot${token.trim()}/sendMessage`
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId.trim(),
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  })

  if (!res.ok) {
    let details = ""
    try {
      details = await res.text()
    } catch {
      details = ""
    }
    throw new Error(`Telegram API error (${res.status})${details ? `: ${details}` : ""}`)
  }
}

export async function sendTelegramMessage(chatId: string, message: string): Promise<void> {
  const token = getTelegramBotToken()
  if (!token) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN environment variable.")
  }
  await sendTelegramMessageWithToken(token, chatId, message)
}

export async function sendBusinessTelegramMessage(
  businessId: string,
  message: string,
): Promise<boolean> {
  if (!businessId) return false
  // Prefer server-side send via Edge Function (avoids browser CORS issues and keeps secrets server-side).
  const { data, error } = await supabase.functions.invoke("send-telegram-notification", {
    body: { business_id: businessId, message },
  })
  if (error) {
    // Fallback to direct client-side send only if function call fails.
    console.warn("send-telegram-notification invoke failed, trying direct fallback:", error)
    const { data: biz, error: bizErr } = await supabase
      .from("businesses")
      .select("telegram_enabled, telegram_chat_id, telegram_bot_token")
      .eq("id", businessId)
      .maybeSingle()
    if (bizErr || !biz) return false
    const enabled = Boolean((biz as { telegram_enabled?: boolean | null }).telegram_enabled)
    const chatId = ((biz as { telegram_chat_id?: string | null }).telegram_chat_id ?? "").trim()
    const businessToken = ((biz as { telegram_bot_token?: string | null }).telegram_bot_token ?? "").trim()
    const token = businessToken || getTelegramBotToken()
    if (!enabled || !chatId || !token) return false
    await sendTelegramMessageWithToken(token, chatId, message)
    return true
  }
  return Boolean((data as { success?: boolean } | null)?.success ?? true)
}

export function formatAppointmentTelegramMessage(input: {
  event: "created" | "completed" | "reminder_30m"
  customerName: string
  date: string
  time: string
  serviceName: string
}): string {
  const eventLabel =
    input.event === "created"
      ? "Νέο ραντεβού"
      : input.event === "completed"
        ? "Ολοκλήρωση ραντεβού"
        : "Υπενθύμιση 30 λεπτά πριν"

  return [
    `<b>${eventLabel}</b>`,
    `Πελάτης: ${input.customerName || "—"}`,
    `Ημερομηνία: ${input.date || "—"}`,
    `Ώρα: ${input.time || "—"}`,
    `Υπηρεσία: ${input.serviceName || "—"}`,
  ].join("\n")
}

