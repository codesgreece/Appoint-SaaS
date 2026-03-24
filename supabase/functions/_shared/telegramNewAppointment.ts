import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"

function formatGreekDate(dateIso: string): string {
  try {
    return new Date(`${dateIso}T12:00:00`).toLocaleDateString("el-GR")
  } catch {
    return dateIso
  }
}

function toTimeHHMM(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim()
  if (!s) return "—"
  return s.slice(0, 5)
}

/**
 * Sends a Telegram message when a new appointment is created.
 * Uses TELEGRAM_BOT_TOKEN from env. Does not throw — logs and returns status.
 */
export async function sendNewAppointmentTelegramIfConfigured(
  supabase: SupabaseClient,
  appointmentId: string,
): Promise<{ sent: boolean; skipped?: string }> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN")?.trim()
  console.log("[telegram-debug] shared: TELEGRAM_BOT_TOKEN present:", Boolean(token))
  if (!token) {
    console.warn("[telegram-new-appointment] TELEGRAM_BOT_TOKEN missing")
    return { sent: false, skipped: "missing_bot_token" }
  }

  const { data: appointment, error: apptErr } = await supabase
    .from("appointments_jobs")
    .select("id,business_id,customer_id,service_id,scheduled_date,start_time")
    .eq("id", appointmentId)
    .maybeSingle()

  if (apptErr || !appointment) {
    console.warn("[telegram-new-appointment] appointment load failed:", apptErr?.message)
    return { sent: false, skipped: "appointment_not_found" }
  }

  const { data: business, error: bizErr } = await supabase
    .from("businesses")
    .select("telegram_enabled,telegram_chat_id")
    .eq("id", appointment.business_id)
    .maybeSingle()

  if (bizErr || !business) {
    console.warn("[telegram-new-appointment] business load failed:", bizErr?.message)
    return { sent: false, skipped: "business_not_found" }
  }

  const enabled = Boolean((business as { telegram_enabled?: boolean }).telegram_enabled)
  const chatId = String((business as { telegram_chat_id?: string | null }).telegram_chat_id ?? "").trim()

  console.log("[telegram-debug] shared: business_id", appointment.business_id)
  console.log("[telegram-debug] shared: telegram_enabled", enabled)
  console.log("[telegram-debug] shared: telegram_chat_id loaded", chatId || "(empty)")

  if (!enabled || !chatId) {
    console.log("[telegram-debug] shared: skip send —", !enabled ? "telegram disabled" : "no chat id")
    return { sent: false, skipped: "telegram_disabled_or_no_chat_id" }
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("first_name,last_name")
    .eq("id", appointment.customer_id)
    .maybeSingle()

  const customerName = customer
    ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() || "—"
    : "—"

  const { data: junctionRows } = await supabase
    .from("appointment_job_services")
    .select("service_id")
    .eq("appointment_job_id", appointmentId)

  let serviceLabel = "—"
  const junctionIds = ((junctionRows ?? []) as { service_id: string }[]).map((r) => r.service_id).filter(Boolean)
  if (junctionIds.length > 0) {
    const { data: svcs } = await supabase.from("services").select("name").in("id", junctionIds)
    const names = ((svcs ?? []) as { name: string }[]).map((s) => s.name).filter(Boolean)
    if (names.length > 0) serviceLabel = names.join(", ")
  } else if (appointment.service_id) {
    const { data: svc } = await supabase.from("services").select("name").eq("id", appointment.service_id).maybeSingle()
    serviceLabel = (svc as { name?: string } | null)?.name ?? "—"
  }

  const dateStr = formatGreekDate(String(appointment.scheduled_date))
  const timeStr = toTimeHHMM(appointment.start_time as string)

  const message = [
    "📅 Νέο ραντεβού",
    `Πελάτης: ${customerName}`,
    `Υπηρεσία: ${serviceLabel}`,
    `Ημερομηνία: ${dateStr}`,
    `Ώρα: ${timeStr}`,
  ].join("\n")

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    })
    const bodyText = await res.text()
    console.log("[telegram-debug] shared: real sendMessage HTTP status:", res.status)
    console.log("[telegram-debug] shared: real sendMessage API body (raw):", bodyText)
    if (!res.ok) {
      console.error("[telegram-new-appointment] Telegram API error:", res.status, bodyText)
      return { sent: false, skipped: "telegram_api_error" }
    }
    return { sent: true }
  } catch (e) {
    console.error("[telegram-debug] shared: real sendMessage threw:", e)
    console.error("[telegram-new-appointment] send failed:", e)
    return { sent: false, skipped: "telegram_send_exception" }
  }
}
