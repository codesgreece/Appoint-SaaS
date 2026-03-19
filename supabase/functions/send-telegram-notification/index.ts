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
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return json({ success: false, error: "Missing Authorization" }, 401)
    const jwt = authHeader.replace("Bearer ", "").trim()

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const fallbackToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? ""
    if (!supabaseUrl || !serviceRoleKey) return json({ success: false, error: "Missing supabase env" }, 500)

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: authData, error: authError } = await supabase.auth.getUser(jwt)
    if (authError || !authData?.user) return json({ success: false, error: "Invalid token" }, 401)
    const callerId = authData.user.id

    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return json({ success: false, error: "Invalid JSON" }, 400)
    }

    const businessId = typeof body.business_id === "string" ? body.business_id.trim() : ""
    const message = typeof body.message === "string" ? body.message.trim() : ""
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

    const enabled = Boolean((biz as { telegram_enabled?: boolean | null }).telegram_enabled)
    const chatId = ((biz as { telegram_chat_id?: string | null }).telegram_chat_id ?? "").trim()
    const bizToken = ((biz as { telegram_bot_token?: string | null }).telegram_bot_token ?? "").trim()
    const token = bizToken || fallbackToken

    if (!enabled) return json({ success: true, skipped: true, reason: "telegram_disabled" }, 200)
    if (!chatId) return json({ success: true, skipped: true, reason: "missing_chat_id" }, 200)
    if (!token) return json({ success: false, error: "Missing Telegram token" }, 400)

    await sendTelegram(token, chatId, message)
    return json({ success: true }, 200)
  } catch (err) {
    return json({ success: false, error: err instanceof Error ? err.message : "Error" }, 500)
  }
})

