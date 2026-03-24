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

function parseTimeHHMM(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim()
  if (!s) return "00:00"
  return s.slice(0, 5)
}

function buildDateTimeLocal(dateIso: string, hhmm: string): Date {
  return new Date(`${dateIso}T${hhmm}:00`)
}

function formatGreekDate(dateIso: string): string {
  try {
    return new Date(`${dateIso}T12:00:00`).toLocaleDateString("el-GR")
  } catch {
    return dateIso
  }
}

function toReadableTime(raw: string | null | undefined): string {
  return parseTimeHHMM(raw)
}

async function sendTelegramMessage(chatId: string, message: string): Promise<void> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN")?.trim()
  console.log("[telegram-debug] sendTelegramMessage: TELEGRAM_BOT_TOKEN present on server:", Boolean(token))
  if (!token) throw new Error("Missing TELEGRAM_BOT_TOKEN")
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
    }),
  })
  const responseText = await res.text()
  console.log("[telegram-debug] Telegram API sendMessage HTTP status:", res.status)
  console.log("[telegram-debug] Telegram API sendMessage response body (raw):", responseText)
  if (!res.ok) {
    throw new Error(`Telegram send failed (${res.status}): ${responseText}`)
  }
}

type BusinessSettings = {
  id: string
  name: string
  telegram_enabled: boolean
  telegram_chat_id: string | null
  telegram_morning_summary_enabled: boolean
  telegram_night_summary_enabled: boolean
  telegram_reminder_30min_enabled: boolean
  telegram_new_appointment_enabled: boolean
}

type AppointmentRow = {
  id: string
  business_id: string
  customer_id: string
  assigned_user_id: string | null
  service_id: string | null
  scheduled_date: string
  start_time: string
  end_time: string
  status: string
  created_at: string
  customer?: { first_name: string; last_name: string } | null
  service?: { name: string } | null
  assigned_user?: { full_name: string } | null
}

async function hasLog(
  supabase: ReturnType<typeof createClient>,
  businessId: string,
  notificationKey: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("telegram_notification_logs")
    .select("id")
    .eq("business_id", businessId)
    .eq("notification_key", notificationKey)
    .maybeSingle()
  if (error) throw error
  return Boolean(data?.id)
}

async function insertLog(
  supabase: ReturnType<typeof createClient>,
  params: {
    businessId: string
    appointmentId?: string | null
    notificationType: string
    notificationKey: string
  },
): Promise<void> {
  const { error } = await supabase.from("telegram_notification_logs").insert({
    business_id: params.businessId,
    appointment_id: params.appointmentId ?? null,
    notification_type: params.notificationType,
    notification_key: params.notificationKey,
  })
  if (error) throw error
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })
  try {
    const cronSecret = Deno.env.get("CRON_SECRET")?.trim()
    if (cronSecret) {
      const authHeader = req.headers.get("Authorization") ?? ""
      const expected = `Bearer ${cronSecret}`
      if (authHeader !== expected) return json({ success: false, error: "Unauthorized" }, 401)
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ success: false, error: "Missing Supabase env" }, 500)
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const now = new Date()
    const todayIso = now.toISOString().slice(0, 10)
    const hour = now.getHours()
    const minute = now.getMinutes()

    const { data: businesses, error: businessErr } = await supabase
      .from("businesses")
      .select(
        "id,name,telegram_enabled,telegram_chat_id,telegram_morning_summary_enabled,telegram_night_summary_enabled,telegram_reminder_30min_enabled,telegram_new_appointment_enabled",
      )
      .eq("telegram_enabled", true)

    if (businessErr) throw businessErr

    let sent = 0
    let skipped = 0
    const errors: string[] = []
    const bizRows = (businesses ?? []) as BusinessSettings[]
    console.log("[telegram-debug] businesses with telegram_enabled=true:", bizRows.length)

    for (const biz of bizRows) {
      const chatId = (biz.telegram_chat_id ?? "").trim()
      console.log("[telegram-debug] business row:", {
        business_id: biz.id,
        business_name: biz.name,
        telegram_enabled: biz.telegram_enabled,
        telegram_chat_id_loaded: chatId || "(empty)",
        telegram_new_appointment_enabled: biz.telegram_new_appointment_enabled,
      })
      if (!chatId) {
        console.log("[telegram-debug] skip business: empty telegram_chat_id", { business_id: biz.id })
        skipped += 1
        continue
      }

      try {
        if (biz.telegram_new_appointment_enabled) {
          console.log("[telegram-debug] new_appointment: branch entered for business", biz.id)
          const since = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
          console.log("[telegram-debug] new_appointment: querying appointments created since", since)
          const { data: recentAppointments, error: appErr } = await supabase
            .from("appointments_jobs")
            .select("id,business_id,customer_id,assigned_user_id,service_id,scheduled_date,start_time,end_time,status,created_at")
            .eq("business_id", biz.id)
            .gte("created_at", since)
            .order("created_at", { ascending: true })
          if (appErr) throw appErr

          const apps = (recentAppointments ?? []) as AppointmentRow[]
          console.log("[telegram-debug] new_appointment: recent appointments in window count:", apps.length)
          for (const a of apps) {
            const logKey = `new_appointment:${a.id}`
            const alreadySent = await hasLog(supabase, biz.id, logKey)
            if (alreadySent) {
              console.log("[telegram-debug] new_appointment: skip (already logged)", {
                appointment_id: a.id,
                logKey,
              })
              continue
            }
            console.log("[telegram-debug] new_appointment: processing candidate", {
              appointment_id: a.id,
              created_at: a.created_at,
              logKey,
            })

            const [{ data: customer }, { data: service }, { data: assignedUser }] = await Promise.all([
              supabase.from("customers").select("first_name,last_name").eq("id", a.customer_id).maybeSingle(),
              a.service_id ? supabase.from("services").select("name").eq("id", a.service_id).maybeSingle() : Promise.resolve({ data: null }),
              a.assigned_user_id
                ? supabase.from("users").select("full_name").eq("id", a.assigned_user_id).maybeSingle()
                : Promise.resolve({ data: null }),
            ])

            const customerName = customer ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() : "—"
            const message = [
              "📅 Νέο ραντεβού",
              `Πελάτης: ${customerName || "—"}`,
              `Υπηρεσία: ${service?.name ?? "—"}`,
              `Ημερομηνία: ${formatGreekDate(a.scheduled_date)}`,
              `Ώρα: ${toReadableTime(a.start_time)}`,
              assignedUser?.full_name ? `Υπεύθυνος: ${assignedUser.full_name}` : "",
            ]
              .filter(Boolean)
              .join("\n")

            console.log("[telegram-debug] new_appointment: calling sendTelegramMessage", {
              chat_id: chatId,
              appointment_id: a.id,
            })
            try {
              await sendTelegramMessage(chatId, message)
              console.log("[telegram-debug] new_appointment: sendTelegramMessage completed without throw", {
                appointment_id: a.id,
              })
            } catch (sendErr) {
              console.error("[telegram-debug] new_appointment: sendTelegramMessage threw", {
                appointment_id: a.id,
                error: sendErr instanceof Error ? sendErr.message : String(sendErr),
                stack: sendErr instanceof Error ? sendErr.stack : undefined,
              })
              throw sendErr
            }
            await insertLog(supabase, {
              businessId: biz.id,
              appointmentId: a.id,
              notificationType: "new_appointment",
              notificationKey: logKey,
            })
            sent += 1
          }
        } else {
          console.log("[telegram-debug] new_appointment: branch skipped (telegram_new_appointment_enabled is false)", {
            business_id: biz.id,
          })
        }

        if (biz.telegram_reminder_30min_enabled) {
          const { data: todayAppointments, error: remindersErr } = await supabase
            .from("appointments_jobs")
            .select("id,business_id,customer_id,assigned_user_id,service_id,scheduled_date,start_time,end_time,status,created_at")
            .eq("business_id", biz.id)
            .eq("scheduled_date", todayIso)
            .in("status", ["pending", "confirmed", "in_progress", "rescheduled"])
          if (remindersErr) throw remindersErr

          const apps = (todayAppointments ?? []) as AppointmentRow[]
          for (const a of apps) {
            const startAt = buildDateTimeLocal(a.scheduled_date, parseTimeHHMM(a.start_time))
            const diffMs = startAt.getTime() - now.getTime()
            if (diffMs < 29 * 60 * 1000 || diffMs > 31 * 60 * 1000) continue

            const logKey = `reminder_30m:${a.id}:${a.scheduled_date}:${parseTimeHHMM(a.start_time)}`
            if (await hasLog(supabase, biz.id, logKey)) continue

            const [{ data: customer }, { data: service }] = await Promise.all([
              supabase.from("customers").select("first_name,last_name").eq("id", a.customer_id).maybeSingle(),
              a.service_id ? supabase.from("services").select("name").eq("id", a.service_id).maybeSingle() : Promise.resolve({ data: null }),
            ])

            const customerName = customer ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() : "—"
            const message = [
              "⏰ Υπενθύμιση ραντεβού σε 30 λεπτά",
              `Πελάτης: ${customerName || "—"}`,
              `Υπηρεσία: ${service?.name ?? "—"}`,
              `Ώρα: ${toReadableTime(a.start_time)}`,
            ].join("\n")

            await sendTelegramMessage(chatId, message)
            await insertLog(supabase, {
              businessId: biz.id,
              appointmentId: a.id,
              notificationType: "reminder_30m",
              notificationKey: logKey,
            })
            sent += 1
          }
        }

        if (biz.telegram_morning_summary_enabled && hour === 8 && minute < 5) {
          const logKey = `morning_summary:${todayIso}`
          if (!(await hasLog(supabase, biz.id, logKey))) {
            const { data: appointments, error: summaryErr } = await supabase
              .from("appointments_jobs")
              .select("id,start_time")
              .eq("business_id", biz.id)
              .eq("scheduled_date", todayIso)
              .order("start_time", { ascending: true })
            if (summaryErr) throw summaryErr

            const rows = (appointments ?? []) as Array<{ id: string; start_time: string }>
            const count = rows.length
            const first = count > 0 ? toReadableTime(rows[0].start_time) : "-"
            const last = count > 0 ? toReadableTime(rows[count - 1].start_time) : "-"
            const message = [
              "☀️ Καλημέρα",
              `Σήμερα έχεις ${count} ραντεβού.`,
              `Πρώτο: ${first}`,
              `Τελευταίο: ${last}`,
            ].join("\n")

            await sendTelegramMessage(chatId, message)
            await insertLog(supabase, {
              businessId: biz.id,
              notificationType: "morning_summary",
              notificationKey: logKey,
            })
            sent += 1
          }
        }

        if (biz.telegram_night_summary_enabled && hour === 22 && minute < 5) {
          const logKey = `night_summary:${todayIso}`
          if (!(await hasLog(supabase, biz.id, logKey))) {
            const [{ data: appointments, error: nightErr }, { data: payments, error: paymentErr }] = await Promise.all([
              supabase
                .from("appointments_jobs")
                .select("id,status")
                .eq("business_id", biz.id)
                .eq("scheduled_date", todayIso),
              supabase
                .from("payments")
                .select("paid_amount")
                .eq("business_id", biz.id)
                .gte("created_at", `${todayIso}T00:00:00`)
                .lte("created_at", `${todayIso}T23:59:59`),
            ])
            if (nightErr) throw nightErr
            if (paymentErr) throw paymentErr

            const rows = (appointments ?? []) as Array<{ id: string; status: string }>
            const total = rows.length
            const completed = rows.filter((r) => r.status === "completed").length
            const canceled = rows.filter((r) => r.status === "cancelled" || r.status === "no_show").length
            const revenue = ((payments ?? []) as Array<{ paid_amount: number | null }>).reduce(
              (sum, p) => sum + Number(p.paid_amount ?? 0),
              0,
            )

            const message = [
              "🌙 Σύνοψη ημέρας",
              `Σύνολο ραντεβού: ${total}`,
              `Ολοκληρωμένα: ${completed}`,
              `Ακυρωμένα: ${canceled}`,
              `Έσοδα: ${revenue.toFixed(2)}€`,
              "Καλή ξεκούραση!",
            ].join("\n")

            await sendTelegramMessage(chatId, message)
            await insertLog(supabase, {
              businessId: biz.id,
              notificationType: "night_summary",
              notificationKey: logKey,
            })
            sent += 1
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error("[telegram-debug] per-business handler error", {
          business_id: biz.id,
          error: msg,
          stack: err instanceof Error ? err.stack : undefined,
        })
        errors.push(`${biz.id}: ${msg}`)
      }
    }

    return json({ success: true, sent, skipped, businesses: bizRows.length, errors }, 200)
  } catch (err) {
    console.error("[telegram-debug] top-level handler error", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return json({ success: false, error: err instanceof Error ? err.message : "Error" }, 500)
  }
})
