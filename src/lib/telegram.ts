import { supabase } from "@/lib/supabase"

function getTelegramBotToken(): string {
  const env = import.meta.env as Record<string, string | undefined>
  return (env.TELEGRAM_BOT_TOKEN ?? env.VITE_TELEGRAM_BOT_TOKEN ?? "").trim()
}

export async function sendTelegramMessage(chatId: string, message: string): Promise<void> {
  const token = getTelegramBotToken()
  if (!token) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN environment variable.")
  }
  if (!chatId?.trim()) {
    throw new Error("Missing Telegram chat id.")
  }

  const endpoint = `https://api.telegram.org/bot${token}/sendMessage`
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

export async function sendBusinessTelegramMessage(
  businessId: string,
  message: string,
): Promise<boolean> {
  if (!businessId) return false

  const { data, error } = await supabase
    .from("businesses")
    .select("telegram_enabled, telegram_chat_id")
    .eq("id", businessId)
    .maybeSingle()

  if (error || !data) return false
  const enabled = Boolean((data as { telegram_enabled?: boolean | null }).telegram_enabled)
  const chatId = ((data as { telegram_chat_id?: string | null }).telegram_chat_id ?? "").trim()
  if (!enabled || !chatId) return false

  await sendTelegramMessage(chatId, message)
  return true
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

