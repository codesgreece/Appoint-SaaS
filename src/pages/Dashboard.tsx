import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  Calendar,
  Clock,
  CheckCircle2,
  Euro,
  TrendingUp,
  AlertCircle,
  ListChecks,
  Users as UsersIcon,
  Briefcase,
  User as UserIcon,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { fetchDashboardStats, fetchServiceReminders } from "@/services/api"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { Link } from "react-router-dom"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"
import { ChangelogCard } from "@/components/ChangelogCard"

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
}

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
}

function dashboardGreetingName(user: { username: string | null; full_name: string } | null): string | null {
  const u = user?.username?.trim()
  if (u) return u
  const n = user?.full_name?.trim()
  return n || null
}

/** Τοπική ώρα: Καλημέρα (πρωί–μεσημέρι), Καλησπέρα (απόγευμα–νύχτα). */
function timeOfDayGreetingGr(): "Καλημέρα" | "Καλησπέρα" {
  const h = new Date().getHours()
  if (h >= 5 && h < 15) return "Καλημέρα"
  return "Καλησπέρα"
}

export default function Dashboard() {
  const { businessId, user } = useAuth()
  const greetAs = dashboardGreetingName(user)
  const [stats, setStats] = useState<Awaited<ReturnType<typeof fetchDashboardStats>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [setupLoading, setSetupLoading] = useState(true)
  const [setupCounts, setSetupCounts] = useState<{ services: number; team: number; customers: number; appointments: number }>({
    services: 0,
    team: 0,
    customers: 0,
    appointments: 0,
  })
  const [upcomingServiceReminders, setUpcomingServiceReminders] = useState<{ id: string; customerName: string; dueDate: string }[]>([])
  const [overdueServiceReminders, setOverdueServiceReminders] = useState(0)

  useEffect(() => {
    if (!businessId) return
    fetchDashboardStats(businessId)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [businessId])

  useEffect(() => {
    if (!businessId) return
    let cancelled = false
    ;(async () => {
      try {
        const today = new Date().toISOString().slice(0, 10)
        const rows = await fetchServiceReminders(businessId, { status: "pending" })
        if (cancelled) return
        const overdue = rows.filter((r) => r.due_date < today).length
        const upcoming = rows
          .filter((r) => r.due_date >= today)
          .slice(0, 5)
          .map((r) => ({
            id: r.id,
            customerName: r.customer ? `${r.customer.first_name} ${r.customer.last_name}` : "Πελάτης",
            dueDate: r.due_date,
          }))
        setOverdueServiceReminders(overdue)
        setUpcomingServiceReminders(upcoming)
      } catch {
        if (!cancelled) {
          setOverdueServiceReminders(0)
          setUpcomingServiceReminders([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [businessId])

  useEffect(() => {
    if (!businessId) return
    let cancelled = false
    async function loadSetup() {
      try {
        setSetupLoading(true)
        const [{ count: services }, { count: team }, { count: customers }, { count: appointments }] = await Promise.all([
          supabase.from("services").select("id", { count: "exact", head: true }),
          supabase.from("users").select("id", { count: "exact", head: true }),
          supabase.from("customers").select("id", { count: "exact", head: true }),
          supabase.from("appointments_jobs").select("id", { count: "exact", head: true }),
        ])
        if (cancelled) return
        setSetupCounts({
          services: services ?? 0,
          team: team ?? 0,
          customers: customers ?? 0,
          appointments: appointments ?? 0,
        })
      } finally {
        if (!cancelled) setSetupLoading(false)
      }
    }
    loadSetup()
    return () => { cancelled = true }
  }, [businessId])

  const setupItems = useMemo(() => {
    const items = [
      { key: "services", label: "Πρόσθεσε υπηρεσίες", done: setupCounts.services > 0, countLabel: `${setupCounts.services}`, to: "/services", icon: Briefcase },
      { key: "team", label: "Έλεγξε την ομάδα", done: setupCounts.team > 0, countLabel: `${setupCounts.team}`, to: "/team", icon: UsersIcon },
      { key: "customers", label: "Πρόσθεσε πελάτες", done: setupCounts.customers > 0, countLabel: `${setupCounts.customers}`, to: "/customers", icon: UserIcon },
      { key: "appointments", label: "Δημιούργησε ραντεβού", done: setupCounts.appointments > 0, countLabel: `${setupCounts.appointments}`, to: "/appointments", icon: Calendar },
    ] as const
    const completed = items.filter((i) => i.done).length
    return { items, completed, total: items.length }
  }, [setupCounts])

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-2xl md:text-[26px] font-semibold tracking-tight">Dashboard</h1>
              {greetAs ? (
                <span className="text-sm md:text-base font-medium text-muted-foreground">
                  {timeOfDayGreetingGr()}, <span className="text-foreground">{greetAs}</span>
                </span>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">Επισκόπηση επιχείρησης</p>
          </div>
          <Skeleton className="h-9 w-32 rounded-full" />
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-3 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-7 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const cards = [
    {
      title: "Ραντεβού σήμερα",
      value: stats?.todayAppointments ?? 0,
      icon: Calendar,
      color: "text-primary",
      badge: "+12% από χθες",
      badgeColor: "text-emerald-500 bg-emerald-500/10",
    },
    {
      title: "Εκκρεμή εργασίες",
      value: stats?.pendingJobs ?? 0,
      icon: Clock,
      color: "text-orange-500",
      badge: "Σε εκκρεμότητα",
      badgeColor: "text-amber-500 bg-amber-500/10",
    },
    {
      title: "Σε εξέλιξη",
      value: stats?.inProgressJobs ?? 0,
      icon: AlertCircle,
      color: "text-purple-500",
      badge: "Ζωντανές εργασίες",
      badgeColor: "text-purple-500 bg-purple-500/10",
    },
    {
      title: "Ολοκληρωμένα σήμερα",
      value: stats?.completedToday ?? 0,
      icon: CheckCircle2,
      color: "text-green-500",
      badge: "Ολοκληρώθηκαν",
      badgeColor: "text-emerald-600 bg-emerald-600/10",
    },
    {
      title: "Έσοδα σήμερα",
      value: formatCurrency(stats?.revenueToday ?? 0),
      icon: Euro,
      color: "text-emerald-600",
      badge: "Σημερινά έσοδα",
      badgeColor: "text-emerald-500 bg-emerald-500/10",
    },
    {
      title: "Έσοδα μήνα",
      value: formatCurrency(stats?.revenueMonth ?? 0),
      icon: TrendingUp,
      color: "text-blue-500",
      badge: "Τρέχων μήνας",
      badgeColor: "text-blue-500 bg-blue-500/10",
    },
    {
      title: "Εκκρεμή υπόλοιπα",
      value: formatCurrency(stats?.outstandingBalances ?? 0),
      icon: Euro,
      color: "text-amber-600",
      badge: "Υπόλοιπα",
      badgeColor: "text-amber-600 bg-amber-600/10",
    },
  ]

  const chartData = [
    { name: "Δευ", value: stats?.revenueToday ? Math.round(stats.revenueToday * 0.3) : 0 },
    { name: "Τρι", value: stats?.revenueToday ? Math.round(stats.revenueToday * 0.5) : 0 },
    { name: "Τετ", value: stats?.revenueToday ? Math.round(stats.revenueToday * 0.8) : 0 },
    { name: "Πεμ", value: stats?.revenueToday ?? 0 },
    { name: "Παρ", value: stats?.revenueToday ? Math.round(stats.revenueToday * 1.2) : 0 },
    { name: "Σαβ", value: stats?.revenueToday ? Math.round(stats.revenueToday * 0.6) : 0 },
  ]

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-2xl md:text-[26px] font-semibold tracking-tight bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
              Dashboard
            </h1>
            {greetAs ? (
              <span className="text-sm md:text-base font-medium text-muted-foreground">
                {timeOfDayGreetingGr()}, <span className="text-foreground">{greetAs}</span>
              </span>
            ) : null}
          </div>
          <p className="text-xs md:text-sm text-muted-foreground">Premium επισκόπηση της επιχείρησής σου.</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center rounded-full border border-border/60 bg-card/60 px-2.5 py-0.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 mr-2" />
            Σε πραγματικό χρόνο
          </span>
        </div>
      </div>

      <motion.div variants={item}>
        <Card className="border-border/60 bg-card/60">
          <CardHeader className="space-y-1 pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-sm">
              <span className="inline-flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-primary" />
                <span>Γρήγορο setup</span>
              </span>
              <span className="text-[11px] text-muted-foreground">
                {setupItems.completed}/{setupItems.total} ολοκληρωμένα
              </span>
            </CardTitle>
            <CardDescription className="text-[11px]">
              Ολοκλήρωσε τα βασικά βήματα για να εκμεταλλευτείς πλήρως την πλατφόρμα.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary via-primary/80 to-emerald-500 transition-all"
                style={{ width: `${(setupItems.completed / Math.max(1, setupItems.total)) * 100}%` }}
              />
            </div>
            {setupLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {setupItems.items.map((it) => (
                  <Link
                    key={it.key}
                    to={it.to}
                    className="rounded-lg border border-border/60 bg-card/80 px-3 py-2.5 hover:bg-accent/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <it.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-medium leading-snug">{it.label}</div>
                          <div className="text-[11px] text-muted-foreground">
                            Σύνολο: {it.countLabel}
                          </div>
                        </div>
                      </div>
                      <span className={it.done ? "text-[11px] text-emerald-600" : "text-[11px] text-muted-foreground"}>
                        {it.done ? "ΟΚ" : "Εκκρεμεί"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 text-xs">
              <Button asChild variant="outline" size="sm">
                <Link to="/appointments">Νέο ραντεβού</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/services">Νέα υπηρεσία</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <motion.div key={c.title} variants={item}>
            <Card className="border-border/60 bg-card/60 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
                <CardTitle className="text-[11px] font-medium text-muted-foreground">
                  {c.title}
                </CardTitle>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-3xl md:text-[32px] font-semibold tracking-tight">{c.value}</div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${c.badgeColor}`}
                  >
                    {c.badge}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div variants={item}>
        <ChangelogCard compact />
      </motion.div>

      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle>Υπενθυμίσεις Συντήρησης</CardTitle>
            <CardDescription>
              Επόμενες υπενθυμίσεις: {upcomingServiceReminders.length} • Εκπρόθεσμες: {overdueServiceReminders}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingServiceReminders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Δεν υπάρχουν upcoming service reminders.</p>
            ) : (
              upcomingServiceReminders.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                  <span className="text-sm">{r.customerName}</span>
                  <span className="text-xs text-muted-foreground">{new Date(r.dueDate).toLocaleDateString("el-GR")}</span>
                </div>
              ))
            )}
            <div className="pt-1">
              <Button asChild size="sm" variant="outline">
                <Link to="/service-reminders">Άνοιγμα υπενθυμίσεων</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle>Έσοδα εβδομάδας</CardTitle>
            <CardDescription>Προσομοίωση δεδομένων</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }}
                    formatter={(value: number) => [formatCurrency(value), "Έσοδα"]}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
