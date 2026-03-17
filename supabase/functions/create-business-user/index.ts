// Create Business User (admin) — confirmed auth user + public.users row.
// Body: { business_id, full_name, username, password }
// Returns: { success, user_id, email, username }
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

    // Authorize caller: super_admin only
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

    const business_id = typeof body.business_id === "string" ? body.business_id : ""
    const full_name = typeof body.full_name === "string" ? body.full_name.trim() : ""
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : ""
    const password = typeof body.password === "string" ? body.password : ""

    if (!business_id || !full_name || !username || !password) {
      return json({ success: false, error: "Missing fields: business_id, full_name, username, password" }, 400)
    }
    if (!/^[a-z0-9_-]+$/.test(username)) {
      return json({ success: false, error: "Invalid username format" }, 400)
    }

    // Supabase Auth requires an email for password auth. We generate one automatically;
    // users never see or type an email in the product UX.
    const email = `${username}@internal.app`

    // Create confirmed auth user (no email confirmation required)
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, username },
    })
    if (createErr || !created?.user) {
      return json({ success: false, error: createErr?.message ?? "Failed to create auth user" }, 400)
    }

    const newUserId = created.user.id

    // Insert profile row (service role bypasses RLS)
    const { error: profileErr } = await supabase.from("users").insert({
      id: newUserId,
      business_id,
      full_name,
      username,
      email,
      role: "admin",
      status: "active",
    })

    if (profileErr) {
      // Rollback: delete auth user if profile insert fails
      await supabase.auth.admin.deleteUser(newUserId)
      return json({ success: false, error: profileErr.message }, 400)
    }

    return json({ success: true, user_id: newUserId, email, username }, 200)
  } catch (err) {
    return json({ success: false, error: err instanceof Error ? err.message : "Error" }, 500)
  }
})

