import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  LayoutDashboard,
  Users,
  Calendar,
  CalendarDays,
  UserCircle,
  BarChart3,
  Settings,
  Briefcase,
  LifeBuoy,
  Menu,
  LogOut,
  Building2,
  Bot,
  Apple,
  Monitor,
  Wrench,
  Route,
  Lock,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useTheme } from "@/components/theme-provider"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { useLanguage, type AppLanguage } from "@/contexts/LanguageContext"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { appLocaleTag, pickLang } from "@/lib/app-language"
import { StaffPresenceLeds } from "@/components/layout/StaffPresenceLeds"
import { useStaffPresence } from "@/hooks/useStaffPresence"
import { CommandPalette } from "@/components/CommandPalette"
import { NotificationBell } from "@/components/notifications/NotificationBell"

const translations = {
  el: {
    navDashboard: "Dashboard",
    navCustomers: "Πελάτες",
    navServices: "Υπηρεσίες / Αποθήκη",
    navAppointments: "Ραντεβού",
    navRouteOrder: "Ημερ. Διαδρομή",
    navReminders: "Υπενθυμίσεις",
    navCalendar: "Ημερολόγιο",
    navTeam: "Ομάδα & Βάρδιες",
    navReports: "Αναφορές & Πληρωμές",
    navSupport: "Υποστήριξη",
    navSettings: "Ρυθμίσεις & Στοιχεία",
    navPlatformOverview: "Επισκόπηση πλατφόρμας",
    navPlatformBusinesses: "Επιχειρήσεις",
    navPlatformPlans: "Πλάνα & Όρια",
    navPlatformUsers: "Χρήστες πλατφόρμας",
    navPlatformTools: "Εργαλεία υποστήριξης",
    availableOn: "Διαθέσιμο σε",
    business: "Επιχείρηση",
    myBusiness: "Η επιχείρησή μου",
    platformManagement: "Διαχείριση πλατφόρμας",
    settings: "Ρυθμίσεις",
    signOut: "Αποσύνδεση",
    expiredTitle: "Η συνδρομή έχει λήξει",
    expiredDescription: "Επικοινωνήστε με τον διαχειριστή για ανανέωση του panel.",
    expiredSignOut: "Αποσύνδεση",
    remainingPrefix: "Υπολείπονται",
    remainingSuffix: "ημέρες στη συνδρομή",
    expiresOn: "λήξη",
  },
  de: {
    navDashboard: "Dashboard",
    navCustomers: "Kunden",
    navServices: "Leistungen / Lager",
    navAppointments: "Termine",
    navRouteOrder: "Tagesroute",
    navReminders: "Erinnerungen",
    navCalendar: "Kalender",
    navTeam: "Team & Schichten",
    navReports: "Berichte & Zahlungen",
    navSupport: "Support",
    navSettings: "Einstellungen & Daten",
    navPlatformOverview: "Plattform-Übersicht",
    navPlatformBusinesses: "Unternehmen",
    navPlatformPlans: "Pläne & Limits",
    navPlatformUsers: "Plattform-Benutzer",
    navPlatformTools: "Support-Tools",
    availableOn: "Verfügbar am",
    business: "Unternehmen",
    myBusiness: "Mein Unternehmen",
    platformManagement: "Plattform-Verwaltung",
    settings: "Einstellungen",
    signOut: "Abmelden",
    expiredTitle: "Abonnement abgelaufen",
    expiredDescription: "Wenden Sie sich an Ihren Administrator, um das Panel zu verlängern.",
    expiredSignOut: "Abmelden",
    remainingPrefix: "Noch",
    remainingSuffix: "Tage im Abonnement",
    expiresOn: "Ende",
  },
  en: {
    navDashboard: "Dashboard",
    navCustomers: "Customers",
    navServices: "Services / Warehouse",
    navAppointments: "Appointments",
    navRouteOrder: "Daily Route",
    navReminders: "Reminders",
    navCalendar: "Calendar",
    navTeam: "Team & Shifts",
    navReports: "Reports & Payments",
    navSupport: "Support",
    navSettings: "Settings & Details",
    navPlatformOverview: "Platform Overview",
    navPlatformBusinesses: "Businesses",
    navPlatformPlans: "Plans & Limits",
    navPlatformUsers: "Platform Users",
    navPlatformTools: "Support Tools",
    availableOn: "Available on",
    business: "Business",
    myBusiness: "My Business",
    platformManagement: "Platform Management",
    settings: "Settings",
    signOut: "Sign out",
    expiredTitle: "Subscription expired",
    expiredDescription: "Contact your administrator to renew the panel.",
    expiredSignOut: "Sign out",
    remainingPrefix: "Remaining",
    remainingSuffix: "days in subscription",
    expiresOn: "expires",
  },
} as const

function getBusinessNavItems(language: AppLanguage) {
  const t = translations[language]
  return [
    { to: "/", icon: LayoutDashboard, label: t.navDashboard },
    { to: "/customers", icon: Users, label: t.navCustomers },
    { to: "/services", icon: Briefcase, label: t.navServices },
    { to: "/appointments", icon: Calendar, label: t.navAppointments },
    { to: "/route-order", icon: Route, label: t.navRouteOrder },
    { to: "/service-reminders", icon: Wrench, label: t.navReminders },
    { to: "/calendar", icon: CalendarDays, label: t.navCalendar },
    { to: "/team", icon: UserCircle, label: t.navTeam },
    { to: "/reports", icon: BarChart3, label: t.navReports },
    { to: "/support", icon: LifeBuoy, label: t.navSupport },
    { to: "/settings", icon: Settings, label: t.navSettings },
  ]
}

function hasFinancialAccess(role: string | undefined): boolean {
  return role !== "employee" && role !== "reception"
}

function getPlatformNavItems(language: AppLanguage) {
  const t = translations[language]
  return [
    { to: "/platform/overview", icon: LayoutDashboard, label: t.navPlatformOverview },
    { to: "/platform/businesses", icon: Users, label: t.navPlatformBusinesses },
    { to: "/platform/plans", icon: BarChart3, label: t.navPlatformPlans },
    { to: "/platform/users", icon: UserCircle, label: t.navPlatformUsers },
    { to: "/platform/tools", icon: Settings, label: t.navPlatformTools },
  ]
}

function planLabelGr(plan: string | null): string {
  const m: Record<string, string> = {
    starter: "Starter",
    pro: "Pro",
    premium: "Premium",
    premium_plus: "Premium+",
    demo: "Demo",
    lifetime: "Εφάπαξ",
    unsubscribed: "—",
  }
  return plan ? m[plan] ?? plan : "—"
}

function daysUntilSubscriptionEnd(iso: string | null): number | null {
  if (!iso) return null
  const end = new Date(iso).getTime()
  if (Number.isNaN(end)) return null
  return Math.max(0, Math.ceil((end - Date.now()) / 86400000))
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { language, setLanguage } = useLanguage()
  const {
    user,
    signOut,
    businessName,
    businessId,
    tenantSubscriptionPlan,
    tenantSubscriptionExpiresAt,
    tenantSubscriptionLoaded,
  } = useAuth()
  useTheme()

  const { mode, setMode } = useWorkspace()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [openSupportCount, setOpenSupportCount] = useState<number | null>(null)
  const [publicBookingUnreadCount, setPublicBookingUnreadCount] = useState<number | null>(null)
  const staffPresence = useStaffPresence(businessId)
  const t = translations[language]
  const businessNavItems = getBusinessNavItems(language)
  const platformNavItems = getPlatformNavItems(language)
  const canAccessFinancials = hasFinancialAccess(user?.role)

  const isExpiredSubscription =
    user?.role !== "super_admin" &&
    tenantSubscriptionLoaded &&
    tenantSubscriptionPlan !== "demo" &&
    tenantSubscriptionPlan !== "lifetime" &&
    Boolean(tenantSubscriptionExpiresAt) &&
    new Date(tenantSubscriptionExpiresAt as string).getTime() < Date.now()

  useEffect(() => {
    if (isExpiredSubscription) {
      setCommandOpen(false)
    }
  }, [isExpiredSubscription])

  useEffect(() => {
    if (!isExpiredSubscription) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [isExpiredSubscription])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isExpiredSubscription) return
      const isK = e.key.toLowerCase() === "k"
      if ((e.ctrlKey || e.metaKey) && isK) {
        e.preventDefault()
        setCommandOpen(true)
      }
      if (e.key === "Escape") setCommandOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isExpiredSubscription])

  useEffect(() => {
    let active = true
    if (!user || user.role !== "super_admin" || mode !== "platform") {
      setOpenSupportCount(null)
      return
    }
    async function loadCount() {
      const { count } = await supabase
        .from("support_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
      return count ?? 0
    }
    ;(async () => {
      try {
        const c = await loadCount()
        if (!active) return
        setOpenSupportCount(c)
      } catch {
        if (active) setOpenSupportCount(null)
      }
    })()
    const t = window.setInterval(() => {
      ;(async () => {
        try {
          if (!active) return
          const c = await loadCount()
          if (!active) return
          setOpenSupportCount(c)
        } catch {
          // ignore
        }
      })()
    }, 20000)
    return () => {
      active = false
      window.clearInterval(t)
    }
  }, [user, mode])

  useEffect(() => {
    let active = true
    if (!user || user.role === "super_admin" || mode !== "business" || !user.business_id) {
      setPublicBookingUnreadCount(null)
      return
    }
    const businessId = user.business_id
    async function loadCount() {
      const { count } = await supabase
        .from("appointments_jobs")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("public_booking_unread", true)
      return count ?? 0
    }
    ;(async () => {
      try {
        const c = await loadCount()
        if (!active) return
        setPublicBookingUnreadCount(c)
      } catch {
        if (active) setPublicBookingUnreadCount(null)
      }
    })()
    const t = window.setInterval(() => {
      ;(async () => {
        try {
          if (!active) return
          const c = await loadCount()
          if (!active) return
          setPublicBookingUnreadCount(c)
        } catch {
          // ignore
        }
      })()
    }, 20000)
    return () => {
      active = false
      window.clearInterval(t)
    }
  }, [user, mode])

  async function handleSignOut() {
    await signOut()
    navigate("/login", { replace: true })
  }

  return (
    <div className="relative min-h-screen flex bg-background">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-1/3 -right-24 h-72 w-72 rounded-full bg-purple-500/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>
      <CommandPalette open={commandOpen && !isExpiredSubscription} onOpenChange={setCommandOpen} />
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-72 border-r border-border/60 bg-background/70 backdrop-blur-2xl transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between px-3 border-b border-border/60 lg:justify-center">
          <Link to="/" className="font-semibold text-lg tracking-tight">
            <span className="bg-gradient-to-r from-primary via-primary to-purple-500 bg-clip-text text-transparent">
              Appoint SaaS
            </span>
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex flex-col gap-1.5 p-2.5">
          {(() => {
            if (user?.role === "super_admin" && mode === "platform") return platformNavItems
            return businessNavItems.filter((item) => canAccessFinancials || (item.to !== "/reports" && item.to !== "/payments"))
          })().map((item) => {
            const isActive =
              location.pathname === item.to ||
              (item.to.length > 1 && location.pathname.startsWith(`${item.to}/`))
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs md:text-sm font-medium transition-colors transition-transform duration-150",
                  isActive
                    ? "bg-gradient-to-r from-primary/15 via-primary/5 to-transparent text-foreground shadow-md ring-1 ring-primary/40"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground hover:translate-x-0.5"
                )}
              >
                <span
                  className={cn(
                    "absolute left-0 top-1/2 h-7 w-1.5 -translate-y-1/2 rounded-r-full bg-primary/80 blur-[1px] transition-opacity",
                    isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60",
                  )}
                />
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-muted-foreground transition-colors",
                    isActive && "bg-primary/20 text-primary"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                </div>
                <span className="min-w-0 flex-1 whitespace-nowrap text-[13px] leading-snug md:text-sm">
                  {item.label}
                </span>
                {item.to === "/platform/tools" && openSupportCount != null && openSupportCount > 0 ? (
                  <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-2 text-[11px] font-semibold text-primary">
                    {openSupportCount}
                  </span>
                ) : null}
                {item.to === "/appointments" && publicBookingUnreadCount != null && publicBookingUnreadCount > 0 ? (
                  <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-2 text-[11px] font-semibold text-primary">
                    {publicBookingUnreadCount}
                  </span>
                ) : null}
              </Link>
            )
          })}
          {(user?.role !== "super_admin" || mode === "business") && (
            <div className="mt-1 rounded-xl border border-border/60 bg-card/60 px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.availableOn}</p>
              <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-3">
                <span className="inline-flex w-full items-center justify-center gap-1 rounded-full border border-border/60 bg-background/60 px-1.5 py-1 text-[10px] text-muted-foreground">
                  <Bot className="h-3 w-3" />
                  Android
                </span>
                <span className="inline-flex w-full items-center justify-center gap-1 rounded-full border border-border/60 bg-background/60 px-1.5 py-1 text-[10px] text-muted-foreground">
                  <Apple className="h-3 w-3" />
                  iOS
                </span>
                <span className="inline-flex w-full items-center justify-center gap-1 rounded-full border border-border/60 bg-background/60 px-1.5 py-1 text-[10px] text-muted-foreground">
                  <Monitor className="h-3 w-3" />
                  Windows
                </span>
              </div>
            </div>
          )}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 lg:pl-72">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/50 bg-background/70 px-3 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1 flex items-center gap-2.5">
            {(mode === "business" || user?.role !== "super_admin") && (
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-primary/30 bg-gradient-to-r from-primary/10 via-card/70 to-purple-500/10 px-3.5 py-1.5 text-[11px] backdrop-blur">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary">
                  <Building2 className="h-3.5 w-3.5" />
                </span>
                <div className="leading-tight">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.business}</p>
                  <p className="max-w-[180px] truncate font-semibold text-foreground">{businessName ?? "—"}</p>
                </div>
              </div>
            )}
            {user?.role === "super_admin" && (
              <div className="inline-flex max-w-full items-center rounded-full border border-border/60 bg-card/80 px-1 py-0.5 text-[10px] sm:text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setMode("business")
                    if (location.pathname.startsWith("/platform")) navigate("/")
                  }}
                  className={cn(
                    "px-2 sm:px-3 py-1 rounded-full transition-colors whitespace-nowrap",
                    mode === "business"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.myBusiness}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("platform")
                    if (!location.pathname.startsWith("/platform")) navigate("/platform/overview")
                  }}
                  className={cn(
                    "px-2 sm:px-3 py-1 rounded-full transition-colors whitespace-nowrap",
                    mode === "platform"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.platformManagement}
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {businessId && staffPresence !== null ? (
              <StaffPresenceLeds
                workingLive={staffPresence.live}
                notWorking={staffPresence.off}
                titleGreen={pickLang(language, {
                  el: "Σε βάρδια τώρα (ζωντανά)",
                  en: "On shift now (live)",
                  de: "Jetzt in Schicht (live)",
                })}
                titleRed={pickLang(language, {
                  el: "Δεν είναι σε βάρδια τώρα",
                  en: "Not on shift now",
                  de: "Jetzt nicht in Schicht",
                })}
                labelLive={pickLang(language, {
                  el: "Ενεργοί",
                  en: "On duty",
                  de: "Im Dienst",
                })}
                labelOff={pickLang(language, {
                  el: "Εκτός",
                  en: "Off duty",
                  de: "Außer Dienst",
                })}
              />
            ) : null}
            <div className="inline-flex items-center rounded-full border border-border/60 bg-card/80 p-0.5 text-[10px] sm:text-[11px]">
              <button
                type="button"
                onClick={() => setLanguage("el")}
                className={cn(
                  "rounded-full px-2 py-1 transition-colors",
                  language === "el" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                EL
              </button>
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={cn(
                  "rounded-full px-2 py-1 transition-colors",
                  language === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage("de")}
                className={cn(
                  "rounded-full px-2 py-1 transition-colors",
                  language === "de" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                DE
              </button>
            </div>
            <NotificationBell businessId={businessId} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {user?.full_name?.slice(0, 2).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-0.5 leading-none">
                    <p className="text-sm font-medium">{user?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">{user?.role}</p>
                  </div>
                </div>
                <DropdownMenuItem asChild>
                  <Link to="/settings">{t.settings}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  {t.signOut}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        {user?.role !== "super_admin" &&
          tenantSubscriptionPlan &&
          tenantSubscriptionPlan !== "unsubscribed" &&
          tenantSubscriptionPlan !== "demo" &&
          tenantSubscriptionPlan !== "lifetime" &&
          tenantSubscriptionExpiresAt && (
            <div className="border-b border-primary/25 bg-primary/10 px-3 py-2 text-center text-[11px] md:text-xs text-foreground">
              <span className="font-medium">{planLabelGr(tenantSubscriptionPlan)}</span>
              <span className="text-muted-foreground"> · </span>
              {t.remainingPrefix} <strong>{daysUntilSubscriptionEnd(tenantSubscriptionExpiresAt) ?? 0}</strong>{" "}
              {t.remainingSuffix}
              <span className="text-muted-foreground hidden sm:inline">
                {" "}
                ({t.expiresOn} {new Date(tenantSubscriptionExpiresAt).toLocaleDateString(appLocaleTag(language))})
              </span>
            </div>
          )}
        <main className="p-3 md:p-4 lg:p-5">{children}</main>
      </div>

      {isExpiredSubscription ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-background/70 p-4 backdrop-blur-md"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="subscription-expired-title"
          aria-describedby="subscription-expired-desc"
        >
          <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card/95 p-6 text-center shadow-2xl ring-1 ring-border/60">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <Lock className="h-7 w-7" aria-hidden />
            </div>
            <h2 id="subscription-expired-title" className="text-lg font-semibold tracking-tight text-foreground">
              {t.expiredTitle}
            </h2>
            <p id="subscription-expired-desc" className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t.expiredDescription}
            </p>
            <Button className="mt-6 w-full rounded-xl sm:w-auto" variant="default" onClick={() => void handleSignOut()}>
              {t.expiredSignOut}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
