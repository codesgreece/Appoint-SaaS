import React, { createContext, useContext, useEffect, useState } from "react"
import { User as SupabaseUser } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import type { User } from "@/types"

interface AuthState {
  supabaseUser: SupabaseUser | null
  user: User | null
  businessId: string | null
  businessName: string | null
  loading: boolean
  bootstrapError: string | null
}

const AuthContext = createContext<
  AuthState & { signOut: () => Promise<void>; retryBootstrap: () => Promise<void> }
  | null
>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadBusinessName() {
      if (!businessId) {
        setBusinessName(null)
        return
      }
      const { data, error } = await supabase
        .from("businesses")
        .select("name")
        .eq("id", businessId)
        .maybeSingle()
      if (cancelled) return
      if (error || !data) {
        setBusinessName(null)
        return
      }
      setBusinessName((data as { name?: string | null }).name ?? null)
    }
    loadBusinessName()
    return () => { cancelled = true }
  }, [businessId])

  useEffect(() => {
    console.log("[Auth] start bootstrap")
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("[Auth] session loaded", { hasSession: Boolean(session) })
      setSupabaseUser(session?.user ?? null)
      if (session?.user) {
        setLoading(true)
        setBootstrapError(null)
        fetchUserProfileWithTimeout(session.user.id)
          .then((profile) => {
            if (!profile) console.log("[Auth] profile missing")
            else console.log("[Auth] profile loaded", { role: profile.role, hasBusiness: Boolean(profile.business_id) })
            setUser(profile)
            setBusinessId(profile?.business_id ?? null)
          })
          .catch((e) => {
            console.log("[Auth] profile load error", e)
            setUser(null)
            setBusinessId(null)
            setBusinessName(null)
            setBootstrapError(e instanceof Error ? e.message : "Αποτυχία φόρτωσης προφίλ.")
          })
          .finally(() => {
            console.log("[Auth] bootstrap finished")
            setLoading(false)
          })
      } else {
        setUser(null)
        setBusinessId(null)
        setBusinessName(null)
        setBootstrapError(null)
        console.log("[Auth] bootstrap finished")
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseUser(session?.user ?? null)
      if (session?.user) {
        setLoading(true)
        setBootstrapError(null)
        console.log("[Auth] session changed; loading profile")
        fetchUserProfileWithTimeout(session.user.id)
          .then((profile) => {
            if (!profile) console.log("[Auth] profile missing")
            else console.log("[Auth] profile loaded", { role: profile.role, hasBusiness: Boolean(profile.business_id) })
            setUser(profile)
            setBusinessId(profile?.business_id ?? null)
          })
          .catch((e) => {
            console.log("[Auth] profile load error", e)
            setUser(null)
            setBusinessId(null)
            setBusinessName(null)
            setBootstrapError(e instanceof Error ? e.message : "Αποτυχία φόρτωσης προφίλ.")
          })
          .finally(() => {
            console.log("[Auth] bootstrap finished")
            setLoading(false)
          })
      } else {
        setUser(null)
        setBusinessId(null)
        setBusinessName(null)
        setBootstrapError(null)
        console.log("[Auth] signed out; bootstrap finished")
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchUserProfile(authId: string): Promise<User | null> {
    console.log("[Auth] auth user id", authId)
    console.log("[Auth] loading public.users row", { id: authId })
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", authId)
      .maybeSingle()
    if (error) {
      const printable = {
        message: error.message,
        details: (error as unknown as { details?: string }).details,
        hint: (error as unknown as { hint?: string }).hint,
        code: (error as unknown as { code?: string }).code,
      }
      console.log("[Auth] RLS/profile query error", printable)
      throw new Error(`Profile query failed: ${JSON.stringify(printable)}`)
    }
    if (!data) {
      console.log("[Auth] profile missing", { id: authId })
      return null
    }
    console.log("[Auth] profile found", { id: authId })
    return data as User
  }

  async function fetchUserProfileWithTimeout(authId: string): Promise<User | null> {
    const timeoutMs = 8000
    return await Promise.race([
      fetchUserProfile(authId),
      new Promise<User | null>((_resolve, reject) =>
        setTimeout(() => reject(new Error("Timeout φόρτωσης προφίλ (8s).")), timeoutMs),
      ),
    ])
  }

  async function retryBootstrap() {
    console.log("[Auth] retry bootstrap")
    setLoading(true)
    setBootstrapError(null)
    const { data: { session } } = await supabase.auth.getSession()
    setSupabaseUser(session?.user ?? null)
    if (!session?.user) {
      setUser(null)
      setBusinessId(null)
      setLoading(false)
      return
    }
    try {
      const profile = await fetchUserProfileWithTimeout(session.user.id)
      if (!profile) console.log("[Auth] profile missing")
      else console.log("[Auth] profile loaded", { role: profile.role, hasBusiness: Boolean(profile.business_id) })
      setUser(profile)
      setBusinessId(profile?.business_id ?? null)
    } catch (e) {
      console.log("[Auth] profile load error", e)
      setUser(null)
      setBusinessId(null)
      setBusinessName(null)
      setBootstrapError(e instanceof Error ? e.message : "Αποτυχία φόρτωσης προφίλ.")
    } finally {
      console.log("[Auth] bootstrap finished")
      setLoading(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setBusinessId(null)
    setBusinessName(null)
    setBootstrapError(null)
  }

  return (
    <AuthContext.Provider
      value={{
        supabaseUser,
        user,
        businessId,
        businessName,
        loading,
        bootstrapError,
        signOut,
        retryBootstrap,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
