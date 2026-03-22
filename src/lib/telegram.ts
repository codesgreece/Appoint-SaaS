import { supabase } from "@/lib/supabase"

/**
 * Από απάντηση σφάλματος του supabase.functions.invoke — το FunctionsHttpError έχει
 * `context` = Fetch Response (όχι JSON string στο .body).
 */
export async function parseFunctionsHttpError(err: unknown): Promise<string> {
  if (!err || typeof err !== "object") return String(err)
  const e = err as { name?: string; message?: string; context?: unknown }
  if (e.context instanceof Response) {
    try {
      const res = e.context
      const ct = res.headers.get("content-type") ?? ""
      if (ct.includes("application/json")) {
        const j = (await res.json()) as { error?: string; message?: string }
        if (typeof j?.error === "string") return j.error
        if (typeof j?.message === "string") return j.message
      } else {
        const t = await res.text()
        if (t) return t.slice(0, 800)
      }
    } catch {
      /* ignore */
    }
  }
  if (e.message && e.message !== "Edge Function returned a non-2xx status code") return e.message
  return "Η κλήση Edge Function απέτυχε. Έλεγξε σύνδεση και ρυθμίσεις Supabase."
}

/** Φρέσκο session + invoke χωρίς χειροκίνητο Authorization (το SDK βάζει σωστά Bearer + apikey). */
async function invokeEdgeFunction<T>(name: string, body?: Record<string, unknown>): Promise<{ data: T | null; error: Error | null }> {
  const { error: refErr } = await supabase.auth.refreshSession()
  if (refErr) console.warn("[invokeEdgeFunction] refreshSession:", refErr)

  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
  if (sessionErr) {
    return { data: null, error: sessionErr as Error }
  }
  if (!sessionData.session?.access_token) {
    return { data: null, error: new Error("Δεν υπάρχει ενεργή σύνδεση. Συνδέσου ξανά.") }
  }

  return supabase.functions.invoke(name, { body }) as Promise<{ data: T | null; error: Error | null }>
}

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
  const { data, error } = await invokeEdgeFunction<{ success?: boolean; skipped?: boolean; reason?: string }>(
    "send-telegram-notification",
    { business_id: businessId, message },
  )
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
  const { data, error } = await invokeEdgeFunction<{ success?: boolean }>("process-telegram-events", {})
  if (error) {
    console.warn("process-telegram-events (flush) failed:", error)
    return false
  }
  return Boolean((data as { success?: boolean } | null)?.success)
}

/** Δοκιμή από Ρυθμίσεις — χρησιμοποιεί τιμές φόρμας */
export async function invokeTelegramTestMessage(params: {
  businessId: string
  telegramEnabled: boolean
  telegramChatId: string
  telegramBotToken: string
}) {
  return invokeEdgeFunction("send-telegram-notification", {
    business_id: params.businessId,
    use_form_values: true,
    telegram_enabled: params.telegramEnabled,
    telegram_chat_id: params.telegramChatId,
    telegram_bot_token: params.telegramBotToken,
    message:
      "<b>Δοκιμή Telegram — Appoint SaaS</b>\nΑν βλέπεις αυτό το μήνυμα, η αποστολή από την εφαρμογή λειτουργεί.",
  })
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

