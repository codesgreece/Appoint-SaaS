import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  LayoutDashboard,
  Users,
  Calendar,
  CalendarDays,
  UserCircle,
  CreditCard,
  BarChart3,
  Settings,
  Briefcase,
  HelpCircle,
  LifeBuoy,
  FileText,
  ShieldCheck,
  Menu,
  LogOut,
  ShoppingBag,
  Moon,
  Sun,
  Search,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useTheme } from "@/components/theme-provider"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { CommandPalette } from "@/components/CommandPalette"

const businessNavItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/customers", icon: Users, label: "Πελάτες" },
  { to: "/services", icon: Briefcase, label: "Υπηρεσίες" },
  { to: "/appointments", icon: Calendar, label: "Ραντεβού" },
  { to: "/calendar", icon: CalendarDays, label: "Ημερολόγιο" },
  { to: "/team", icon: UserCircle, label: "Ομάδα" },
  { to: "/payments", icon: CreditCard, label: "Πληρωμές" },
  { to: "/reports", icon: BarChart3, label: "Αναφορές" },
  { to: "/support", icon: LifeBuoy, label: "Υποστήριξη" },
  { to: "/settings", icon: Settings, label: "Ρυθμίσεις" },
  { to: "/faq", icon: HelpCircle, label: "FAQ" },
  { to: "/terms", icon: FileText, label: "Όροι χρήσης" },
  { to: "/privacy", icon: ShieldCheck, label: "Πολιτική απορρήτου" },
]

const platformNavItems = [
  { to: "/platform/overview", icon: LayoutDashboard, label: "Επισκόπηση πλατφόρμας" },
  { to: "/platform/businesses", icon: Users, label: "Επιχειρήσεις" },
  { to: "/platform/plans", icon: BarChart3, label: "Πλάνα & Όρια" },
  { to: "/platform/users", icon: UserCircle, label: "Χρήστες πλατφόρμας" },
  { to: "/platform/tools", icon: Settings, label: "Εργαλεία υποστήριξης" },
  { to: "/faq", icon: HelpCircle, label: "FAQ" },
  { to: "/terms", icon: FileText, label: "Όροι χρήσης" },
  { to: "/privacy", icon: ShieldCheck, label: "Πολιτική απορρήτου" },
]

const lockedNavItems = [
  { to: "/subscribe", icon: ShoppingBag, label: "Αγορά προγράμματος" },
  { to: "/settings", icon: Settings, label: "Ρυθμίσεις" },
]

function planLabelGr(plan: string | null): string {
  const m: Record<string, string> = {
    starter: "Starter",
    pro: "Pro",
    premium: "Premium",
    premium_plus: "Premium+",
    demo: "Demo",
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
  const { user, signOut, businessName, tenantSubscriptionPlan, tenantSubscriptionExpiresAt } = useAuth()
  const { setTheme, resolvedTheme } = useTheme()
  const { mode, setMode } = useWorkspace()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [openSupportCount, setOpenSupportCount] = useState<number | null>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isK = e.key.toLowerCase() === "k"
      if ((e.ctrlKey || e.metaKey) && isK) {
        e.preventDefault()
        setCommandOpen(true)
      }
      if (e.key === "Escape") setCommandOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

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

  async function handleSignOut() {
    await signOut()
    navigate("/login", { replace: true })
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-1/3 -right-24 h-72 w-72 rounded-full bg-purple-500/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
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
          "fixed top-0 left-0 z-50 h-full w-60 border-r border-border/60 bg-background/70 backdrop-blur-2xl transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between px-3 border-b border-border/60 lg:justify-center">
          <Link to="/" className="font-semibold text-base tracking-tight">
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
            const subscriptionLocked =
              user?.role !== "super_admin" && tenantSubscriptionPlan === "unsubscribed"
            if (user?.role === "super_admin" && mode === "platform") return platformNavItems
            if (subscriptionLocked) return lockedNavItems
            return businessNavItems
          })().map((item) => {
            const isActive = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to))
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
                <span className="flex-1 truncate text-[13px] md:text-sm">{item.label}</span>
                {item.to === "/platform/tools" && openSupportCount != null && openSupportCount > 0 ? (
                  <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-2 text-[11px] font-semibold text-primary">
                    {openSupportCount}
                  </span>
                ) : null}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/50 bg-background/70 px-3 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1 flex items-center gap-2.5">
            {(mode === "business" || user?.role !== "super_admin") && (
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur">
                <span className="font-medium text-foreground truncate max-w-[160px]">
                  {businessName ?? "—"}
                </span>
              </div>
            )}
            {user?.role === "super_admin" && (
              <div className="inline-flex items-center rounded-full border border-border/60 bg-card/80 px-1 py-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setMode("business")
                    if (location.pathname.startsWith("/platform")) navigate("/")
                  }}
                  className={cn(
                    "px-3 py-1 rounded-full transition-colors",
                    mode === "business"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Η επιχείρησή μου
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("platform")
                    if (!location.pathname.startsWith("/platform")) navigate("/platform/overview")
                  }}
                  className={cn(
                    "px-3 py-1 rounded-full transition-colors",
                    mode === "platform"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Διαχείριση πλατφόρμας
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="hidden md:flex items-center gap-2 rounded-full border border-border/60 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur hover:bg-card hover:text-foreground transition-colors"
            >
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px]">Αναζήτηση ή εντολή…</span>
              <span className="ml-2 inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                Ctrl+K
              </span>
            </button>
            <Switch
              checked={resolvedTheme === "dark"}
              onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
            />
            {resolvedTheme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
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
                  <Link to="/settings">Ρυθμίσεις</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Αποσύνδεση
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        {user?.role !== "super_admin" &&
          tenantSubscriptionPlan &&
          tenantSubscriptionPlan !== "unsubscribed" &&
          tenantSubscriptionPlan !== "demo" &&
          tenantSubscriptionExpiresAt && (
            <div className="border-b border-primary/25 bg-primary/10 px-3 py-2 text-center text-[11px] md:text-xs text-foreground">
              <span className="font-medium">{planLabelGr(tenantSubscriptionPlan)}</span>
              <span className="text-muted-foreground"> · </span>
              Υπολείπονται{" "}
              <strong>{daysUntilSubscriptionEnd(tenantSubscriptionExpiresAt) ?? 0}</strong> ημέρες στη συνδρομή
              <span className="text-muted-foreground hidden sm:inline">
                {" "}
                (λήξη {new Date(tenantSubscriptionExpiresAt).toLocaleDateString("el-GR")})
              </span>
            </div>
          )}
        <main className="p-3 md:p-4 lg:p-5">{children}</main>
      </div>
    </div>
  )
}
