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
import { fetchDashboardStats, fetchServiceReminders, fetchWorkingStaffToday } from "@/services/api"
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
import { useLanguage, type AppLanguage } from "@/contexts/LanguageContext"
import { pickLang, appLocaleTag } from "@/lib/app-language"

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

function timeOfDayGreeting(lang: AppLanguage): string {
  const h = new Date().getHours()
  const morning = h >= 5 && h < 15
  if (lang === "en") return morning ? "Good morning" : "Good evening"
  if (lang === "de") return morning ? "Guten Morgen" : "Guten Abend"
  return morning ? "Καλημέρα" : "Καλησπέρα"
}

export default function Dashboard() {
  const { businessId, user } = useAuth()
  const { language } = useLanguage()
  const canAccessFinancials = user?.role !== "employee" && user?.role !== "reception"
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
  const [workingToday, setWorkingToday] = useState<Array<{ user_id: string; full_name: string; start_time: string | null; end_time: string | null }>>([])

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
        const rows = await fetchWorkingStaffToday(businessId, today)
        if (!cancelled) setWorkingToday(rows)
      } catch {
        if (!cancelled) setWorkingToday([])
      }
    })()
    return () => {
      cancelled = true
    }
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
            customerName: r.customer
              ? `${r.customer.first_name} ${r.customer.last_name}`
              : pickLang(language, { el: "Πελάτης", en: "Customer", de: "Kunde" }),
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
      {
        key: "services",
        label: pickLang(language, { el: "Πρόσθεσε υπηρεσίες", en: "Add services", de: "Leistungen hinzufügen" }),
        done: setupCounts.services > 0,
        countLabel: `${setupCounts.services}`,
        to: "/services",
        icon: Briefcase,
      },
      {
        key: "team",
        label: pickLang(language, { el: "Έλεγξε την ομάδα", en: "Review team", de: "Team prüfen" }),
        done: setupCounts.team > 0,
        countLabel: `${setupCounts.team}`,
        to: "/team",
        icon: UsersIcon,
      },
      {
        key: "customers",
        label: pickLang(language, { el: "Πρόσθεσε πελάτες", en: "Add customers", de: "Kunden hinzufügen" }),
        done: setupCounts.customers > 0,
        countLabel: `${setupCounts.customers}`,
        to: "/customers",
        icon: UserIcon,
      },
      {
        key: "appointments",
        label: pickLang(language, { el: "Δημιούργησε ραντεβού", en: "Create appointments", de: "Termine anlegen" }),
        done: setupCounts.appointments > 0,
        countLabel: `${setupCounts.appointments}`,
        to: "/appointments",
        icon: Calendar,
      },
    ] as const
    const completed = items.filter((i) => i.done).length
    return { items, completed, total: items.length }
  }, [setupCounts, language])
  const showQuickSetup = setupLoading || setupItems.completed < setupItems.total

  const quickSetupDesc = pickLang(language, {
    el: "Ολοκλήρωσε τα βασικά βήματα για να εκμεταλλευτείς πλήρως την πλατφόρμα.",
    en: "Complete the basic steps to get full value from the platform.",
    de: "Schließen Sie die Grundschritte ab, um die Plattform voll zu nutzen.",
  })

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-2xl md:text-[26px] font-semibold tracking-tight">Dashboard</h1>
              {greetAs ? (
                <span className="text-sm md:text-base font-medium text-muted-foreground">
                  {timeOfDayGreeting(language)}, <span className="text-foreground">{greetAs}</span>
                </span>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {pickLang(language, { el: "Επισκόπηση επιχείρησης", en: "Business overview", de: "Unternehmensübersicht" })}
            </p>
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
      title: pickLang(language, { el: "Ραντεβού σήμερα", en: "Today's appointments", de: "Heutige Termine" }),
      value: stats?.todayAppointments ?? 0,
      icon: Calendar,
      color: "text-primary",
      badge: pickLang(language, { el: "+12% από χθες", en: "+12% vs yesterday", de: "+12% vs. gestern" }),
      badgeColor: "text-emerald-500 bg-emerald-500/10",
    },
    {
      title: pickLang(language, { el: "Εκκρεμή εργασίες", en: "Pending jobs", de: "Ausstehende Aufträge" }),
      value: stats?.pendingJobs ?? 0,
      icon: Clock,
      color: "text-orange-500",
      badge: pickLang(language, { el: "Σε εκκρεμότητα", en: "Pending", de: "Ausstehend" }),
      badgeColor: "text-amber-500 bg-amber-500/10",
    },
    {
      title: pickLang(language, { el: "Σε εξέλιξη", en: "In progress", de: "In Bearbeitung" }),
      value: stats?.inProgressJobs ?? 0,
      icon: AlertCircle,
      color: "text-purple-500",
      badge: pickLang(language, { el: "Ζωντανές εργασίες", en: "Live jobs", de: "Laufende Aufträge" }),
      badgeColor: "text-purple-500 bg-purple-500/10",
    },
    {
      title: pickLang(language, { el: "Ολοκληρωμένα σήμερα", en: "Completed today", de: "Heute abgeschlossen" }),
      value: stats?.completedToday ?? 0,
      icon: CheckCircle2,
      color: "text-green-500",
      badge: pickLang(language, { el: "Ολοκληρώθηκαν", en: "Completed", de: "Abgeschlossen" }),
      badgeColor: "text-emerald-600 bg-emerald-600/10",
    },
    {
      title: pickLang(language, { el: "Έσοδα σήμερα", en: "Revenue today", de: "Umsatz heute" }),
      value: formatCurrency(stats?.revenueToday ?? 0),
      icon: Euro,
      color: "text-emerald-600",
      badge: pickLang(language, { el: "Σημερινά έσοδα", en: "Today's revenue", de: "Umsatz heute" }),
      badgeColor: "text-emerald-500 bg-emerald-500/10",
      isFinancial: true,
    },
    {
      title: pickLang(language, { el: "Έσοδα μήνα", en: "Monthly revenue", de: "Umsatz Monat" }),
      value: formatCurrency(stats?.revenueMonth ?? 0),
      icon: TrendingUp,
      color: "text-blue-500",
      badge: pickLang(language, { el: "Τρέχων μήνας", en: "Current month", de: "Aktueller Monat" }),
      badgeColor: "text-blue-500 bg-blue-500/10",
      isFinancial: true,
    },
    {
      title: pickLang(language, { el: "Εκκρεμή υπόλοιπα", en: "Outstanding balances", de: "Offene Salden" }),
      value: formatCurrency(stats?.outstandingBalances ?? 0),
      icon: Euro,
      color: "text-amber-600",
      badge: pickLang(language, { el: "Υπόλοιπα", en: "Balances", de: "Salden" }),
      badgeColor: "text-amber-600 bg-amber-600/10",
      isFinancial: true,
    },
  ]
  const visibleCards = cards.filter((card) => canAccessFinancials || !card.isFinancial)

  const chartData = [
    {
      name: pickLang(language, { el: "Δευ", en: "Mon", de: "Mo" }),
      value: stats?.revenueToday ? Math.round(stats.revenueToday * 0.3) : 0,
    },
    {
      name: pickLang(language, { el: "Τρι", en: "Tue", de: "Di" }),
      value: stats?.revenueToday ? Math.round(stats.revenueToday * 0.5) : 0,
    },
    {
      name: pickLang(language, { el: "Τετ", en: "Wed", de: "Mi" }),
      value: stats?.revenueToday ? Math.round(stats.revenueToday * 0.8) : 0,
    },
    {
      name: pickLang(language, { el: "Πεμ", en: "Thu", de: "Do" }),
      value: stats?.revenueToday ?? 0,
    },
    {
      name: pickLang(language, { el: "Παρ", en: "Fri", de: "Fr" }),
      value: stats?.revenueToday ? Math.round(stats.revenueToday * 1.2) : 0,
    },
    {
      name: pickLang(language, { el: "Σαβ", en: "Sat", de: "Sa" }),
      value: stats?.revenueToday ? Math.round(stats.revenueToday * 0.6) : 0,
    },
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
                {timeOfDayGreeting(language)}, <span className="text-foreground">{greetAs}</span>
              </span>
            ) : null}
          </div>
          <p className="text-xs md:text-sm text-muted-foreground">
            {pickLang(language, {
              el: "Premium επισκόπηση της επιχείρησής σου.",
              en: "Premium overview of your business.",
              de: "Premium-Übersicht Ihres Unternehmens.",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center rounded-full border border-border/60 bg-card/60 px-2.5 py-0.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 mr-2" />
            {pickLang(language, { el: "Σε πραγματικό χρόνο", en: "Real-time", de: "Echtzeit" })}
          </span>
        </div>
      </div>

      {showQuickSetup ? (
        <motion.div variants={item}>
          <Card className="border-border/60 bg-card/60">
            <CardHeader className="space-y-1 pb-3">
              <CardTitle className="flex items-center justify-between gap-2 text-sm">
                <span className="inline-flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-primary" />
                  <span>{pickLang(language, { el: "Γρήγορο setup", en: "Quick setup", de: "Schnellstart" })}</span>
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {setupItems.completed}/{setupItems.total}{" "}
                  {pickLang(language, { el: "ολοκληρωμένα", en: "completed", de: "erledigt" })}
                </span>
              </CardTitle>
              <CardDescription className="text-[11px]">{quickSetupDesc}</CardDescription>
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
                              {pickLang(language, { el: "Σύνολο", en: "Total", de: "Gesamt" })}: {it.countLabel}
                            </div>
                          </div>
                        </div>
                        <span className={it.done ? "text-[11px] text-emerald-600" : "text-[11px] text-muted-foreground"}>
                          {it.done ? "OK" : pickLang(language, { el: "Εκκρεμεί", en: "Pending", de: "Ausstehend" })}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5 text-xs">
                <Button asChild variant="outline" size="sm">
                  <Link to="/appointments">
                    {pickLang(language, { el: "Νέο ραντεβού", en: "New appointment", de: "Neuer Termin" })}
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/services">
                    {pickLang(language, { el: "Νέα υπηρεσία", en: "New service", de: "Neue Leistung" })}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : null}

      <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-4">
        {visibleCards.map((c) => (
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
            <CardTitle>
              {pickLang(language, {
                el: "Υπενθυμίσεις Συντήρησης",
                en: "Service Reminders",
                de: "Wartungs-Erinnerungen",
              })}
            </CardTitle>
            <CardDescription>
              {pickLang(language, { el: "Επόμενες υπενθυμίσεις", en: "Upcoming reminders", de: "Bevorstehende Erinnerungen" })}:{" "}
              {upcomingServiceReminders.length} •{" "}
              {pickLang(language, { el: "Εκπρόθεσμες", en: "Overdue", de: "Überfällig" })}: {overdueServiceReminders}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingServiceReminders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {pickLang(language, {
                  el: "Δεν υπάρχουν upcoming service reminders.",
                  en: "No upcoming service reminders.",
                  de: "Keine bevorstehenden Wartungs-Erinnerungen.",
                })}
              </p>
            ) : (
              upcomingServiceReminders.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                  <span className="text-sm">{r.customerName}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.dueDate).toLocaleDateString(appLocaleTag(language))}
                  </span>
                </div>
              ))
            )}
            <div className="pt-1">
              <Button asChild size="sm" variant="outline">
                <Link to="/service-reminders">
                  {pickLang(language, { el: "Άνοιγμα υπενθυμίσεων", en: "Open reminders", de: "Erinnerungen öffnen" })}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <CardTitle>
              {pickLang(language, { el: "Ποιος δουλεύει σήμερα", en: "Who's working today", de: "Wer arbeitet heute" })}
            </CardTitle>
            <CardDescription>
              {workingToday.length}{" "}
              {pickLang(language, { el: "μέλη σε βάρδια", en: "members on shift", de: "Mitglieder in Schicht" })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {workingToday.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {pickLang(language, {
                  el: "Δεν έχουν οριστεί ενεργές βάρδιες για σήμερα.",
                  en: "No active shifts are scheduled for today.",
                  de: "Für heute sind keine aktiven Schichten geplant.",
                })}
              </p>
            ) : (
              workingToday.slice(0, 6).map((w) => (
                <div key={w.user_id} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                  <span className="text-sm">{w.full_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(w.start_time ?? "--:--").slice(0, 5)} - {(w.end_time ?? "--:--").slice(0, 5)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </motion.div>

      {canAccessFinancials ? (
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle>
                {pickLang(language, { el: "Έσοδα εβδομάδας", en: "Weekly revenue", de: "Wochenumsatz" })}
              </CardTitle>
              <CardDescription>
                {pickLang(language, { el: "Προσομοίωση δεδομένων", en: "Data simulation", de: "Daten-Simulation" })}
              </CardDescription>
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
                      formatter={(value: number) => [
                        formatCurrency(value),
                        pickLang(language, { el: "Έσοδα", en: "Revenue", de: "Umsatz" }),
                      ]}
                    />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : null}
    </motion.div>
  )
}
