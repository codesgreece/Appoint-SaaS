import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  SheetDescription,
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
import {
  MoreHorizontal,
  Building2,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  CalendarClock,
  Users,
  UserPlus,
  Gauge,
  Sparkles,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

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
type BillingCycle = "daily" | "monthly" | "yearly"

const PLAN_LIMITS: Record<Exclude<PlanKey, "premium_plus">, { maxUsers: number; maxCustomers: number; maxAppointments: number }> = {
  unsubscribed: { maxUsers: 1, maxCustomers: 0, maxAppointments: 0 },
  demo: { maxUsers: 1, maxCustomers: 20, maxAppointments: 50 },
  starter: { maxUsers: 3, maxCustomers: 300, maxAppointments: 1000 },
  pro: { maxUsers: 10, maxCustomers: 2000, maxAppointments: 10000 },
  premium: { maxUsers: 30, maxCustomers: 10000, maxAppointments: 50000 },
}

const PLAN_LABEL: Record<PlanKey, string> = {
  unsubscribed: "Χωρίς συνδρομή (αγορά από πελάτη)",
  demo: "Demo (δοκιμαστικό)",
  starter: "Starter",
  pro: "Pro",
  premium: "Premium",
  premium_plus: "Premium+ (custom)",
}

function formatPlanLabel(plan: string | null): string {
  if (!plan) return "—"
  const k = plan as PlanKey
  return PLAN_LABEL[k] ?? plan
}

function getExpiryStatus(b: BusinessRow): { label: string; className: string } {
  if (b.subscription_plan === "unsubscribed") {
    return { label: "Χωρίς συνδρομή", className: "bg-slate-100 text-slate-700 border-slate-200" }
  }
  if (b.subscription_plan === "demo") {
    return { label: "Demo (χωρίς λήξη)", className: "bg-emerald-100 text-emerald-700 border-emerald-200" }
  }
  if (!b.subscription_expires_at) {
    return { label: "Χωρίς ημερομηνία λήξης", className: "bg-slate-100 text-slate-700 border-slate-200" }
  }

  const expiry = new Date(b.subscription_expires_at)
  if (Number.isNaN(expiry.getTime())) {
    return { label: "Μη έγκυρη ημερομηνία λήξης", className: "bg-slate-100 text-slate-700 border-slate-200" }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  expiry.setHours(0, 0, 0, 0)
  const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / 86400000)

  if (daysLeft < 0) {
    return { label: "Έχει λήξει", className: "bg-red-100 text-red-700 border-red-200" }
  }
  if (daysLeft <= 15) {
    return { label: `Λήγει σε ${daysLeft} ημέρες`, className: "bg-orange-100 text-orange-700 border-orange-200" }
  }
  return { label: `Ενεργό (${daysLeft} ημέρες)`, className: "bg-emerald-100 text-emerald-700 border-emerald-200" }
}

function getSubscriptionRecordStatusBadge(status: string | null): { label: string; className: string } {
  const s = (status ?? "").toLowerCase()
  if (s === "active") {
    return { label: "Ενεργή συνδρομή", className: "bg-emerald-500/12 text-emerald-700 border-emerald-400/30" }
  }
  if (s === "none" || !status) {
    return { label: "Χωρίς συνδρομή", className: "bg-muted text-muted-foreground border-border" }
  }
  return { label: status, className: "bg-muted text-foreground border-border" }
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
  const [detailsLimitsDraft, setDetailsLimitsDraft] = useState({
    max_users: "",
    max_customers: "",
    max_appointments: "",
  })
  const [updatingLimits, setUpdatingLimits] = useState(false)

  const [businessForm, setBusinessForm] = useState(initialBusinessForm)
  const [createPlan, setCreatePlan] = useState<PlanKey>("unsubscribed")
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
    const createPlanSnapshot = createPlan
    try {
      const now = new Date()
      const expires = new Date(now)
      if (billingCycle === "daily") expires.setDate(expires.getDate() + Math.max(1, durationCount))
      else if (billingCycle === "monthly") expires.setMonth(expires.getMonth() + Math.max(1, durationCount))
      else expires.setFullYear(expires.getFullYear() + Math.max(1, durationCount))

      let plan: PlanKey
      let maxUsers: number | null
      let maxCustomers: number | null
      let maxAppointments: number | null
      let subscription_status: string
      let subscription_started_at: string | null
      let subscription_expires_at: string | null

      if (createPlanSnapshot === "premium_plus") {
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
      } else {
        plan = createPlanSnapshot
        const limits = PLAN_LIMITS[createPlanSnapshot]
        maxUsers = limits.maxUsers
        maxCustomers = limits.maxCustomers
        maxAppointments = limits.maxAppointments
        if (createPlanSnapshot === "unsubscribed") {
          subscription_status = "none"
          subscription_started_at = null
          subscription_expires_at = null
        } else if (createPlanSnapshot === "demo") {
          subscription_status = "active"
          subscription_started_at = now.toISOString()
          subscription_expires_at = null
        } else {
          subscription_status = "active"
          subscription_started_at = now.toISOString()
          subscription_expires_at = expires.toISOString()
        }
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
      setCreatePlan("unsubscribed")
      setBillingCycle("monthly")
      setDurationCount(1)
      await loadBusinesses()
      await loadAdminUsernames()
      toast({
        title: "Επιχείρηση δημιουργήθηκε",
        description:
          createPlanSnapshot === "unsubscribed"
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
        updatePayload.subscription_status = "none"
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

  useEffect(() => {
    if (!detailsBusiness) return
    setDetailsLimitsDraft({
      max_users: detailsBusiness.max_users != null ? String(detailsBusiness.max_users) : "",
      max_customers: detailsBusiness.max_customers != null ? String(detailsBusiness.max_customers) : "",
      max_appointments: detailsBusiness.max_appointments != null ? String(detailsBusiness.max_appointments) : "",
    })
  }, [
    detailsBusiness?.id,
    detailsBusiness?.max_users,
    detailsBusiness?.max_customers,
    detailsBusiness?.max_appointments,
  ])

  async function handleSaveLimits() {
    if (!detailsBusinessId || user?.role !== "super_admin") return
    const mu = parseInt(detailsLimitsDraft.max_users, 10)
    const mc = parseInt(detailsLimitsDraft.max_customers, 10)
    const ma = parseInt(detailsLimitsDraft.max_appointments, 10)
    if ([mu, mc, ma].some((n) => Number.isNaN(n) || n < 0)) {
      toast({
        title: "Σφάλμα",
        description: "Συμπληρώστε έγκυρα μη αρνητικά ακέραια για χρήστες, πελάτες και ραντεβού.",
        variant: "destructive",
      })
      return
    }
    setUpdatingLimits(true)
    try {
      const { error } = await supabase
        .from("businesses")
        .update({
          max_users: mu,
          max_customers: mc,
          max_appointments: ma,
        })
        .eq("id", detailsBusinessId)
      if (error) throw error
      await loadBusinesses()
      toast({
        title: "Όρια αποθηκεύτηκαν",
        description: "Τα μέγιστα χρήστες, πελάτες και ραντεβού ενημερώθηκαν.",
      })
    } catch (err) {
      console.error("Save limits error:", err)
      toast({
        title: "Σφάλμα",
        description: err instanceof Error ? err.message : "Αποτυχία αποθήκευσης ορίων.",
        variant: "destructive",
      })
    } finally {
      setUpdatingLimits(false)
    }
  }

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
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-primary/[0.06] via-background to-muted/25 p-6 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.15)] ring-1 ring-border/40 sm:p-8">
        <div
          className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-primary/[0.07] blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute bottom-0 left-1/2 h-px w-[min(100%,28rem)] -translate-x-1/2 bg-gradient-to-r from-transparent via-primary/20 to-transparent"
          aria-hidden
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-background/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary shadow-sm backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Platform
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Επιχειρήσεις</h1>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Διαχείριση tenants — πλάνα, λήξεις και όρια σε μια ενιαία, καθαρή εικόνα.
            </p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="h-11 shrink-0 rounded-xl px-6 shadow-lg shadow-primary/25 transition hover:shadow-xl hover:shadow-primary/20"
          >
            Νέα επιχείρηση
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border-border/50 bg-card/90 shadow-[0_24px_48px_-16px_rgba(15,23,42,0.14)] ring-1 ring-border/30 backdrop-blur-sm">
        <CardHeader className="border-b border-border/40 bg-muted/15 px-6 py-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">Λίστα επιχειρήσεων</CardTitle>
                <CardDescription>
                  {loading ? "Φόρτωση…" : `${businesses.length} ${businesses.length === 1 ? "επιχείρηση" : "επιχειρήσεις"}`}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="px-6 py-8">
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          ) : businesses.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center text-muted-foreground">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 ring-1 ring-border/50">
                <Building2 className="h-8 w-8 opacity-30" />
              </div>
              <p className="font-medium text-foreground/90">Δεν υπάρχουν επιχειρήσεις</p>
              <p className="mt-1 max-w-sm text-sm">Δημιούργησε την πρώτη επιχείρηση για να ξεκινήσεις.</p>
              <Button variant="outline" className="mt-6 rounded-xl" onClick={() => setCreateOpen(true)}>
                Νέα επιχείρηση
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-3 p-4 md:hidden">
                {businesses.map((b) => {
                  const admin = adminByBusinessId[b.id]
                  const expiryStatus = getExpiryStatus(b)
                  const recordStatus = getSubscriptionRecordStatusBadge(b.subscription_status)
                  return (
                    <div
                      key={b.id}
                      className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-muted/20 p-4 shadow-sm ring-1 ring-border/30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-2">
                          <p className="font-semibold leading-snug text-foreground">{b.name}</p>
                          <p className="text-xs text-muted-foreground">{b.business_type ?? "—"}</p>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="outline" className={cn("text-[10px] font-medium", recordStatus.className)}>
                              {recordStatus.label}
                            </Badge>
                            <Badge variant="outline" className={cn("text-[10px] font-medium", expiryStatus.className)}>
                              {expiryStatus.label}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            <span className="font-mono text-foreground/80">{admin?.username ?? "—"}</span>
                            {" · "}
                            {formatPlanLabel(b.subscription_plan)}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="shrink-0 rounded-lg">
                              Ενέργειες
                            </Button>
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

              <div className="hidden md:block p-4">
                <div className="overflow-hidden rounded-2xl border border-border/40 bg-muted/20 shadow-inner">
                  <div className="max-h-[min(70vh,720px)] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/50 hover:bg-transparent">
                          <TableHead className="sticky top-0 z-10 bg-muted/60 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
                            Όνομα
                          </TableHead>
                          <TableHead className="sticky top-0 z-10 bg-muted/60 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
                            Τύπος
                          </TableHead>
                          <TableHead className="sticky top-0 z-10 bg-muted/60 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
                            Email
                          </TableHead>
                          <TableHead className="sticky top-0 z-10 whitespace-nowrap bg-muted/60 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
                            Admin
                          </TableHead>
                          <TableHead className="sticky top-0 z-10 bg-muted/60 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
                            Πλάνο
                          </TableHead>
                          <TableHead className="sticky top-0 z-10 bg-muted/60 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
                            Κατάσταση
                          </TableHead>
                          <TableHead className="sticky top-0 z-10 bg-muted/60 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
                            Όρια
                          </TableHead>
                          <TableHead className="sticky top-0 z-10 bg-muted/60 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
                            Δημιουργία
                          </TableHead>
                          <TableHead className="sticky top-0 z-10 w-[52px] bg-muted/60 py-3 backdrop-blur-sm" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {businesses.map((b) => {
                          const admin = adminByBusinessId[b.id]
                          const expiryStatus = getExpiryStatus(b)
                          const recordStatus = getSubscriptionRecordStatusBadge(b.subscription_status)
                          return (
                            <TableRow
                              key={b.id}
                              className="border-b border-border/40 transition-colors hover:bg-primary/[0.03]"
                            >
                              <TableCell className="max-w-[200px] py-3.5 font-medium leading-snug">
                                <span className="line-clamp-2">{b.name}</span>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{b.business_type ?? "—"}</TableCell>
                              <TableCell className="max-w-[160px] truncate text-sm" title={b.email ?? undefined}>
                                {b.email ?? "—"}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-foreground/90">{admin?.username ?? "—"}</TableCell>
                              <TableCell className="max-w-[140px]">
                                <span
                                  className="inline-flex rounded-lg border border-border/50 bg-background/80 px-2 py-1 text-[11px] font-medium leading-tight text-foreground shadow-sm"
                                  title={formatPlanLabel(b.subscription_plan)}
                                >
                                  <span className="line-clamp-2">{formatPlanLabel(b.subscription_plan)}</span>
                                </span>
                              </TableCell>
                              <TableCell className="min-w-[140px]">
                                <div className="flex flex-col gap-1">
                                  <Badge
                                    variant="outline"
                                    className={cn("w-fit border px-2 py-0.5 text-[10px] font-semibold", recordStatus.className)}
                                  >
                                    {recordStatus.label}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className={cn("w-fit border px-2 py-0.5 text-[10px] font-semibold", expiryStatus.className)}
                                  >
                                    {expiryStatus.label}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {[
                                    { k: "U", v: b.max_users },
                                    { k: "C", v: b.max_customers },
                                    { k: "A", v: b.max_appointments },
                                  ].map(({ k, v }) => (
                                    <span
                                      key={k}
                                      className="rounded-md bg-muted/80 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground ring-1 ring-border/40"
                                    >
                                      {k} {v ?? "—"}
                                    </span>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-sm text-muted-foreground tabular-nums">
                                {new Date(b.created_at).toLocaleDateString("el-GR")}
                              </TableCell>
                              <TableCell className="py-2">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                                      aria-label="Ενέργειες"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setDetailsBusinessId(b.id)}>Λεπτομέρειες</DropdownMenuItem>
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
                </div>
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
                <Label>Επιλογή πακέτου</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {(
                    [
                      { key: "unsubscribed" as const, title: "Χωρίς συνδρομή", desc: "Ο πελάτης αγοράζει πακέτο μετά την είσοδο.", limits: "U1 / C0 / A0" },
                      { key: "demo" as const, title: "Demo", desc: "Δοκιμαστικό, χωρίς λήξη.", limits: "U1 / C20 / A50" },
                      { key: "starter" as const, title: "Starter", desc: "Μικρές ομάδες.", limits: "U3 / C300 / A1000" },
                      { key: "pro" as const, title: "Pro", desc: "Αναπτυσσόμενες επιχειρήσεις.", limits: "U10 / C2000 / A10000" },
                      { key: "premium" as const, title: "Premium", desc: "Μεγάλος όγκος.", limits: "U30 / C10000 / A50000" },
                      { key: "premium_plus" as const, title: "Premium+", desc: "Custom όρια από super admin.", limits: "Custom" },
                    ] as const
                  ).map(({ key, title, desc, limits }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCreatePlan(key)}
                      className={`rounded-lg border p-3 text-left text-xs transition-colors ${
                        createPlan === key ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <span className="font-semibold text-sm text-foreground">{title}</span>
                      <p className="mt-1 text-muted-foreground leading-snug">{desc}</p>
                      <p className="mt-1 text-[11px] text-foreground/80">{limits}</p>
                    </button>
                  ))}
                </div>
              </div>
              {createPlan !== "unsubscribed" && createPlan !== "demo" && (
                <div className="space-y-2">
                  <Label>Διάρκεια συνδρομής</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={billingCycle} onValueChange={(v) => setBillingCycle(v as BillingCycle)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Ανά ημέρα</SelectItem>
                        <SelectItem value="monthly">Ανά μήνα</SelectItem>
                        <SelectItem value="yearly">Ανά χρόνο</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      value={durationCount}
                      onChange={(e) => setDurationCount(Math.max(1, Number(e.target.value) || 1))}
                      placeholder={billingCycle === "daily" ? "Ημέρες" : billingCycle === "monthly" ? "Μήνες" : "Χρόνια"}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Λήξη μετά από {durationCount}{" "}
                    {billingCycle === "daily" ? "ημέρα/ες" : billingCycle === "monthly" ? "μήνα/ες" : "χρόνο/ια"}.
                  </p>
                </div>
              )}
              {createPlan === "demo" && (
                <p className="text-sm text-muted-foreground sm:col-span-2">
                  Demo: <span className="font-medium text-foreground">χωρίς ημερομηνία λήξης</span>, όρια 1 χρήστης / 20 πελάτες / 50 ραντεβού.
                </p>
              )}
              {createPlan === "unsubscribed" && (
                <p className="text-sm text-muted-foreground sm:col-span-2">
                  Ο πελάτης βλέπει μόνο την <strong>Αγορά προγράμματος</strong> μέχρι να ενεργοποιήσει Starter, Pro ή Premium.
                </p>
              )}
              {createPlan === "premium_plus" && (
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
        <SheetContent
          className={cn(
            "flex h-full w-full flex-col gap-0 overflow-hidden p-0",
            "border-l border-primary/15 bg-background shadow-[0_0_0_1px_rgba(0,0,0,0.03),-12px_0_40px_rgba(15,23,42,0.12)]",
            "sm:max-w-xl md:max-w-[480px]",
          )}
        >
          {detailsBusiness && (() => {
            const expiryBadge = getExpiryStatus(detailsBusiness)
            const recordStatus = getSubscriptionRecordStatusBadge(detailsBusiness.subscription_status)
            return (
              <>
                <div className="relative shrink-0 overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary/[0.07] via-background to-muted/40 px-6 pb-5 pt-6">
                  <div
                    className="pointer-events-none absolute -right-16 -top-24 h-48 w-48 rounded-full bg-primary/10 blur-3xl"
                    aria-hidden
                  />
                  <div
                    className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent"
                    aria-hidden
                  />
                  <SheetHeader className="relative space-y-4 text-left">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner ring-1 ring-primary/15">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <SheetTitle className="pr-8 text-left text-lg font-semibold leading-snug tracking-tight md:text-xl">
                          {detailsBusiness.name}
                        </SheetTitle>
                        <SheetDescription className="text-left text-xs leading-relaxed text-muted-foreground">
                          Καρτέλα tenant · διαχείριση πλατφόρμας
                        </SheetDescription>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {detailsBusiness.business_type ? (
                        <Badge variant="secondary" className="rounded-full border-0 bg-background/80 px-3 py-0.5 font-normal shadow-sm">
                          {detailsBusiness.business_type}
                        </Badge>
                      ) : null}
                      <Badge variant="outline" className={cn("rounded-full border px-3 py-0.5 font-medium", recordStatus.className)}>
                        {recordStatus.label}
                      </Badge>
                      <Badge variant="outline" className={cn("rounded-full border px-3 py-0.5 font-medium", expiryBadge.className)}>
                        {expiryBadge.label}
                      </Badge>
                    </div>
                  </SheetHeader>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
                  <Card className="border-border/50 bg-card/90 shadow-sm backdrop-blur-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <Phone className="h-4 w-4 text-primary" />
                        Στοιχεία επικοινωνίας
                      </CardTitle>
                      <CardDescription>Στοιχεία επιχείρησης στο σύστημα</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex gap-3 rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5">
                        <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Τηλέφωνο</p>
                          <p className="font-medium text-foreground">{detailsBusiness.phone ?? "—"}</p>
                        </div>
                      </div>
                      <div className="flex gap-3 rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5">
                        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Email</p>
                          <p className="break-all font-medium text-foreground">{detailsBusiness.email ?? "—"}</p>
                        </div>
                      </div>
                      <div className="flex gap-3 rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Διεύθυνση</p>
                          <p className="font-medium text-foreground">{detailsBusiness.address ?? "—"}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/50 bg-card/90 shadow-sm backdrop-blur-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <CreditCard className="h-4 w-4 text-primary" />
                        Συνδρομή & όρια
                      </CardTitle>
                      <CardDescription>
                        Πλάνο, ημερομηνία λήξης και όρια. Ως super admin μπορείτε να αλλάξετε τα μέγιστα χειροκίνητα (π.χ.
                        επιπλέον χρήστες πέρα από το πλάνο).
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Πλάνο</span>
                        {user?.role === "super_admin" ? (
                          <Select
                            value={(detailsBusiness.subscription_plan as PlanKey) ?? "unsubscribed"}
                            onValueChange={(v) => handleChangeBusinessPlan(detailsBusiness.id, v as PlanKey)}
                          >
                            <SelectTrigger className="h-10 w-full max-w-[280px] rounded-xl border-border/60 bg-background/80">
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
                          <span className="font-medium">{detailsBusiness.subscription_plan ?? "—"}</span>
                        )}
                      </div>

                      {user?.role === "super_admin" ? (
                        <div className="space-y-3">
                          <p className="text-xs font-medium text-muted-foreground">Όρια (μέγιστα)</p>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="space-y-1.5">
                              <Label htmlFor="lim-users" className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                <Users className="h-3.5 w-3.5 text-primary/80" />
                                Χρήστες
                              </Label>
                              <Input
                                id="lim-users"
                                type="number"
                                min={0}
                                inputMode="numeric"
                                className="h-10 rounded-xl border-border/60 bg-background/90 tabular-nums"
                                value={detailsLimitsDraft.max_users}
                                onChange={(e) =>
                                  setDetailsLimitsDraft((d) => ({ ...d, max_users: e.target.value }))
                                }
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="lim-customers" className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                <Sparkles className="h-3.5 w-3.5 text-primary/80" />
                                Πελάτες
                              </Label>
                              <Input
                                id="lim-customers"
                                type="number"
                                min={0}
                                inputMode="numeric"
                                className="h-10 rounded-xl border-border/60 bg-background/90 tabular-nums"
                                value={detailsLimitsDraft.max_customers}
                                onChange={(e) =>
                                  setDetailsLimitsDraft((d) => ({ ...d, max_customers: e.target.value }))
                                }
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="lim-appts" className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                <Gauge className="h-3.5 w-3.5 text-primary/80" />
                                Ραντεβού
                              </Label>
                              <Input
                                id="lim-appts"
                                type="number"
                                min={0}
                                inputMode="numeric"
                                className="h-10 rounded-xl border-border/60 bg-background/90 tabular-nums"
                                value={detailsLimitsDraft.max_appointments}
                                onChange={(e) =>
                                  setDetailsLimitsDraft((d) => ({ ...d, max_appointments: e.target.value }))
                                }
                              />
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            className="rounded-lg"
                            variant="secondary"
                            onClick={handleSaveLimits}
                            disabled={
                              updatingLimits ||
                              detailsLimitsDraft.max_users === "" ||
                              detailsLimitsDraft.max_customers === "" ||
                              detailsLimitsDraft.max_appointments === ""
                            }
                          >
                            {updatingLimits ? "Αποθήκευση..." : "Αποθήκευση ορίων"}
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            Η αλλαγή πλάνου από το παραπάνω μενού επαναφέρει τα προεπιλεγμένα όρια του πλάνου — αποθηκεύστε
                            ξανά τα όρια εδώ αν χρειάζεστε custom τιμές.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          {[
                            { label: "Χρήστες", value: detailsBusiness.max_users, icon: Users },
                            { label: "Πελάτες", value: detailsBusiness.max_customers, icon: Sparkles },
                            { label: "Ραντεβού", value: detailsBusiness.max_appointments, icon: Gauge },
                          ].map(({ label, value, icon: Icon }) => (
                            <div
                              key={label}
                              className="rounded-xl border border-border/50 bg-gradient-to-b from-muted/40 to-muted/10 px-2 py-3 text-center shadow-sm"
                            >
                              <Icon className="mx-auto mb-1 h-4 w-4 text-primary/80" />
                              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                              <p className="text-lg font-semibold tabular-nums text-foreground">{value ?? "—"}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="rounded-xl border border-border/60 bg-gradient-to-br from-muted/50 via-background to-background p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <CalendarClock className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Λήξη συνδρομής</p>
                            {detailsBusiness.subscription_plan === "demo" ? (
                              <p className="text-sm font-medium">Demo — χωρίς ημερομηνία λήξης</p>
                            ) : detailsBusiness.subscription_expires_at ? (
                              <p className="text-lg font-semibold tabular-nums tracking-tight">
                                {new Date(detailsBusiness.subscription_expires_at).toLocaleDateString("el-GR", {
                                  weekday: "long",
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                })}
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground">Δεν έχει οριστεί ημερομηνία</p>
                            )}
                            <Badge variant="outline" className={cn("mt-1 w-fit border font-medium", expiryBadge.className)}>
                              {expiryBadge.label}
                            </Badge>
                            {user?.role === "super_admin" && detailsBusiness.subscription_plan !== "demo" && (
                              <div className="flex flex-wrap items-center gap-2 pt-2">
                                <Input
                                  type="date"
                                  className="h-9 w-full sm:max-w-[180px] rounded-lg border-border/60 bg-background/90"
                                  value={detailsExpiryDate}
                                  onChange={(e) => setDetailsExpiryDate(e.target.value)}
                                />
                                <Button
                                  size="sm"
                                  className="rounded-lg"
                                  variant="secondary"
                                  onClick={handleUpdateExpiry}
                                  disabled={updatingExpiry || !detailsExpiryDate}
                                >
                                  {updatingExpiry ? "Αποθήκευση..." : "Ενημέρωση λήξης"}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                        Δημιουργήθηκε: {new Date(detailsBusiness.created_at).toLocaleString("el-GR")}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-border/50 bg-card/90 shadow-sm backdrop-blur-sm">
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-3">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base font-semibold">
                          <Users className="h-4 w-4 text-primary" />
                          Χρήστες tenant
                        </CardTitle>
                        <CardDescription>Διαχειριστές και μέλη της επιχείρησης</CardDescription>
                      </div>
                      <Button size="sm" className="gap-1.5 rounded-full shadow-sm" onClick={() => setAddAdminOpen(true)}>
                        <UserPlus className="h-4 w-4" />
                        Προσθήκη
                      </Button>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {detailsLoading ? (
                        <Skeleton className="h-28 w-full rounded-xl" />
                      ) : detailsUsers.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                          Δεν υπάρχουν χρήστες. Προσθέστε τον πρώτο διαχειριστή.
                        </p>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-border/50">
                          <Table>
                            <TableHeader>
                              <TableRow className="border-border/50 hover:bg-transparent">
                                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ονοματεπώνυμο</TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Username</TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ρόλος</TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Κατάσταση</TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Δημιουργία</TableHead>
                                <TableHead className="w-0" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {detailsUsers.map((u) => (
                                <TableRow key={u.id} className="border-border/40">
                                  <TableCell className="font-medium">{u.full_name}</TableCell>
                                  <TableCell className="font-mono text-xs">{u.username ?? "—"}</TableCell>
                                  <TableCell>
                                    <Badge variant="secondary" className="rounded-md font-normal">
                                      {u.role}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-sm">{u.status}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {new Date(u.created_at).toLocaleDateString("el-GR")}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    <div className="flex flex-wrap justify-end gap-1.5">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 rounded-lg text-xs"
                                        onClick={() => handleRepairUser(u.username)}
                                        disabled={!u.username}
                                      >
                                        Επιδιόρθωση
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        className="h-8 rounded-lg text-xs"
                                        onClick={() => handleDeleteUser(u.id)}
                                      >
                                        Διαγραφή
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-destructive/25 bg-destructive/[0.04] shadow-sm backdrop-blur-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base font-semibold text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                        Επικίνδυνη ζώνη
                      </CardTitle>
                      <CardDescription className="text-destructive/80">
                        Η διαγραφή επιχείρησης είναι οριστική και αφαιρεί όλα τα δεδομένα.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        type="button"
                        variant="destructive"
                        className="w-full rounded-xl shadow-sm sm:w-auto"
                        onClick={() => handleDeleteBusiness(detailsBusiness.id, detailsBusiness.name)}
                      >
                        Διαγραφή επιχείρησης
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </>
            )
          })()}
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
