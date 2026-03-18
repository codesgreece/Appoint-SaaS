import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { MoreHorizontal, Building2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface BusinessRow {
  id: string
  name: string
  business_type: string | null
  phone: string | null
  email: string | null
  address: string | null
  subscription_plan: string | null
  subscription_status: string | null
  subscription_expires_at: string | null
  max_users: number | null
  max_customers: number | null
  max_appointments: number | null
  created_at: string
}

interface AdminInfo {
  username: string | null
  full_name: string
  email: string
  role: string
  status: string
}

interface TenantUser {
  id: string
  full_name: string
  username: string | null
  role: string
  status: string
  created_at: string
}

const initialBusinessForm = {
  name: "",
  business_type: "",
  phone: "",
  email: "",
  address: "",
  max_users: 10,
  max_customers: 2000,
  max_appointments: 10000,
}

type PlanKey = "unsubscribed" | "demo" | "starter" | "pro" | "premium" | "premium_plus"
type BillingCycle = "monthly" | "yearly"
type CreateBusinessType = "standard" | "demo" | "premium_plus"

const PLAN_LABEL: Record<PlanKey, string> = {
  unsubscribed: "Χωρίς συνδρομή (αγορά από πελάτη)",
  demo: "Demo (δοκιμαστικό)",
  starter: "Starter",
  pro: "Pro",
  premium: "Premium",
  premium_plus: "Premium+ (custom)",
}

export default function PlatformBusinesses() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [businesses, setBusinesses] = useState<BusinessRow[]>([])
  const [adminByBusinessId, setAdminByBusinessId] = useState<Record<string, AdminInfo>>({})
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [detailsBusinessId, setDetailsBusinessId] = useState<string | null>(null)
  const [detailsUsers, setDetailsUsers] = useState<TenantUser[]>([])
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [addAdminOpen, setAddAdminOpen] = useState(false)
  const [addAdminSubmitting, setAddAdminSubmitting] = useState(false)
  const [detailsExpiryDate, setDetailsExpiryDate] = useState("")
  const [updatingExpiry, setUpdatingExpiry] = useState(false)

  const [businessForm, setBusinessForm] = useState(initialBusinessForm)
  const [createType, setCreateType] = useState<CreateBusinessType>("standard")
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly")
  const [durationCount, setDurationCount] = useState(1)
  const [addAdminForm, setAddAdminForm] = useState({ full_name: "", username: "", password: "" })

  const loadBusinesses = useCallback(async () => {
    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .order("created_at", { ascending: false })
    if (error) throw error
    setBusinesses((data as BusinessRow[]) ?? [])
  }, [])

  const loadAdminUsernames = useCallback(async () => {
    const { data, error } = await supabase
      .from("users")
      .select("business_id, username, full_name, email, role, status, created_at")
      .eq("role", "admin")
      .order("created_at", { ascending: true })
    if (error) throw error
    const admins = (data ?? []) as Array<{
      business_id: string
      username: string | null
      full_name: string
      email: string
      role: string
      status: string
      created_at: string
    }>
    const byBusiness: Record<string, AdminInfo> = {}
    for (const a of admins) {
      if (!a.business_id || byBusiness[a.business_id]) continue
      byBusiness[a.business_id] = {
        username: a.username ?? null,
        full_name: a.full_name,
        email: a.email,
        role: a.role,
        status: a.status,
      }
    }
    setAdminByBusinessId(byBusiness)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        await loadBusinesses()
        await loadAdminUsernames()
      } catch (err) {
        if (!cancelled) {
          console.error("Load businesses error:", err)
          toast({ title: "Σφάλμα", description: "Αποτυχία φόρτωσης επιχειρήσεων.", variant: "destructive" })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [toast, loadBusinesses, loadAdminUsernames])

  useEffect(() => {
    if (!detailsBusinessId) {
      setDetailsUsers([])
      return
    }
    let cancelled = false
    async function loadUsers() {
      setDetailsLoading(true)
      try {
        const { data, error } = await supabase
          .from("users")
          .select("id, full_name, username, role, status, created_at")
          .eq("business_id", detailsBusinessId)
          .order("created_at", { ascending: true })
        if (error) throw error
        if (!cancelled) setDetailsUsers((data as TenantUser[]) ?? [])
      } finally {
        if (!cancelled) setDetailsLoading(false)
      }
    }
    loadUsers()
    return () => { cancelled = true }
  }, [detailsBusinessId])

  async function handleCreateBusiness() {
    if (user?.role !== "super_admin") {
      toast({ title: "Σφάλμα", description: "Μόνο super admin μπορεί να δημιουργήσει επιχείρηση.", variant: "destructive" })
      return
    }
    if (!businessForm.name.trim()) {
      toast({ title: "Σφάλμα", description: "Συμπληρώστε όνομα επιχείρησης.", variant: "destructive" })
      return
    }
    setCreating(true)
    const createTypeSnapshot = createType
    try {
      const now = new Date()
      const expires = new Date(now)
      if (billingCycle === "monthly") expires.setMonth(expires.getMonth() + Math.max(1, durationCount))
      else expires.setFullYear(expires.getFullYear() + Math.max(1, durationCount))

      let plan: PlanKey
      let maxUsers: number | null
      let maxCustomers: number | null
      let maxAppointments: number | null
      let subscription_status: string
      let subscription_started_at: string | null
      let subscription_expires_at: string | null

      if (createTypeSnapshot === "standard") {
        plan = "unsubscribed"
        maxUsers = 1
        maxCustomers = 0
        maxAppointments = 0
        subscription_status = "pending_purchase"
        subscription_started_at = null
        subscription_expires_at = null
      } else if (createTypeSnapshot === "demo") {
        plan = "demo"
        maxUsers = 1
        maxCustomers = 20
        maxAppointments = 50
        subscription_status = "active"
        subscription_started_at = now.toISOString()
        subscription_expires_at = null
      } else {
        if (!businessForm.max_users || !businessForm.max_customers || !businessForm.max_appointments) {
          toast({
            title: "Σφάλμα",
            description: "Συμπληρώστε όρια χρηστών, πελατών και ραντεβού για το Premium+.",
            variant: "destructive",
          })
          setCreating(false)
          return
        }
        plan = "premium_plus"
        maxUsers = businessForm.max_users
        maxCustomers = businessForm.max_customers
        maxAppointments = businessForm.max_appointments
        subscription_status = "active"
        subscription_started_at = now.toISOString()
        subscription_expires_at = expires.toISOString()
      }

      const { error } = await supabase.from("businesses").insert({
        name: businessForm.name.trim(),
        business_type: businessForm.business_type || null,
        phone: businessForm.phone || null,
        email: businessForm.email || null,
        address: businessForm.address || null,
        subscription_plan: plan,
        subscription_status,
        subscription_started_at,
        subscription_expires_at,
        max_users: maxUsers,
        max_customers: maxCustomers,
        max_appointments: maxAppointments,
      })
      if (error) throw error
      setCreateOpen(false)
      setBusinessForm(initialBusinessForm)
      setCreateType("standard")
      setBillingCycle("monthly")
      setDurationCount(1)
      await loadBusinesses()
      await loadAdminUsernames()
      toast({
        title: "Επιχείρηση δημιουργήθηκε",
        description:
          createTypeSnapshot === "standard"
            ? "Προσθέστε διαχειριστή. Ο πελάτης θα ενεργοποιήσει πλάνο από «Αγορά προγράμματος»."
            : "Η επιχείρηση δημιουργήθηκε επιτυχώς.",
      })
    } catch (err) {
      console.error("Create business error:", err)
      toast({ title: "Σφάλμα", description: err instanceof Error ? err.message : "Αποτυχία δημιουργίας.", variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  async function handleChangeBusinessPlan(businessId: string, newPlan: PlanKey) {
    const target = businesses.find((b) => b.id === businessId)
    if (!target) return

    let maxUsers = target.max_users
    let maxCustomers = target.max_customers
    let maxAppointments = target.max_appointments

    if (newPlan === "unsubscribed") {
      maxUsers = 1
      maxCustomers = 0
      maxAppointments = 0
    } else if (newPlan === "demo") {
      maxUsers = 1
      maxCustomers = 20
      maxAppointments = 50
    } else if (newPlan === "starter") {
      maxUsers = 3
      maxCustomers = 300
      maxAppointments = 1000
    } else if (newPlan === "pro") {
      maxUsers = 10
      maxCustomers = 2000
      maxAppointments = 10000
    } else if (newPlan === "premium") {
      maxUsers = 30
      maxCustomers = 10000
      maxAppointments = 50000
    }
    // Για premium_plus κρατάμε τα υπάρχοντα custom όρια.

    try {
      const updatePayload: Record<string, unknown> = {
        subscription_plan: newPlan,
        max_users: maxUsers,
        max_customers: maxCustomers,
        max_appointments: maxAppointments,
      }
      if (newPlan === "demo" || newPlan === "unsubscribed") {
        updatePayload.subscription_expires_at = null
      }
      if (newPlan === "unsubscribed") {
        updatePayload.subscription_status = "pending_purchase"
        updatePayload.subscription_started_at = null
      } else if (newPlan !== "demo") {
        updatePayload.subscription_status = "active"
      }
      const { error } = await supabase
        .from("businesses")
        .update(updatePayload)
        .eq("id", businessId)
      if (error) throw error
      await loadBusinesses()
      await loadAdminUsernames()
      toast({
        title: "Πλάνο ενημερώθηκε",
        description: "Το πλάνο και τα όρια της επιχείρησης ενημερώθηκαν.",
      })
    } catch (err) {
      console.error("Change business plan error:", err)
      toast({
        title: "Σφάλμα",
        description: err instanceof Error ? err.message : "Αποτυχία αλλαγής πλάνου.",
        variant: "destructive",
      })
    }
  }

  function formatInvokeError(data: any, error: any, fallback: string) {
    try {
      if (data?.error) return String(data.error)
      const ctx = error?.context
      const status = ctx?.status
      const body = ctx?.body
      let bodyText = ""
      if (typeof body === "string") bodyText = body
      else if (body != null) bodyText = JSON.stringify(body)
      const msg = typeof error?.message === "string" ? error.message : ""
      const parts = [
        status ? `status=${status}` : "",
        bodyText && bodyText !== "[]" ? `body=${bodyText}` : "",
        msg ? `message=${msg}` : "",
      ].filter(Boolean)
      if (parts.length) return parts.join(" | ")
      return fallback
    } catch {
      return fallback
    }
  }

  async function invokeAuthed(name: string, body: Record<string, unknown>) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
    const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ""
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    let token = sessionData?.session?.access_token

    function decodeJwtPayload(jwt: string) {
      try {
        const part = jwt.split(".")[1]
        const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"))
        return JSON.parse(json) as Record<string, unknown>
      } catch {
        return null
      }
    }
    console.log("[platform invoke]", name, {
      hasSession: Boolean(sessionData?.session),
      hasToken: Boolean(token),
      tokenTail: token ? token.slice(-10) : null,
      jwt: token ? decodeJwtPayload(token) : null,
    })
    if (sessionError || !token) {
      return { data: null as any, error: { message: "Δεν είστε συνδεδεμένοι.", context: { status: 401 } } as any }
    }
    if (!supabaseUrl || !anonKey) {
      return { data: null as any, error: { message: "Missing Supabase env (URL/ANON_KEY).", context: { status: 500 } } as any }
    }

    async function callWithToken(accessToken: string) {
      return await fetch(`${supabaseUrl}/functions/v1/${name}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: anonKey,
          "Content-Type": "application/json",
        } as HeadersInit,
        body: JSON.stringify(body),
      })
    }

    let res = await callWithToken(token)

    let parsed: any = null
    let text = await res.text()
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      parsed = text
    }

    // If token is stale/invalid, refresh session and retry once.
    if (!res.ok && res.status === 401 && typeof parsed === "object" && parsed && /invalid jwt/i.test(String((parsed as any).message ?? ""))) {
      console.log("[platform invoke] 401 invalid jwt; refreshing session and retrying", { fn: name })
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession()
      if (!refreshErr && refreshed?.session?.access_token) {
        token = refreshed.session.access_token
        res = await callWithToken(token)
        text = await res.text()
        try {
          parsed = text ? JSON.parse(text) : null
        } catch {
          parsed = text
        }
      }
    }

    if (!res.ok) {
      return {
        data: parsed,
        error: {
          message: "Edge Function returned a non-2xx status code",
          context: { status: res.status, body: parsed },
        } as any,
      }
    }

    return { data: parsed, error: null as any }
  }

  async function handleAddAdmin() {
    if (!detailsBusinessId) return
    const usernameTrimmed = addAdminForm.username.trim().toLowerCase()
    if (!addAdminForm.full_name.trim() || !usernameTrimmed || !addAdminForm.password) {
      toast({ title: "Σφάλμα", description: "Συμπληρώστε ονοματεπώνυμο, username και κωδικό.", variant: "destructive" })
      return
    }
    if (!/^[a-z0-9_-]+$/.test(usernameTrimmed)) {
      toast({ title: "Σφάλμα", description: "Το username επιτρέπει μόνο μικρά γράμματα, αριθμούς, παύλα και underscore.", variant: "destructive" })
      return
    }
    setAddAdminSubmitting(true)
    try {
      const business = businesses.find((b) => b.id === detailsBusinessId)
      if (business && business.max_users != null && detailsUsers.length >= business.max_users) {
        toast({
          title: "Όριο χρηστών πλάνου",
          description: "Έχεις φτάσει το μέγιστο πλήθος χρηστών για το επιλεγμένο πλάνο της επιχείρησης.",
          variant: "destructive",
        })
        setAddAdminSubmitting(false)
        return
      }

      // Server-side creation (Admin API): creates a CONFIRMED auth user + inserts public.users (with rollback)
      const { data, error } = await invokeAuthed("create-business-user", {
        business_id: detailsBusinessId,
        full_name: addAdminForm.full_name.trim(),
        username: usernameTrimmed,
        password: addAdminForm.password,
      })
      if (error || !data?.success) {
        const raw = formatInvokeError(data, error, "Αποτυχία δημιουργίας χρήστη.")
        const msg = /already registered|already exists|User already registered|duplicate/i.test(raw)
          ? "Το username υπάρχει ήδη. Δοκιμάστε άλλο."
          : /rate limit/i.test(raw)
            ? "Πάρα πολλές προσπάθειες. Δοκιμάστε ξανά σε λίγο."
          : raw
        toast({ title: "Σφάλμα", description: msg, variant: "destructive" })
        return
      }

      setAddAdminOpen(false)
      setAddAdminForm({ full_name: "", username: "", password: "" })
      const { data: usersData } = await supabase
        .from("users")
        .select("id, full_name, username, role, status, created_at")
        .eq("business_id", detailsBusinessId)
        .order("created_at", { ascending: true })
      if (usersData) setDetailsUsers(usersData as TenantUser[])
      await loadAdminUsernames()
      toast({ title: "Διαχειριστής προστέθηκε", description: "Ο διαχειριστής δημιουργήθηκε επιτυχώς." })
    } catch (err) {
      console.error("Add admin error:", err)
      toast({ title: "Σφάλμα", description: err instanceof Error ? err.message : "Αποτυχία.", variant: "destructive" })
    } finally {
      setAddAdminSubmitting(false)
    }
  }

  async function handleRepairUser(username: string | null) {
    if (!username) return
    const { data, error } = await invokeAuthed("confirm-business-user", { username })
    if (error || !data?.success) {
      const raw = formatInvokeError(data, error, "Αποτυχία επιδιόρθωσης.")
      toast({ title: "Σφάλμα", description: raw, variant: "destructive" })
      return
    }
    toast({ title: "Επιδιορθώθηκε", description: "Ο χρήστης μπορεί να συνδεθεί άμεσα." })
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm("Διαγραφή χρήστη; Θα διαγραφεί και ο auth λογαριασμός.")) return
    const { data, error } = await invokeAuthed("delete-business-user", { user_id: userId })
    if (error || !data?.success) {
      const raw = formatInvokeError(data, error, "Αποτυχία διαγραφής.")
      toast({ title: "Σφάλμα", description: raw, variant: "destructive" })
      return
    }
    setDetailsUsers((prev) => prev.filter((u) => u.id !== userId))
    toast({ title: "Διαγράφηκε", description: "Ο χρήστης διαγράφηκε." })
  }

  async function handleDeleteBusiness(businessId: string, businessName: string) {
    if (!confirm(`Διαγραφή επιχείρησης "${businessName}";\n\nΘα διαγραφούν ΟΛΑ τα δεδομένα της (χρήστες, πελάτες, ραντεβού, πληρωμές κλπ).`)) return
    const { data, error } = await invokeAuthed("delete-business", { business_id: businessId })
    if (error || !data?.success) {
      const raw = formatInvokeError(data, error, "Αποτυχία διαγραφής επιχείρησης.")
      toast({ title: "Σφάλμα", description: raw, variant: "destructive" })
      return
    }
    setDetailsBusinessId(null)
    setBusinesses((prev) => prev.filter((b) => b.id !== businessId))
    toast({ title: "Διαγράφηκε", description: "Η επιχείρηση διαγράφηκε." })
  }

  const detailsBusiness = detailsBusinessId ? businesses.find((b) => b.id === detailsBusinessId) : null

  useEffect(() => {
    if (detailsBusiness?.subscription_expires_at) {
      setDetailsExpiryDate(detailsBusiness.subscription_expires_at.slice(0, 10))
    } else {
      setDetailsExpiryDate("")
    }
  }, [detailsBusiness?.id, detailsBusiness?.subscription_expires_at])

  async function handleUpdateExpiry() {
    if (!detailsBusinessId || !detailsExpiryDate) return
    setUpdatingExpiry(true)
    try {
      const { error } = await supabase
        .from("businesses")
        .update({ subscription_expires_at: new Date(detailsExpiryDate).toISOString() })
        .eq("id", detailsBusinessId)
      if (error) throw error
      await loadBusinesses()
      toast({ title: "Ενημερώθηκε", description: "Η λήξη συνδρομής αποθηκεύτηκε." })
    } catch (err) {
      toast({ title: "Σφάλμα", description: err instanceof Error ? err.message : "Αποτυχία ενημέρωσης λήξης", variant: "destructive" })
    } finally {
      setUpdatingExpiry(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Επιχειρήσεις</h1>
          <p className="text-muted-foreground">Διαχείριση tenants της πλατφόρμας</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Νέα επιχείρηση</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Λίστα επιχειρήσεων</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : businesses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium text-foreground/80">Δεν υπάρχουν επιχειρήσεις</p>
              <p className="text-sm">Δημιούργησε την πρώτη επιχείρηση για να ξεκινήσεις.</p>
              <Button variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}>
                Νέα επιχείρηση
              </Button>
            </div>
          ) : (
            <>
              <div className="md:hidden space-y-2">
                {businesses.map((b) => {
                  const admin = adminByBusinessId[b.id]
                  return (
                    <div key={b.id} className="rounded-lg border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">{b.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {b.subscription_plan ?? "—"} • {b.subscription_status ?? "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Admin: {admin?.username ?? "—"}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">Ενέργειες</Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetailsBusinessId(b.id)}>Λεπτομέρειες</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteBusiness(b.id, b.name)}>
                              Διαγραφή
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="hidden md:block rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Όνομα</TableHead>
                      <TableHead>Τύπος</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="whitespace-nowrap">Admin Username</TableHead>
                      <TableHead>Πλάνο</TableHead>
                      <TableHead>Κατάσταση</TableHead>
                      <TableHead>Όρια</TableHead>
                      <TableHead>Δημιουργήθηκε</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {businesses.map((b) => {
                      const admin = adminByBusinessId[b.id]
                      return (
                        <TableRow key={b.id} className="odd:bg-muted/40">
                          <TableCell className="font-medium">{b.name}</TableCell>
                          <TableCell>{b.business_type ?? "—"}</TableCell>
                          <TableCell>{b.email ?? "—"}</TableCell>
                          <TableCell className="font-mono text-sm">{admin?.username ?? "—"}</TableCell>
                          <TableCell>{b.subscription_plan ?? "—"}</TableCell>
                          <TableCell>{b.subscription_status ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            U: {b.max_users ?? "—"} / C: {b.max_customers ?? "—"} / A: {b.max_appointments ?? "—"}
                          </TableCell>
                          <TableCell>{new Date(b.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label="Ενέργειες">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setDetailsBusinessId(b.id)}>
                                  Λεπτομέρειες
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDeleteBusiness(b.id, b.name)}
                                >
                                  Διαγραφή
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Business — business fields only */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Νέα επιχείρηση</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="b-name">Όνομα επιχείρησης</Label>
                <Input id="b-name" value={businessForm.name} onChange={(e) => setBusinessForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="b-type">Τύπος</Label>
                <Input id="b-type" value={businessForm.business_type} onChange={(e) => setBusinessForm((f) => ({ ...f, business_type: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="b-phone">Τηλέφωνο</Label>
                <Input id="b-phone" value={businessForm.phone} onChange={(e) => setBusinessForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="b-email">Email επιχείρησης</Label>
                <Input id="b-email" type="email" value={businessForm.email} onChange={(e) => setBusinessForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="b-address">Διεύθυνση</Label>
                <Input id="b-address" value={businessForm.address} onChange={(e) => setBusinessForm((f) => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Τύπος επιχείρησης</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      { key: "standard" as const, title: "Κανονική", desc: "Χωρίς πλάνο — ο πελάτης αγοράζει Starter/Pro/Premium μετά την είσοδο." },
                      { key: "demo" as const, title: "Demo", desc: "Δοκιμαστικό πλάνο με όρια, χωρίς λήξη." },
                      { key: "premium_plus" as const, title: "Premium+", desc: "Custom όρια + διάρκεια από εσάς." },
                    ] as const
                  ).map(({ key, title, desc }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCreateType(key)}
                      className={`rounded-lg border p-3 text-left text-xs transition-colors ${
                        createType === key ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <span className="font-semibold text-sm text-foreground">{title}</span>
                      <p className="mt-1 text-muted-foreground leading-snug">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              {createType === "premium_plus" && (
                <div className="space-y-2">
                  <Label>Διάρκεια συνδρομής (Premium+)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={billingCycle} onValueChange={(v) => setBillingCycle(v as BillingCycle)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Ανά μήνα</SelectItem>
                        <SelectItem value="yearly">Ανά χρόνο</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      value={durationCount}
                      onChange={(e) => setDurationCount(Math.max(1, Number(e.target.value) || 1))}
                      placeholder={billingCycle === "monthly" ? "Μήνες" : "Χρόνια"}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Λήξη μετά από {durationCount} {billingCycle === "monthly" ? "μήνα/ες" : "χρόνο/ια"}.
                  </p>
                </div>
              )}
              {createType === "demo" && (
                <p className="text-sm text-muted-foreground sm:col-span-2">
                  Demo: <span className="font-medium text-foreground">χωρίς ημερομηνία λήξης</span>, όρια 1 χρήστης / 20 πελάτες / 50 ραντεβού.
                </p>
              )}
              {createType === "standard" && (
                <p className="text-sm text-muted-foreground sm:col-span-2">
                  Ο πελάτης βλέπει μόνο την <strong>Αγορά προγράμματος</strong> μέχρι να ενεργοποιήσει Starter, Pro ή Premium.
                </p>
              )}
              {createType === "premium_plus" && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Όρια χρήσης (μόνο για Premium+)</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      type="number"
                      value={businessForm.max_users}
                      onChange={(e) =>
                        setBusinessForm((f) => ({ ...f, max_users: Number(e.target.value) || 0 }))
                      }
                      placeholder="Χρήστες"
                    />
                    <Input
                      type="number"
                      value={businessForm.max_customers}
                      onChange={(e) =>
                        setBusinessForm((f) => ({ ...f, max_customers: Number(e.target.value) || 0 }))
                      }
                      placeholder="Πελάτες"
                    />
                    <Input
                      type="number"
                      value={businessForm.max_appointments}
                      onChange={(e) =>
                        setBusinessForm((f) => ({ ...f, max_appointments: Number(e.target.value) || 0 }))
                      }
                      placeholder="Ραντεβού"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Τα όρια Premium+ είναι custom ανά επιχείρηση. Για Starter/Pro/Premium τα όρια είναι προκαθορισμένα.
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Ακύρωση</Button>
              <Button type="button" onClick={handleCreateBusiness} disabled={creating}>{creating ? "Δημιουργία..." : "Δημιουργία"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Business Details — Sheet */}
      <Sheet open={!!detailsBusinessId} onOpenChange={(open) => !open && setDetailsBusinessId(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Λεπτομέρειες επιχείρησης</SheetTitle>
          </SheetHeader>
          {detailsBusiness && (
            <div className="space-y-6 pt-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Επιχείρηση</h4>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Όνομα</dt>
                  <dd className="font-medium">{detailsBusiness.name}</dd>
                  <dt className="text-muted-foreground">Τύπος</dt>
                  <dd>{detailsBusiness.business_type ?? "—"}</dd>
                  <dt className="text-muted-foreground">Τηλέφωνο</dt>
                  <dd>{detailsBusiness.phone ?? "—"}</dd>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd>{detailsBusiness.email ?? "—"}</dd>
                  <dt className="text-muted-foreground">Διεύθυνση</dt>
                  <dd>{detailsBusiness.address ?? "—"}</dd>
                  <dt className="text-muted-foreground">Πλάνο</dt>
                  <dd className="flex items-center gap-2">
                    {user?.role === "super_admin" ? (
                      <Select
                        value={(detailsBusiness.subscription_plan as PlanKey) ?? "unsubscribed"}
                        onValueChange={(v) => handleChangeBusinessPlan(detailsBusiness.id, v as PlanKey)}
                      >
                        <SelectTrigger className="h-8 w-full max-w-[220px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(PLAN_LABEL) as PlanKey[]).map((k) => (
                            <SelectItem key={k} value={k}>
                              {PLAN_LABEL[k]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span>{detailsBusiness.subscription_plan ?? "—"}</span>
                    )}
                  </dd>
                  <dt className="text-muted-foreground">Κατάσταση</dt>
                  <dd>{detailsBusiness.subscription_status ?? "—"}</dd>
                  <dt className="text-muted-foreground">Όρια</dt>
                  <dd>U: {detailsBusiness.max_users ?? "—"} / C: {detailsBusiness.max_customers ?? "—"} / A: {detailsBusiness.max_appointments ?? "—"}</dd>
                  <dt className="text-muted-foreground">Λήξη συνδρομής</dt>
                  <dd className="flex flex-col gap-2">
                    {detailsBusiness.subscription_plan === "demo"
                      ? "Χωρίς λήξη"
                      : detailsBusiness.subscription_expires_at
                        ? new Date(detailsBusiness.subscription_expires_at).toLocaleDateString("el-GR")
                        : "—"}
                    {user?.role === "super_admin" && detailsBusiness.subscription_plan !== "demo" && (
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Input
                          type="date"
                          className="h-8 w-[160px]"
                          value={detailsExpiryDate}
                          onChange={(e) => setDetailsExpiryDate(e.target.value)}
                        />
                        <Button size="sm" variant="outline" onClick={handleUpdateExpiry} disabled={updatingExpiry || !detailsExpiryDate}>
                          {updatingExpiry ? "Αποθήκευση..." : "Ενημέρωση λήξης"}
                        </Button>
                      </div>
                    )}
                  </dd>
                  <dt className="text-muted-foreground">Δημιουργήθηκε</dt>
                  <dd>{new Date(detailsBusiness.created_at).toLocaleString()}</dd>
                </dl>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-muted-foreground">Χρήστες tenant</h4>
                  <Button size="sm" onClick={() => setAddAdminOpen(true)}>Προσθήκη διαχειριστή</Button>
                </div>
                {detailsLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : detailsUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Δεν υπάρχουν χρήστες. Προσθέστε τον πρώτο διαχειριστή.</p>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ονοματεπώνυμο</TableHead>
                          <TableHead>Username</TableHead>
                          <TableHead>Ρόλος</TableHead>
                          <TableHead>Κατάσταση</TableHead>
                          <TableHead>Δημιουργήθηκε</TableHead>
                          <TableHead className="w-0" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailsUsers.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell>{u.full_name}</TableCell>
                            <TableCell className="font-mono text-sm">{u.username ?? "—"}</TableCell>
                            <TableCell>{u.role}</TableCell>
                            <TableCell>{u.status}</TableCell>
                            <TableCell>{new Date(u.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 mr-2"
                                onClick={() => handleRepairUser(u.username)}
                                disabled={!u.username}
                              >
                                Επιδιόρθωση σύνδεσης
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="h-8"
                                onClick={() => handleDeleteUser(u.id)}
                              >
                                Διαγραφή
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Διαγραφή επιχείρησης (μη αναστρέψιμο)
                  </p>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => handleDeleteBusiness(detailsBusiness.id, detailsBusiness.name)}
                  >
                    Διαγραφή επιχείρησης
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Admin — full name, username, password */}
      <Dialog open={addAdminOpen} onOpenChange={setAddAdminOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Προσθήκη διαχειριστή</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="a-full_name">Ονοματεπώνυμο</Label>
              <Input id="a-full_name" value={addAdminForm.full_name} onChange={(e) => setAddAdminForm((f) => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-username">Username (σύνδεση με username + κωδικό)</Label>
              <Input id="a-username" type="text" placeholder="π.χ. charis" value={addAdminForm.username} onChange={(e) => setAddAdminForm((f) => ({ ...f, username: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Μόνο μικρά γράμματα, αριθμούς, παύλα και underscore.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-password">Κωδικός πρόσβασης</Label>
              <Input id="a-password" type="password" value={addAdminForm.password} onChange={(e) => setAddAdminForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddAdminOpen(false)} disabled={addAdminSubmitting}>Ακύρωση</Button>
              <Button onClick={handleAddAdmin} disabled={addAdminSubmitting}>{addAdminSubmitting ? "Προσθήκη..." : "Προσθήκη"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
