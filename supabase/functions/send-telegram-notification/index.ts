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

/** Το Telegram δέχεται chat_id ως ακέραιο για user/group/channel ids */
function normalizeChatIdForTelegram(raw: string): string | number {
  const t = raw.trim()
  if (!t) return t
  if (/^-?\d+$/.test(t)) {
    const n = Number(t)
    if (Number.isSafeInteger(n)) return n
  }
  return t
}

async function sendTelegram(token: string, chatId: string, text: string, replyMarkup?: unknown) {
  const endpoint = `https://api.telegram.org/bot${token}/sendMessage`
  const cid = normalizeChatIdForTelegram(chatId)
  const body: Record<string, unknown> = {
    chat_id: cid,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  }
  let res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    if ((detail.includes("parse") || detail.includes("entities")) && res.status === 400) {
      res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: cid,
          text: text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
          disable_web_page_preview: true,
          ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        }),
      })
      if (!res.ok) {
        const d2 = await res.text().catch(() => "")
        throw new Error(`Telegram API error (${res.status})${d2 ? `: ${d2}` : ""}`)
      }
    } else {
      throw new Error(`Telegram API error (${res.status})${detail ? `: ${detail}` : ""}`)
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })
  try {
    const authHeader = req.headers.get("Authorization")?.trim() ?? ""
    if (!authHeader) return json({ success: false, error: "Missing Authorization" }, 401)

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const fallbackToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? ""
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ success: false, error: "Missing supabase env (URL, ANON_KEY, or SERVICE_ROLE)" }, 500)
    }

    // Υποχρεωτικά `Bearer <access_token>` — επαλήθευση με anon client + ίδιο header (όχι getUser(jwt) με service role → «invalid JWT»).
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser()
    if (authError || !authData?.user) {
      return json(
        {
          success: false,
          error: authError?.message ?? "Μη έγκυρο session. Κάνε αποσύνδεση και ξανά σύνδεση.",
        },
        401,
      )
    }
    const callerId = authData.user.id

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return json({ success: false, error: "Invalid JSON" }, 400)
    }

    const businessId = typeof body.business_id === "string" ? body.business_id.trim() : ""
    const message = typeof body.message === "string" ? body.message.trim() : ""
    const replyMarkup = body.reply_markup
    /** Από φόρμα (π.χ. «Δοκιμή») χωρίς να έχει γίνει αποθήκευση στη βάση ακόμα */
    const useFormValues = body.use_form_values === true

    if (!businessId || !message) {
      return json({ success: false, error: "Missing business_id or message" }, 400)
    }

    const { data: caller, error: callerErr } = await supabase
      .from("users")
      .select("id, role, business_id")
      .eq("id", callerId)
      .maybeSingle()
    if (callerErr || !caller) return json({ success: false, error: "Forbidden" }, 403)

    const isSuper = caller.role === "super_admin"
    if (!isSuper && caller.business_id !== businessId) {
      return json({ success: false, error: "Forbidden for this business." }, 403)
    }

    const { data: biz, error: bizErr } = await supabase
      .from("businesses")
      .select("telegram_enabled, telegram_chat_id, telegram_bot_token")
      .eq("id", businessId)
      .maybeSingle()
    if (bizErr || !biz) return json({ success: false, error: "Business not found." }, 404)

    let enabled = Boolean((biz as { telegram_enabled?: boolean | null }).telegram_enabled)
    let chatId = ((biz as { telegram_chat_id?: string | null }).telegram_chat_id ?? "").trim()
    let bizToken = ((biz as { telegram_bot_token?: string | null }).telegram_bot_token ?? "").trim()

    if (useFormValues) {
      enabled = Boolean(body.telegram_enabled)
      if (typeof body.telegram_chat_id === "string") {
        chatId = body.telegram_chat_id.trim()
      }
      if (typeof body.telegram_bot_token === "string") {
        bizToken = body.telegram_bot_token.trim()
      }
    }

    const token = bizToken || fallbackToken

    if (!enabled) return json({ success: true, skipped: true, reason: "telegram_disabled" }, 200)
    if (!chatId) return json({ success: true, skipped: true, reason: "missing_chat_id" }, 200)
    if (!token) {
      return json(
        {
          success: false,
          error:
            "Λείπει Telegram Bot Token. Συμπλήρωσέ το παραπάνω ή βάλε TELEGRAM_BOT_TOKEN στα secrets του project (Edge Functions).",
        },
        400,
      )
    }

    await sendTelegram(token, chatId, message, replyMarkup)
    return json({ success: true }, 200)
  } catch (err) {
    return json({ success: false, error: err instanceof Error ? err.message : "Error" }, 500)
  }
})

