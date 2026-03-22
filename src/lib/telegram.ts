import { supabase } from "@/lib/supabase"

/** Για HTML parse_mode — αποφυγή σπασίματος μηνυμάτων από χαρακτήρες <>& */
export function escapeTelegramHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

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
    console.warn("send-telegram-notification invoke failed:", error)
    return false
  }
  const payload = data as { success?: boolean; skipped?: boolean; reason?: string } | null
  if (payload?.skipped) {
    console.warn("Telegram skipped:", payload.reason)
    return false
  }
  return payload?.success !== false
}

/**
 * Επεξεργάζεται αμέσως την ουρά `telegram_notification_queue` (cron + DB triggers).
 * Καλέστε μετά από αποθήκευση ραντεβού/πληρωμής ώστε να μην περιμένει cron.
 */
export async function flushTelegramNotificationQueue(): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke("process-telegram-events", {
    body: {},
  })
  if (error) {
    console.warn("process-telegram-events (flush) failed:", error)
    return false
  }
  return Boolean((data as { success?: boolean } | null)?.success)
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
    `Πελάτης: ${escapeTelegramHtml(input.customerName || "—")}`,
    `Ημερομηνία: ${escapeTelegramHtml(input.date || "—")}`,
    `Ώρα: ${escapeTelegramHtml(input.time || "—")}`,
    `Υπηρεσία: ${escapeTelegramHtml(input.serviceName || "—")}`,
  ].join("\n")
}

