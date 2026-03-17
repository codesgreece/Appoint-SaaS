// Delete a business user (auth + public.users) — super_admin only.
// Body: { user_id }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })
  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return json({ success: false, error: "Missing Authorization" }, 401)
    const jwt = authHeader.replace("Bearer ", "").trim()

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(jwt)
    if (authError || !authUser) return json({ success: false, error: authError?.message ?? "Invalid token" }, 401)

    const { data: caller, error: callerErr } = await supabase
      .from("users")
      .select("role")
      .eq("id", authUser.id)
      .maybeSingle()
    if (callerErr || !caller || caller.role !== "super_admin") return json({ success: false, error: "Forbidden" }, 403)

    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return json({ success: false, error: "Invalid JSON" }, 400)
    }

    const user_id = typeof body.user_id === "string" ? body.user_id.trim() : ""
    if (!user_id) return json({ success: false, error: "user_id required" }, 400)

    // Delete profile row first (to avoid leaving stale app data if auth deletion succeeds)
    const { error: profileDelErr } = await supabase.from("users").delete().eq("id", user_id)
    if (profileDelErr) return json({ success: false, error: profileDelErr.message }, 400)

    const { error: authDelErr } = await supabase.auth.admin.deleteUser(user_id)
    if (authDelErr) return json({ success: false, error: authDelErr.message }, 400)

    return json({ success: true }, 200)
  } catch (err) {
    return json({ success: false, error: err instanceof Error ? err.message : "Error" }, 500)
  }
})

