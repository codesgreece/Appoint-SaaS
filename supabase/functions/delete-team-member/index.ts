// Delete a team member (auth + public.users) — admin/super_admin only.
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
      .select("id, role, business_id")
      .eq("id", authUser.id)
      .maybeSingle()
    if (callerErr || !caller) return json({ success: false, error: "Forbidden" }, 403)
    if (!["admin", "super_admin"].includes(caller.role)) return json({ success: false, error: "Forbidden" }, 403)
    // admin must belong to a business; super_admin may have null business_id
    if (caller.role === "admin" && !caller.business_id) return json({ success: false, error: "Forbidden" }, 403)

    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return json({ success: false, error: "Invalid JSON" }, 400)
    }
    const user_id = typeof body.user_id === "string" ? body.user_id.trim() : ""
    if (!user_id) return json({ success: false, error: "user_id required" }, 400)
    if (user_id === caller.id) return json({ success: false, error: "Cannot delete your own account" }, 400)

    const { data: target, error: targetErr } = await supabase
      .from("users")
      .select("id, role, business_id")
      .eq("id", user_id)
      .maybeSingle()
    if (targetErr || !target) return json({ success: false, error: "User not found" }, 404)
    if (target.role === "super_admin") return json({ success: false, error: "Cannot delete super_admin" }, 403)
    // super_admin can delete any user; admin only within same business
    if (caller.role !== "super_admin" && target.business_id !== caller.business_id) return json({ success: false, error: "Forbidden" }, 403)

    // Delete profile row first
    const { error: profileDelErr } = await supabase.from("users").delete().eq("id", user_id)
    if (profileDelErr) return json({ success: false, error: profileDelErr.message }, 400)

    const { error: authDelErr } = await supabase.auth.admin.deleteUser(user_id)
    if (authDelErr) return json({ success: false, error: authDelErr.message }, 400)

    return json({ success: true }, 200)
  } catch (err) {
    return json({ success: false, error: err instanceof Error ? err.message : "Error" }, 500)
  }
})

