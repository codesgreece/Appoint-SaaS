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

type BusinessRow = {
  id: string
  name: string
  telegram_enabled: boolean
  telegram_chat_id: string | null
  telegram_bot_token: string | null
  subscription_expires_at: string | null
  max_customers: number | null
  max_appointments: number | null
  telegram_notification_preferences: Record<string, boolean> | null
}

async function sendTelegram(token: string, chatId: string, text: string, replyMarkup?: unknown) {
  const endpoint = `https://api.telegram.org/bot${token}/sendMessage`
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`Telegram API error (${res.status})${detail ? `: ${detail}` : ""}`)
  }
}

function toGreekStatus(status: string) {
  switch (status) {
    case "cancelled":
      return "Ακυρώθηκε"
    case "no_show":
      return "No-show"
    case "rescheduled":
      return "Επαναπρογραμματισμένο"
    case "confirmed":
      return "Επιβεβαιωμένο"
    case "completed":
      return "Ολοκληρωμένο"
    default:
      return status
  }
}

function amount(n: number | null | undefined) {
  return Number(n ?? 0).toFixed(2)
}

/** Europe/Athens — ώρα και ημερομηνία για σωστό “σήμερα/αύριο” και βραδινό summary μετά τις 23:00. */
const DIGEST_TZ = "Europe/Athens"

function ymdInTimeZone(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d)
}

function hourInTimeZone(d: Date, timeZone: string): number {
  const part = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  })
    .formatToParts(d)
    .find((p) => p.type === "hour")?.value
  return Number(part ?? 0)
}

/** Επόμενη ημερομηνία YYYY-MM-DD μετά το ymd (ημερολογιακά). */
function addOneCalendarDayYmd(ymd: string): string {
  try {
    // Deno / σύγχρονα runtimes
    const T = (globalThis as unknown as { Temporal?: typeof Temporal }).Temporal
    if (T?.PlainDate) {
      return T.PlainDate.from(ymd).add({ days: 1 }).toString()
    }
  } catch {
    // ignore
  }
  const [y, m, d] = ymd.split("-").map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0))
  return ymdInTimeZone(next, DIGEST_TZ)
}

/** Έναρξη (συμπεριλαμβανομένη) και λήξη (αποκλειόμενη) της ημέρας ymd στο DIGEST_TZ, σε UTC ISO για φίλτρα timestamptz. */
function localYmdBoundsUtcIso(ymd: string): { start: string; endExclusive: string } {
  try {
    const T = (globalThis as unknown as { Temporal?: typeof Temporal }).Temporal
    if (T?.PlainDate && T?.PlainTime) {
      const plain = T.PlainDate.from(ymd)
      const midnight = T.PlainTime.from("00:00:00")
      const zStart = plain.toZonedDateTime({ timeZone: DIGEST_TZ, plainTime: midnight })
      const zEnd = plain.add({ days: 1 }).toZonedDateTime({ timeZone: DIGEST_TZ, plainTime: midnight })
      return {
        start: zStart.toInstant().toString(),
        endExclusive: zEnd.toInstant().toString(),
      }
    }
  } catch {
    // ignore
  }
  // Fallback (σπάνιο χωρίς Temporal): μέση ημέρα UTC — λιγότερο ακριβές από Europe/Athens
  const next = addOneCalendarDayYmd(ymd)
  return {
    start: `${ymd}T00:00:00.000Z`,
    endExclusive: `${next}T00:00:00.000Z`,
  }
}

function appointmentActions(appointmentId: string) {
  return {
    inline_keyboard: [
      [
        { text: "✅ Confirm", callback_data: `appt:${appointmentId}:confirm` },
        { text: "🕒 Reschedule", callback_data: `appt:${appointmentId}:reschedule` },
        { text: "❌ Cancel", callback_data: `appt:${appointmentId}:cancel` },
      ],
    ],
  }
}

function isEnabledFor(business: BusinessRow, key: string): boolean {
  const prefs = business.telegram_notification_preferences ?? {}
  if (!(key in prefs)) return true
  return Boolean(prefs[key])
}

async function getBusinessDelivery(
  supabase: ReturnType<typeof createClient>,
  businessId: string,
  fallbackToken: string,
): Promise<{ ok: true; business: BusinessRow; chatId: string; token: string } | { ok: false }> {
  const { data, error } = await supabase
    .from("businesses")
    .select("id,name,telegram_enabled,telegram_chat_id,telegram_bot_token,subscription_expires_at,max_customers,max_appointments,telegram_notification_preferences")
    .eq("id", businessId)
    .maybeSingle()
  if (error || !data) return { ok: false }
  const b = data as BusinessRow
  const chatId = (b.telegram_chat_id ?? "").trim()
  const token = (b.telegram_bot_token ?? "").trim() || fallbackToken
  if (!b.telegram_enabled || !chatId || !token) return { ok: false }
  return { ok: true, business: b, chatId, token }
}

async function processQueue(supabase: ReturnType<typeof createClient>, fallbackToken: string) {
  const { data, error } = await supabase
    .from("telegram_notification_queue")
    .select("id,business_id,event_type,payload")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(100)
  if (error) throw error

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const row of (data ?? []) as { id: string; business_id: string; event_type: string; payload: Record<string, unknown> }[]) {
    try {
      const delivery = await getBusinessDelivery(supabase, row.business_id, fallbackToken)
      if (!delivery.ok) {
        skipped += 1
        await supabase
          .from("telegram_notification_queue")
          .update({ status: "sent", processed_at: new Date().toISOString(), error: "skipped: telegram disabled/misconfigured" })
          .eq("id", row.id)
        continue
      }

      let text = ""
      let replyMarkup: unknown
      const payload = row.payload ?? {}
      const appointmentId = typeof payload.appointment_id === "string" ? payload.appointment_id : ""
      const supportRequestId = typeof payload.support_request_id === "string" ? payload.support_request_id : ""
      const supportMessageId = typeof payload.support_message_id === "string" ? payload.support_message_id : ""
      const paymentId = typeof payload.payment_id === "string" ? payload.payment_id : ""

      if (row.event_type.startsWith("appointment_") && appointmentId) {
        const { data: appt } = await supabase
          .from("appointments_jobs")
          .select("id,title,status,scheduled_date,start_time,end_time,customer:customers(first_name,last_name),service:services(name),assigned_user:users(full_name)")
          .eq("id", appointmentId)
          .maybeSingle()
        const a = appt as
          | {
              id: string
              title: string
              status: string
              scheduled_date: string
              start_time: string
              end_time: string
              customer: { first_name: string; last_name: string } | null
              service: { name: string } | null
              assigned_user: { full_name: string } | null
            }
          | null
        if (!a) throw new Error("Appointment not found")
        const customerName = a.customer ? `${a.customer.first_name} ${a.customer.last_name}` : "—"
        const staffName = a.assigned_user?.full_name ?? "—"

        if (row.event_type === "appointment_created") {
          if (!isEnabledFor(delivery.business, "appointment_created")) {
            skipped += 1
            await supabase
              .from("telegram_notification_queue")
              .update({ status: "sent", processed_at: new Date().toISOString(), error: "skipped: preference disabled" })
              .eq("id", row.id)
            continue
          }
          text = [
            "<b>Νέο ραντεβού</b>",
            `Πελάτης: ${customerName}`,
            `Ημερομηνία: ${a.scheduled_date}`,
            `Ώρα: ${a.start_time} - ${a.end_time}`,
            `Υπηρεσία: ${a.service?.name ?? "—"}`,
            `Υπεύθυνος: ${staffName}`,
          ].join("\n")
          replyMarkup = appointmentActions(a.id)
        } else if (row.event_type === "appointment_status_changed") {
          if (!isEnabledFor(delivery.business, "appointment_cancelled_or_no_show")) {
            skipped += 1
            await supabase
              .from("telegram_notification_queue")
              .update({ status: "sent", processed_at: new Date().toISOString(), error: "skipped: preference disabled" })
              .eq("id", row.id)
            continue
          }
          const newStatus = toGreekStatus(String(payload.new_status ?? a.status))
          text = [
            "<b>Αλλαγή κατάστασης ραντεβού</b>",
            `Πελάτης: ${customerName}`,
            `Ραντεβού: ${a.scheduled_date} ${a.start_time} - ${a.end_time}`,
            `Νέα κατάσταση: ${newStatus}`,
          ].join("\n")
        } else if (row.event_type === "appointment_rescheduled") {
          if (!isEnabledFor(delivery.business, "appointment_rescheduled")) {
            skipped += 1
            await supabase
              .from("telegram_notification_queue")
              .update({ status: "sent", processed_at: new Date().toISOString(), error: "skipped: preference disabled" })
              .eq("id", row.id)
            continue
          }
          text = [
            "<b>Επαναπρογραμματισμός ραντεβού</b>",
            `Πελάτης: ${customerName}`,
            `Παλιά ώρα: ${String(payload.old_date ?? "—")} ${String(payload.old_start_time ?? "—")} - ${String(payload.old_end_time ?? "—")}`,
            `Νέα ώρα: ${a.scheduled_date} ${a.start_time} - ${a.end_time}`,
          ].join("\n")
          replyMarkup = appointmentActions(a.id)
        }
      } else if (row.event_type === "payment_recorded" && paymentId) {
        if (!isEnabledFor(delivery.business, "payment_recorded")) {
          skipped += 1
          await supabase
            .from("telegram_notification_queue")
            .update({ status: "sent", processed_at: new Date().toISOString(), error: "skipped: preference disabled" })
            .eq("id", row.id)
          continue
        }
        const { data: payment } = await supabase
          .from("payments")
          .select("id,amount,paid_amount,remaining_balance,payment_method,payment_status,appointment:appointments_jobs(title,scheduled_date,start_time,customer:customers(first_name,last_name))")
          .eq("id", paymentId)
          .maybeSingle()
        const p = payment as
          | {
              id: string
              amount: number
              paid_amount: number | null
              remaining_balance: number | null
              payment_method: string | null
              payment_status: string
              appointment: {
                title: string
                scheduled_date: string
                start_time: string
                customer: { first_name: string; last_name: string } | null
              } | null
            }
          | null
        if (!p) throw new Error("Payment not found")
        const oldPaid = Number(payload.old_paid_amount ?? 0)
        const newPaid = Number(payload.new_paid_amount ?? p.paid_amount ?? 0)
        const delta = Math.max(0, newPaid - oldPaid)
        const customerName = p.appointment?.customer
          ? `${p.appointment.customer.first_name} ${p.appointment.customer.last_name}`
          : "—"
        text = [
          `<b>${delta > 0 && oldPaid > 0 ? "Μερική πληρωμή" : "Νέα πληρωμή"}</b>`,
          `Πελάτης: ${customerName}`,
          `Ποσό καταχώρησης: €${amount(delta > 0 ? delta : p.paid_amount)}`,
          `Μέθοδος: ${p.payment_method ?? "—"}`,
          `Συνολικό πληρωμένο: €${amount(p.paid_amount)}`,
          `Υπόλοιπο: €${amount(p.remaining_balance)}`,
        ].join("\n")
      } else if (row.event_type === "support_incident_new" && supportRequestId) {
        if (!isEnabledFor(delivery.business, "support_incident_new")) {
          skipped += 1
          await supabase
            .from("telegram_notification_queue")
            .update({ status: "sent", processed_at: new Date().toISOString(), error: "skipped: preference disabled" })
            .eq("id", row.id)
          continue
        }
        const { data: req } = await supabase
          .from("support_requests")
          .select("id,type,message,created_at")
          .eq("id", supportRequestId)
          .maybeSingle()
        const r = req as { id: string; type: string; message: string; created_at: string } | null
        if (!r) throw new Error("Support request not found")
        text = [
          "<b>Νέο support incident</b>",
          `Τύπος: ${r.type === "issue" ? "Issue" : "Suggestion"}`,
          `ID: ${r.id}`,
          `Μήνυμα: ${r.message.slice(0, 220)}${r.message.length > 220 ? "..." : ""}`,
        ].join("\n")
      } else if (row.event_type === "support_reply" && supportRequestId) {
        if (!isEnabledFor(delivery.business, "support_reply")) {
          skipped += 1
          await supabase
            .from("telegram_notification_queue")
            .update({ status: "sent", processed_at: new Date().toISOString(), error: "skipped: preference disabled" })
            .eq("id", row.id)
          continue
        }
        let msgQuery = supabase
          .from("support_request_messages")
          .select("content,sender_role,support_request_id")
          .eq("support_request_id", supportRequestId)
        if (supportMessageId) {
          msgQuery = msgQuery.eq("id", supportMessageId)
        }
        const { data: msg } = await msgQuery.order("created_at", { ascending: false }).limit(1).maybeSingle()
        const m = msg as { content: string; sender_role: string; support_request_id: string } | null
        if (!m) throw new Error("Support reply not found")
        text = [
          "<b>Απάντηση support</b>",
          `Incident: ${supportRequestId}`,
          `Μήνυμα: ${m.content.slice(0, 260)}${m.content.length > 260 ? "..." : ""}`,
        ].join("\n")
      } else {
        skipped += 1
        await supabase
          .from("telegram_notification_queue")
          .update({ status: "sent", processed_at: new Date().toISOString(), error: "skipped: unsupported event/payload" })
          .eq("id", row.id)
        continue
      }

      await sendTelegram(delivery.token, delivery.chatId, text, replyMarkup)
      await supabase
        .from("telegram_notification_queue")
        .update({ status: "sent", processed_at: new Date().toISOString(), error: null })
        .eq("id", row.id)
      sent += 1
    } catch (err) {
      failed += 1
      await supabase
        .from("telegram_notification_queue")
        .update({
          status: "failed",
          processed_at: new Date().toISOString(),
          error: err instanceof Error ? err.message.slice(0, 500) : "error",
        })
        .eq("id", row.id)
    }
  }
  return { sent, failed, skipped, total: (data ?? []).length }
}

async function sendDigestIfMissing(
  supabase: ReturnType<typeof createClient>,
  businessId: string,
  type: "daily_summary" | "morning_briefing",
  dateIso: string,
  sendFn: () => Promise<void>,
) {
  const digestDate = dateIso.slice(0, 10)
  // Check first: if we already logged this digest, do nothing (idempotent).
  const { data: existing } = await supabase
    .from("telegram_digest_logs")
    .select("id")
    .eq("business_id", businessId)
    .eq("digest_type", type)
    .eq("digest_date", digestDate)
    .maybeSingle()
  if (existing) return false

  // Send before persisting log so a failed Telegram send can retry on the next cron run.
  await sendFn()
  const { error } = await supabase
    .from("telegram_digest_logs")
    .insert({ business_id: businessId, digest_type: type, digest_date: digestDate })
  if (error) {
    console.error("telegram_digest_logs insert failed after successful send:", error)
  }
  return true
}

async function processDigestsAndLimits(supabase: ReturnType<typeof createClient>, fallbackToken: string) {
  const now = new Date()
  const todayAthens = ymdInTimeZone(now, DIGEST_TZ)
  const tomorrowAthens = addOneCalendarDayYmd(todayAthens)
  const hourAthens = hourInTimeZone(now, DIGEST_TZ)
  /** Πρωινό briefing ~08:00 τοπική ώρα (μία φορά την ημέρα μέσω digest log). */
  const shouldMorning = hourAthens === 8
  /** Βραδινό summary μετά τις 23:00 τοπική ώρα — έσοδα ημέρας, ολοκληρωμένα σήμερα, κρατήσεις για αύριο. */
  const shouldDaily = hourAthens >= 23

  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("id,name,telegram_enabled,telegram_chat_id,telegram_bot_token,subscription_expires_at,max_customers,max_appointments,telegram_notification_preferences")
    .eq("telegram_enabled", true)
  if (error) throw error

  let digestSent = 0
  let limitSent = 0

  for (const b of (businesses ?? []) as BusinessRow[]) {
    const chatId = (b.telegram_chat_id ?? "").trim()
    const token = (b.telegram_bot_token ?? "").trim() || fallbackToken
    if (!chatId || !token) continue

    if (shouldDaily) {
      if (!isEnabledFor(b, "daily_summary")) {
        // no-op
      } else {
      const didSend = await sendDigestIfMissing(supabase, b.id, "daily_summary", todayAthens, async () => {
        const { start: dayStart, endExclusive: dayEnd } = localYmdBoundsUtcIso(todayAthens)
        const [{ count: completedToday }, { data: paymentsToday }, { count: tomorrowBooked }] =
          await Promise.all([
            supabase.from("appointments_jobs").select("id", { count: "exact", head: true }).eq("business_id", b.id).eq("scheduled_date", todayAthens).eq("status", "completed"),
            supabase.from("payments").select("paid_amount,amount").eq("business_id", b.id).gte("created_at", dayStart).lt("created_at", dayEnd),
            supabase
              .from("appointments_jobs")
              .select("id", { count: "exact", head: true })
              .eq("business_id", b.id)
              .eq("scheduled_date", tomorrowAthens)
              .in("status", ["pending", "confirmed", "in_progress", "rescheduled"]),
          ])
        const revenue = ((paymentsToday ?? []) as { paid_amount?: number | null; amount?: number | null }[]).reduce(
          (sum, x) => sum + Number(x.paid_amount ?? x.amount ?? 0),
          0,
        )
        const text = [
          `<b>Βραδινό summary (${todayAthens})</b>`,
          `Συνολικά έσοδα ημέρας: €${amount(revenue)}`,
          `Ολοκληρωμένα ραντεβού σήμερα: ${completedToday ?? 0}`,
          `Ραντεβού κλεισμένα για αύριο (${tomorrowAthens}): ${tomorrowBooked ?? 0}`,
        ].join("\n")
        await sendTelegram(token, chatId, text)
      })
      if (didSend) digestSent += 1
      }
    }

    if (shouldMorning) {
      if (!isEnabledFor(b, "morning_briefing")) {
        // no-op
      } else {
      const didSend = await sendDigestIfMissing(supabase, b.id, "morning_briefing", todayAthens, async () => {
        const { data: rows } = await supabase
          .from("appointments_jobs")
          .select("start_time,end_time,title,assigned_user:users(full_name)")
          .eq("business_id", b.id)
          .eq("scheduled_date", todayAthens)
          .in("status", ["pending", "confirmed", "in_progress", "rescheduled"])
          .order("start_time", { ascending: true })
          .limit(25)

        const lines = ((rows ?? []) as { start_time: string; end_time: string; title: string; assigned_user: { full_name: string } | null }[]).map(
          (r) => `• ${r.start_time}-${r.end_time} | ${r.title} | ${r.assigned_user?.full_name ?? "—"}`,
        )
        const text = ["<b>Πρωινό briefing</b>", `Σημερινά ραντεβού: ${lines.length}`]
          .concat(lines.length > 0 ? lines : ["(Δεν υπάρχουν ραντεβού για σήμερα)"])
          .join("\n")
        await sendTelegram(token, chatId, text)
      })
      if (didSend) digestSent += 1
      }
    }

    const [{ count: customersCount }, { count: appointmentsCount }] = await Promise.all([
      supabase.from("customers").select("id", { count: "exact", head: true }).eq("business_id", b.id),
      supabase.from("appointments_jobs").select("id", { count: "exact", head: true }).eq("business_id", b.id),
    ])

    const maybeSendLimit = async (key: string, text: string) => {
      const ins = await supabase.from("telegram_limit_alert_logs").insert({ business_id: b.id, alert_key: key })
      if (ins.error) return
      await sendTelegram(token, chatId, text)
      limitSent += 1
    }

    if (b.max_customers && b.max_customers > 0) {
      if (!isEnabledFor(b, "plan_limits")) {
        // skip
      } else {
      const ratio = (customersCount ?? 0) / b.max_customers
      if (ratio >= 0.9) {
        await maybeSendLimit(
          `customers_90`,
          `<b>Όριο πλάνου πελατών</b>\nΧρήση: ${customersCount ?? 0}/${b.max_customers} (${Math.round(ratio * 100)}%)`,
        )
      } else if (ratio >= 0.8) {
        await maybeSendLimit(
          `customers_80`,
          `<b>Προειδοποίηση ορίου πελατών</b>\nΧρήση: ${customersCount ?? 0}/${b.max_customers} (${Math.round(ratio * 100)}%)`,
        )
      }
      }
    }

    if (b.max_appointments && b.max_appointments > 0) {
      if (!isEnabledFor(b, "plan_limits")) {
        // skip
      } else {
      const ratio = (appointmentsCount ?? 0) / b.max_appointments
      if (ratio >= 0.9) {
        await maybeSendLimit(
          `appointments_90`,
          `<b>Όριο πλάνου ραντεβού</b>\nΧρήση: ${appointmentsCount ?? 0}/${b.max_appointments} (${Math.round(ratio * 100)}%)`,
        )
      } else if (ratio >= 0.8) {
        await maybeSendLimit(
          `appointments_80`,
          `<b>Προειδοποίηση ορίου ραντεβού</b>\nΧρήση: ${appointmentsCount ?? 0}/${b.max_appointments} (${Math.round(ratio * 100)}%)`,
        )
      }
      }
    }

    if (b.subscription_expires_at) {
      if (!isEnabledFor(b, "subscription_alerts")) {
        // skip
      } else {
      const msLeft = new Date(b.subscription_expires_at).getTime() - now.getTime()
      const daysLeft = Math.floor(msLeft / (24 * 60 * 60 * 1000))
      if (daysLeft <= 0) {
        await maybeSendLimit("subscription_expired", "<b>Η συνδρομή έληξε</b>\nΑνανέωσε το πλάνο για να συνεχίσεις χωρίς διακοπή.")
      } else if (daysLeft <= 1) {
        await maybeSendLimit("subscription_exp_1d", `<b>Η συνδρομή λήγει σύντομα</b>\nΛήγει σε ${daysLeft} ημέρα.`)
      } else if (daysLeft <= 7) {
        await maybeSendLimit("subscription_exp_7d", `<b>Η συνδρομή λήγει</b>\nΑπομένουν ${daysLeft} ημέρες.`)
      }
      }
    }
  }

  return { digestSent, limitSent }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })
  try {
    const cronSecret = Deno.env.get("CRON_SECRET")?.trim()
    if (cronSecret) {
      const authHeader = req.headers.get("Authorization") ?? ""
      if (authHeader !== `Bearer ${cronSecret}`) {
        return json({ success: false, error: "Unauthorized" }, 401)
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const fallbackToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? ""
    if (!supabaseUrl || !serviceRoleKey) return json({ success: false, error: "Missing Supabase env" }, 500)

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const queue = await processQueue(supabase, fallbackToken)
    const digests = await processDigestsAndLimits(supabase, fallbackToken)

    return json({ success: true, queue, digests })
  } catch (err) {
    return json({ success: false, error: err instanceof Error ? err.message : "Error" }, 500)
  }
})
