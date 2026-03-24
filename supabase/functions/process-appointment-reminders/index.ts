const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

/** No-op: κρατιέται για συμβατότητα αν υπάρχει cron που καλούσε αυτό το endpoint. */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })
  try {
    const cronSecret = Deno.env.get("CRON_SECRET")?.trim()
    if (cronSecret) {
      const authHeader = req.headers.get("Authorization") ?? ""
      const expected = `Bearer ${cronSecret}`
      if (authHeader !== expected) {
        return json({ success: false, error: "Unauthorized" }, 401)
      }
    }

    return json({ success: true, sent: 0, skipped: 0, message: "noop" }, 200)
  } catch (err) {
    return json({ success: false, error: err instanceof Error ? err.message : "Error" }, 500)
  }
})
