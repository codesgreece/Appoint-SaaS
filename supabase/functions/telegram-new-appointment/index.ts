/**
 * TEMPORARY DEBUG ONLY — revert to real implementation before production.
 * - No auth, no DB, no business logic.
 * - Every POST sends a fixed test message to a hardcoded chat_id.
 * - While deployed: appointment/booking callers also hit this (test only).
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")?.trim() ?? ""
  if (!botToken) {
    return new Response(JSON.stringify({ error: "TELEGRAM_BOT_TOKEN not set in Edge secrets" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const TEST_CHAT_ID = 1603616406
  const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TEST_CHAT_ID,
      text: "TEST TELEGRAM OK",
    }),
  })

  const raw = await tgRes.text()
  return new Response(raw, {
    status: tgRes.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
})
