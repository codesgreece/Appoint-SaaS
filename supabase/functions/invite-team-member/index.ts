// Supabase Edge Function: create team member for a business (admin only)
// Requires: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// Body: { username, full_name, role, password } where role is admin | employee | reception
// - We do NOT ask for email in the UI; auth email is generated internally from username.
// Authorization: Bearer <user JWT>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function randomPassword(length = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  let s = ""
  for (let i = 0; i < length; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders })

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase environment configuration on server." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }
    const jwt = authHeader.replace("Bearer ", "")

    const anonClient = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user: caller } } = await anonClient.auth.getUser(jwt)
    if (!caller) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: callerProfile } = await adminClient
      .from("users")
      .select("business_id, role")
      .eq("id", caller.id)
      .single()

    if (!callerProfile || !callerProfile.business_id) {
      return new Response(JSON.stringify({ error: "User not found or not linked to business" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    const allowedRoles = ["admin", "super_admin"]
    if (!allowedRoles.includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: "Only admin can add team members" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const body = await req.json()
    const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : ""
    const full_name = typeof body?.full_name === "string" ? body.full_name.trim() : ""
    const role = typeof body?.role === "string" ? body.role : "employee"
    const password = typeof body?.password === "string" ? body.password : ""
    if (!username || !full_name) {
      return new Response(JSON.stringify({ error: "username and full_name required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    if (!/^[a-z0-9_-]+$/.test(username)) {
      return new Response(JSON.stringify({ error: "username invalid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    const validRoles = ["admin", "employee", "reception"]
    if (!validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: "role must be admin, employee, or reception" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    const email = `${username}@internal.app`

    const tempPassword = password || randomPassword(12)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name },
    })

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message || "Failed to create user" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    if (!newUser.user) {
      return new Response(JSON.stringify({ error: "User not created" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { error: insertError } = await adminClient.from("users").insert({
      id: newUser.user.id,
      business_id: callerProfile.business_id,
      full_name,
      email,
      username,
      role,
      status: "active",
    })

    if (insertError) {
      await adminClient.auth.admin.deleteUser(newUser.user.id)
      return new Response(
        JSON.stringify({ error: "User created but failed to add to team: " + insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: newUser.user.id,
        auth_email: email,
        username,
        temporary_password: password ? "" : tempPassword,
        message: "Share the temporary password with the new user securely. They should sign in and change it.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
