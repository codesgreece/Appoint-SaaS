// Create Business with First Admin — single Edge Function.
// No signUp, no confirmation email. Admin API only for auth user.
// Body: { business: {...}, admin: { full_name, username, password } }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // STEP 1: Authorize caller — only super_admin
    console.log("STEP 1 authorize")
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return json({ success: false, error: "Missing Authorization header" }, 401)
    }
    const jwt = authHeader.replace("Bearer ", "").trim()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(jwt)
    if (authError || !authUser) {
      return json({ success: false, error: authError?.message ?? "Invalid or expired token" }, 401)
    }
    const { data: callerProfile, error: profileError } = await supabase
      .from("users")
      .select("role")
      .eq("id", authUser.id)
      .maybeSingle()
    if (profileError || !callerProfile || callerProfile.role !== "super_admin") {
      return json({ success: false, error: "Only super_admin can create businesses" }, 403)
    }

    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return json({ success: false, error: "Invalid or missing JSON body" }, 400)
    }
    const business = (body.business as Record<string, unknown>) ?? {}
    const adminPayload = (body.admin as Record<string, unknown>) ?? {}
    const full_name = typeof adminPayload.full_name === "string" ? adminPayload.full_name.trim() : ""
    const username = typeof adminPayload.username === "string" ? adminPayload.username.trim().toLowerCase() : ""
    const password = typeof adminPayload.password === "string" ? adminPayload.password : ""
    if (!business.name || !full_name || !username || !password) {
      return json({
        success: false,
        error: "Missing required fields: business.name, admin.full_name, admin.username, admin.password",
      }, 400)
    }
    if (!/^[a-z0-9_-]+$/.test(username)) {
      return json({ success: false, error: "Username allows only lowercase letters, numbers, underscore and hyphen." }, 400)
    }

    // STEP 2: Insert business into public.businesses
    console.log("STEP 2 create business")
    const { data: businessRow, error: businessError } = await supabase
      .from("businesses")
      .insert({
        name: business.name,
        business_type: business.business_type ?? null,
        phone: business.phone ?? null,
        email: business.email ?? null,
        address: business.address ?? null,
        subscription_plan: business.subscription_plan ?? "starter",
        subscription_status: business.subscription_status ?? "active",
        max_users: business.max_users ?? 5,
        max_customers: business.max_customers ?? 500,
        max_appointments: business.max_appointments ?? 1000,
      })
      .select()
      .single()
    if (businessError || !businessRow) {
      return json({
        success: false,
        error: businessError?.message ?? "Failed to create business",
      }, 400)
    }
    const businessId = (businessRow as { id: string }).id

    const generatedInternalEmail = `${username}_${Date.now()}@internal.app`

    // STEP 3: Create auth user with Admin API
    console.log("STEP 3 create auth user")
    const { data: newAdmin, error: createAuthError } = await supabase.auth.admin.createUser({
      email: generatedInternalEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name, username },
    })
    if (createAuthError || !newAdmin?.user) {
      return json({
        success: false,
        error: createAuthError?.message ?? "Failed to create auth user for admin",
      }, 400)
    }

    // STEP 4: Insert into public.users
    console.log("STEP 4 insert public.users")
    const { error: userInsertError } = await supabase.from("users").insert({
      id: newAdmin.user.id,
      business_id: businessId,
      full_name,
      username,
      email: generatedInternalEmail,
      role: "admin",
      status: "active",
    })
    if (userInsertError) {
      return json({
        success: false,
        error: "Business created but failed to create admin profile: " + userInsertError.message,
      }, 500)
    }

    return json({
      success: true,
      business: businessRow,
      admin_username: username,
    }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[create-business-with-admin] error", message, error)
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
