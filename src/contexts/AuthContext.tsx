import React, { createContext, useContext, useEffect, useRef, useState } from "react"
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
  /** Για tenant: πλάνο επιχείρησης (unsubscribed = κλειδωμένο panel). */
  tenantSubscriptionPlan: string | null
  tenantSubscriptionExpiresAt: string | null
  tenantSubscriptionLoaded: boolean
}

const AuthContext = createContext<
  AuthState & {
    signOut: () => Promise<void>
    retryBootstrap: () => Promise<void>
    refreshTenantBusiness: () => Promise<void>
  }
  | null
>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const [tenantSubscriptionPlan, setTenantSubscriptionPlan] = useState<string | null>(null)
  const [tenantSubscriptionExpiresAt, setTenantSubscriptionExpiresAt] = useState<string | null>(null)
  const [tenantSubscriptionLoaded, setTenantSubscriptionLoaded] = useState(true)

  /** Auth user id για τον οποίο έχει ήδη φορτωθεί προφίλ — αποφυγή διπλού SIGNED_IN (καρτέλα/εστίαση) που έκανε refresh και χάνονταν panel/forms. */
  const resolvedSessionUserIdRef = useRef<string | null>(null)

  const refreshTenantBusiness = React.useCallback(async () => {
    const bid = businessId
    const role = user?.role
    if (!bid) {
      setBusinessName(null)
      setTenantSubscriptionPlan(null)
      setTenantSubscriptionExpiresAt(null)
      setTenantSubscriptionLoaded(true)
      return
    }
    if (role === "super_admin") {
      const { data } = await supabase.from("businesses").select("name").eq("id", bid).maybeSingle()
      setBusinessName((data as { name?: string | null } | null)?.name ?? null)
      return
    }
    const { data } = await supabase
      .from("businesses")
      .select("name, subscription_plan, subscription_expires_at")
      .eq("id", bid)
      .maybeSingle()
    const row = data as {
      name?: string | null
      subscription_plan?: string | null
      subscription_expires_at?: string | null
    } | null
    setBusinessName(row?.name ?? null)
    setTenantSubscriptionPlan(row?.subscription_plan ?? null)
    setTenantSubscriptionExpiresAt(row?.subscription_expires_at ?? null)
    setTenantSubscriptionLoaded(true)
  }, [businessId, user?.role])

  useEffect(() => {
    let cancelled = false
    if (!businessId) {
      setBusinessName(null)
      setTenantSubscriptionPlan(null)
      setTenantSubscriptionExpiresAt(null)
      setTenantSubscriptionLoaded(true)
      return
    }
    if (user?.role === "super_admin") {
      setTenantSubscriptionPlan(null)
      setTenantSubscriptionExpiresAt(null)
      setTenantSubscriptionLoaded(true)
      ;(async () => {
        const { data } = await supabase.from("businesses").select("name").eq("id", businessId).maybeSingle()
        if (!cancelled) setBusinessName((data as { name?: string | null } | null)?.name ?? null)
      })()
      return () => {
        cancelled = true
      }
    }
    setTenantSubscriptionLoaded(false)
    ;(async () => {
      const { data } = await supabase
        .from("businesses")
        .select("name, subscription_plan, subscription_expires_at")
        .eq("id", businessId)
        .maybeSingle()
      if (cancelled) return
      const row = data as {
        name?: string | null
        subscription_plan?: string | null
        subscription_expires_at?: string | null
      } | null
      setBusinessName(row?.name ?? null)
      setTenantSubscriptionPlan(row?.subscription_plan ?? null)
      setTenantSubscriptionExpiresAt(row?.subscription_expires_at ?? null)
      setTenantSubscriptionLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [businessId, user?.role])

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
            resolvedSessionUserIdRef.current = profile?.id ?? null
          })
          .catch((e) => {
            console.log("[Auth] profile load error", e)
            setUser(null)
            setBusinessId(null)
            setBusinessName(null)
            resolvedSessionUserIdRef.current = null
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
        resolvedSessionUserIdRef.current = null
        console.log("[Auth] bootstrap finished")
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSupabaseUser(session?.user ?? null)

      // Ανανέωση token όταν επιστρέφεις σε καρτέλα/παράθυρο — χωρίς spinner & χωρίς ξαναφόρτωση προφίλ (αλλιώς χάνονται tabs/scroll).
      if (event === "TOKEN_REFRESHED") {
        return
      }

      // Το αρχικό session ήδη χειρίζεται το getSession() παραπάνω — αποφυγή διπλού fetch & flash loading.
      if (event === "INITIAL_SESSION") {
        return
      }

      // Σε μερικά περιβάλλοντα το SIGNED_IN ξαναπυροδοτείται (εστίαση παραθύρου / καρτέλα) χωρίς νέο login.
      if (
        event === "SIGNED_IN" &&
        session?.user &&
        resolvedSessionUserIdRef.current === session.user.id
      ) {
        console.log("[Auth] skip duplicate SIGNED_IN for same user (preserve panel state)")
        return
      }

      if (session?.user) {
        // USER_UPDATED: αθόρυβη ανανέωση προφίλ (χωρίς να ξεφορτώσει όλη τη σελίδα)
        const silentProfileRefresh = event === "USER_UPDATED"
        if (!silentProfileRefresh) {
          setLoading(true)
        }
        setBootstrapError(null)
        console.log("[Auth] session changed; loading profile", { event, silent: silentProfileRefresh })
        fetchUserProfileWithTimeout(session.user.id)
          .then((profile) => {
            if (!profile) console.log("[Auth] profile missing")
            else console.log("[Auth] profile loaded", { role: profile.role, hasBusiness: Boolean(profile.business_id) })
            setUser(profile)
            setBusinessId(profile?.business_id ?? null)
            resolvedSessionUserIdRef.current = profile?.id ?? null
          })
          .catch((e) => {
            console.log("[Auth] profile load error", e)
            setUser(null)
            setBusinessId(null)
            setBusinessName(null)
            resolvedSessionUserIdRef.current = null
            setBootstrapError(e instanceof Error ? e.message : "Αποτυχία φόρτωσης προφίλ.")
          })
          .finally(() => {
            console.log("[Auth] bootstrap finished")
            if (!silentProfileRefresh) {
              setLoading(false)
            }
          })
      } else {
        setUser(null)
        setBusinessId(null)
        setBusinessName(null)
        setBootstrapError(null)
        resolvedSessionUserIdRef.current = null
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
      resolvedSessionUserIdRef.current = null
      setLoading(false)
      return
    }
    try {
      const profile = await fetchUserProfileWithTimeout(session.user.id)
      if (!profile) console.log("[Auth] profile missing")
      else console.log("[Auth] profile loaded", { role: profile.role, hasBusiness: Boolean(profile.business_id) })
      setUser(profile)
      setBusinessId(profile?.business_id ?? null)
      resolvedSessionUserIdRef.current = profile?.id ?? null
    } catch (e) {
      console.log("[Auth] profile load error", e)
      setUser(null)
      setBusinessId(null)
      setBusinessName(null)
      resolvedSessionUserIdRef.current = null
      setBootstrapError(e instanceof Error ? e.message : "Αποτυχία φόρτωσης προφίλ.")
    } finally {
      console.log("[Auth] bootstrap finished")
      setLoading(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    resolvedSessionUserIdRef.current = null
    setUser(null)
    setBusinessId(null)
    setBusinessName(null)
    setBootstrapError(null)
    setTenantSubscriptionPlan(null)
    setTenantSubscriptionExpiresAt(null)
    setTenantSubscriptionLoaded(true)
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
        tenantSubscriptionPlan,
        tenantSubscriptionExpiresAt,
        tenantSubscriptionLoaded,
        signOut,
        retryBootstrap,
        refreshTenantBusiness,
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
