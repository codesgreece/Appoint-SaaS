import { useEffect, useState } from "react"
import { UserCircle, Plus, Shield, UserCheck, Headphones, AtSign, MoreHorizontal, UserX, Trash2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import {
  fetchTeam,
  inviteTeamMember,
  setTeamMemberStatus,
  deleteTeamMember,
  type InviteTeamMemberRole,
  fetchAppointments,
  fetchReportsSummary,
  fetchStaffProfileForUser,
  upsertStaffProfile,
  fetchBusiness,
  notifyInAppQuiet,
} from "@/services/api"
import type { AppointmentJob, StaffProfile, User } from "@/types"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { formatDate } from "@/lib/utils"
import Shifts from "@/pages/Shifts"

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Διαχειριστής",
  employee: "Υπάλληλος",
  reception: "Ρεσεψιόν",
}

const ROLE_OPTIONS: { value: InviteTeamMemberRole; label: string }[] = [
  { value: "admin", label: "Διαχειριστής" },
  { value: "employee", label: "Υπάλληλος" },
  { value: "reception", label: "Ρεσεψιόν" },
]

export default function Team() {
  const { businessId, user: currentUser } = useAuth()
  const { toast } = useToast()
  const [team, setTeam] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formUsername, setFormUsername] = useState("")
  const [formName, setFormName] = useState("")
  const [formRole, setFormRole] = useState<InviteTeamMemberRole>("employee")
  const [formPassword, setFormPassword] = useState("")
  const [formPasswordConfirm, setFormPasswordConfirm] = useState("")

  const [appointmentStats, setAppointmentStats] = useState<
    Record<
      string,
      {
        today: number
        week: number
        activeToday: number
      }
    >
  >({})
  const [revenueByUser, setRevenueByUser] = useState<Record<string, number>>({})

  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [scheduleForm, setScheduleForm] = useState<{
    schedule: {
      [day: string]: { enabled: boolean; from: string; to: string }
    }
    permissions: {
      canViewReports: boolean
      canEditPrices: boolean
      canDeleteAppointments: boolean
    }
  }>({
    schedule: {
      mon: { enabled: true, from: "09:00", to: "17:00" },
      tue: { enabled: true, from: "09:00", to: "17:00" },
      wed: { enabled: true, from: "09:00", to: "17:00" },
      thu: { enabled: true, from: "09:00", to: "17:00" },
      fri: { enabled: true, from: "09:00", to: "17:00" },
      sat: { enabled: false, from: "09:00", to: "13:00" },
      sun: { enabled: false, from: "09:00", to: "13:00" },
    },
    permissions: {
      canViewReports: false,
      canEditPrices: false,
      canDeleteAppointments: false,
    },
  })

  const canAddMember = currentUser && ["admin", "super_admin"].includes(currentUser.role)
  const canManageMembers = Boolean(canAddMember)
  const [subSection, setSubSection] = useState<"team" | "shifts">("team")

  useEffect(() => {
    if (!businessId) return
    fetchTeam(businessId)
      .then(async (members) => {
        setTeam(members)
        // Φόρτωση στατιστικών ραντεβού & εσόδων ανά μέλος
        try {
          const today = new Date()
          const isoToday = today.toISOString().slice(0, 10)
          const weekAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)
          const isoWeekAgo = weekAgo.toISOString().slice(0, 10)
          const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
          const isoMonthStart = monthStart.toISOString().slice(0, 10)

          const [apps, reports] = await Promise.all([
            fetchAppointments(businessId, { from: isoWeekAgo, to: isoToday }),
            fetchReportsSummary(businessId, { from: isoMonthStart, to: isoToday }),
          ])

          const stats: Record<string, { today: number; week: number; activeToday: number }> = {}
          const activeStatuses: AppointmentJob["status"][] = ["pending", "confirmed", "in_progress"]

          members.forEach((m) => {
            const forUser = apps.filter((a) => a.assigned_user_id === m.id)
            const todayCount = forUser.filter((a) => a.scheduled_date === isoToday).length
            const weekCount = forUser.length
            const activeToday = forUser.filter(
              (a) => a.scheduled_date === isoToday && activeStatuses.includes(a.status),
            ).length
            stats[m.id] = { today: todayCount, week: weekCount, activeToday }
          })

          setAppointmentStats(stats)

          const revenueMap: Record<string, number> = {}
          reports.revenueByUser.forEach((row) => {
            revenueMap[row.name] = row.value
          })
          setRevenueByUser(revenueMap)
        } catch {
          // αν αποτύχουν τα stats, δεν σπάει η σελίδα
        }
      })
      .catch(() => toast({ title: "Σφάλμα", description: "Αποτυχία φόρτωσης ομάδας", variant: "destructive" }))
      .finally(() => setLoading(false))
  }, [businessId])

  function openDialog() {
    setFormUsername("")
    setFormName("")
    setFormRole("employee")
    setFormPassword("")
    setFormPasswordConfirm("")
    setDialogOpen(true)
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    const usernameTrimmed = formUsername.trim().toLowerCase()
    if (!usernameTrimmed || !formName.trim()) {
      toast({ title: "Σφάλμα", description: "Συμπληρώστε username και όνομα.", variant: "destructive" })
      return
    }
    if (!/^[a-z0-9_-]+$/.test(usernameTrimmed)) {
      toast({ title: "Σφάλμα", description: "Το username επιτρέπει μόνο μικρά γράμματα, αριθμούς, παύλα και underscore.", variant: "destructive" })
      return
    }
    if (formPassword && formPassword.length < 8) {
      toast({ title: "Σφάλμα", description: "Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.", variant: "destructive" })
      return
    }
    if (formPassword !== formPasswordConfirm) {
      toast({ title: "Σφάλμα", description: "Οι κωδικοί δεν ταιριάζουν.", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      if (!businessId) {
        toast({ title: "Σφάλμα", description: "Λείπει αναγνωριστικό επιχείρησης.", variant: "destructive" })
        return
      }
      const biz = await fetchBusiness(businessId)
      if (biz?.max_users != null && team.length >= biz.max_users) {
        toast({
          title: "Όριο χρηστών πλάνου",
          description: "Έχεις φτάσει το μέγιστο πλήθος χρηστών για το τρέχον πλάνο επιχείρησης.",
          variant: "destructive",
        })
        return
      }

      const { temporary_password, auth_email } = await inviteTeamMember({
        username: usernameTrimmed,
        full_name: formName.trim(),
        role: formRole,
        password: formPassword || undefined,
      })
      setDialogOpen(false)
      const refreshed = await fetchTeam(businessId!)
      setTeam(refreshed)
      await notifyInAppQuiet(
        businessId,
        `Νέο μέλος ομάδας: ${formName.trim()} (${ROLE_LABELS[formRole] ?? formRole}) · σύνδεση ${usernameTrimmed}`,
        { notificationType: "team_invite", metadata: { username: usernameTrimmed, role: formRole } },
      )
      toast({
        title: "Προστέθηκε στη team",
        description: temporary_password
          ? `Σύνδεση: ${usernameTrimmed}  •  Κωδικός πρώτης σύνδεσης: ${temporary_password}`
          : `Σύνδεση: ${usernameTrimmed}  •  Ο χρήστης μπορεί να συνδεθεί με τον κωδικό που ορίσατε.`,
      })
      if (auth_email) {
        console.log("[team] created member auth email:", auth_email)
      }
    } catch (err) {
      let message = "Αποτυχία δημιουργίας χρήστη"
      if (err instanceof Error) {
        if (err.message.includes("Failed to fetch") || err.message.includes("send request to edge function")) {
          message =
            "Δεν υπάρχει επικοινωνία με το Supabase Edge Function (CORS/Deploy). " +
            "Κάντε deploy την invite-team-member και δοκιμάστε ξανά."
        } else {
          message =
            err.message.includes("User already registered") || err.message.includes("already been registered")
              ? "Το username υπάρχει ήδη. Δοκιμάστε άλλο."
              : err.message
        }
      }
      toast({ title: "Σφάλμα", description: message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  async function refreshTeam() {
    if (!businessId) return
    const refreshed = await fetchTeam(businessId)
    setTeam(refreshed)
  }

  async function handleToggleStatus(target: User) {
    if (!canManageMembers) return
    if (!target?.id) return
    if (target.id === currentUser?.id) {
      toast({ title: "Σφάλμα", description: "Δεν μπορείτε να αλλάξετε την κατάσταση του δικού σας λογαριασμού.", variant: "destructive" })
      return
    }
    const next = target.status === "active" ? "inactive" : "active"
    const confirmText =
      next === "inactive"
        ? `Απενεργοποίηση χρήστη ${target.full_name}; (δεν θα μπορεί να συνδεθεί)`
        : `Ενεργοποίηση χρήστη ${target.full_name};`
    if (!confirm(confirmText)) return
    try {
      await setTeamMemberStatus({ user_id: target.id, status: next })
      await refreshTeam()
      toast({ title: "Έγινε", description: next === "inactive" ? "Ο λογαριασμός απενεργοποιήθηκε." : "Ο λογαριασμός ενεργοποιήθηκε." })
    } catch (e) {
      toast({ title: "Σφάλμα", description: e instanceof Error ? e.message : "Αποτυχία ενημέρωσης", variant: "destructive" })
    }
  }

  async function handleDeleteMember(target: User) {
    if (!canManageMembers) return
    if (!target?.id) return
    if (target.id === currentUser?.id) {
      toast({ title: "Σφάλμα", description: "Δεν μπορείτε να διαγράψετε τον δικό σας λογαριασμό.", variant: "destructive" })
      return
    }
    if (!confirm(`Οριστική διαγραφή χρήστη ${target.full_name}; (δεν γίνεται αναίρεση)`)) return
    try {
      await deleteTeamMember({ user_id: target.id })
      await refreshTeam()
      toast({ title: "Διαγράφηκε", description: "Ο λογαριασμός διαγράφηκε οριστικά." })
    } catch (e) {
      toast({ title: "Σφάλμα", description: e instanceof Error ? e.message : "Αποτυχία διαγραφής", variant: "destructive" })
    }
  }

  const total = team.length
  const activeCount = team.filter((u) => u.status === "active").length
  const inactiveCount = team.filter((u) => u.status === "inactive").length

  const dayLabels: Record<string, string> = {
    mon: "Δευτέρα",
    tue: "Τρίτη",
    wed: "Τετάρτη",
    thu: "Πέμπτη",
    fri: "Παρασκευή",
    sat: "Σάββατο",
    sun: "Κυριακή",
  }

  async function openScheduleDialog(user: User) {
    if (!businessId) return
    setSelectedUser(user)
    setScheduleLoading(true)
    setScheduleDialogOpen(true)
    try {
      const profile = await fetchStaffProfileForUser(user.id)
      if (profile?.availability) {
        const availability = profile.availability as any
        setScheduleForm({
          schedule: {
            ...scheduleForm.schedule,
            ...(availability.schedule ?? {}),
          },
          permissions: {
            canViewReports: Boolean(availability.permissions?.canViewReports),
            canEditPrices: Boolean(availability.permissions?.canEditPrices),
            canDeleteAppointments: Boolean(availability.permissions?.canDeleteAppointments),
          },
        })
      } else {
        // reset to defaults for new profile
        setScheduleForm((prev) => ({
          ...prev,
          permissions: {
            canViewReports: false,
            canEditPrices: false,
            canDeleteAppointments: false,
          },
        }))
      }
    } catch (e) {
      toast({
        title: "Σφάλμα",
        description: e instanceof Error ? e.message : "Αποτυχία φόρτωσης ωραρίου μέλους.",
        variant: "destructive",
      })
    } finally {
      setScheduleLoading(false)
    }
  }

  async function handleSaveSchedule() {
    if (!businessId || !selectedUser) return
    try {
      const availability: StaffProfile["availability"] = {
        schedule: scheduleForm.schedule,
        permissions: scheduleForm.permissions,
      }
      await upsertStaffProfile({
        business_id: businessId,
        user_id: selectedUser.id,
        availability,
      })
      toast({ title: "Αποθηκεύτηκε", description: "Οι ρυθμίσεις ωραρίου & δικαιωμάτων ενημερώθηκαν." })
      setScheduleDialogOpen(false)
      setSelectedUser(null)
    } catch (e) {
      toast({
        title: "Σφάλμα",
        description: e instanceof Error ? e.message : "Αποτυχία αποθήκευσης ρυθμίσεων.",
        variant: "destructive",
      })
    }
  }

  return (
    <ErrorBoundary>
      {subSection === "shifts" ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSubSection("team")}>
              Ομάδα
            </Button>
            <Button size="sm" onClick={() => setSubSection("shifts")}>
              Βάρδιες
            </Button>
          </div>
          <Shifts />
        </div>
      ) : (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Ομάδα</h1>
            <p className="text-sm text-muted-foreground">Μέλη και ρόλοι</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSubSection("team")}>
              Ομάδα
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSubSection("shifts")}>
              Βάρδιες
            </Button>
            {canAddMember && (
              <Button onClick={openDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Προσθήκη μέλους
              </Button>
            )}
          </div>
        </div>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base">Σύνοψη ομάδας</CardTitle>
              <p className="text-xs text-muted-foreground">Γρήγορη εικόνα ενεργών μελών.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs items-center">
              <Badge variant="outline">Σύνολο: {total}</Badge>
              <Badge variant="outline">Ενεργά: {activeCount}</Badge>
              <Badge variant="outline">Ανενεργά: {inactiveCount}</Badge>
              {currentUser?.business_limits?.max_users != null && (
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/40">
                  {total}/{currentUser.business_limits.max_users} μέλη
                </Badge>
              )}
            </div>
          </CardHeader>
        </Card>

        <Card className="border-border/50 bg-card/50 mt-2">
          <CardHeader className="space-y-1">
            <CardTitle className="text-base">Ρόλοι & Δικαιώματα</CardTitle>
            <p className="text-sm text-muted-foreground">
              Σύντομη περιγραφή για το τι μπορεί να κάνει κάθε ρόλος.
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2 font-medium">
                <Shield className="h-4 w-4 text-primary" />
                Διαχειριστής
              </div>
              <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                <li>- Διαχειρίζεται ρυθμίσεις επιχείρησης</li>
                <li>- Προσθέτει μέλη ομάδας</li>
                <li>- Πλήρης πρόσβαση σε πελάτες/ραντεβού/πληρωμές</li>
              </ul>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2 font-medium">
                <UserCheck className="h-4 w-4 text-primary" />
                Υπάλληλος
              </div>
              <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                <li>- Διαχειρίζεται ραντεβού/εργασίες</li>
                <li>- Βλέπει πελάτες και στοιχεία ραντεβού</li>
                <li>- Δεν αλλάζει κρίσιμες ρυθμίσεις</li>
              </ul>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2 font-medium">
                <Headphones className="h-4 w-4 text-primary" />
                Ρεσεψιόν
              </div>
              <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                <li>- Διαχειρίζεται κρατήσεις/ημερολόγιο</li>
                <li>- Δημιουργεί πελάτες και ραντεβού</li>
                <li>- Περιορισμένη πρόσβαση σε ρυθμίσεις</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-20 w-20 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {team.map((user) => (
              <Card key={user.id}>
                <CardHeader className="flex flex-row items-start gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {(user.full_name || "U").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <p className="font-semibold">{user.full_name}</p>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <AtSign className="h-3 w-3" />
                      {user.username ?? "—"}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={user.status === "active" ? "default" : "secondary"}>
                        {user.status}
                      </Badge>
                      <Badge variant="outline">{ROLE_LABELS[user.role] ?? user.role}</Badge>
                      <Badge variant="outline" className="text-[11px]">
                        Ενεργά σήμερα: {appointmentStats[user.id]?.activeToday ?? 0}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span>Σήμερα: {appointmentStats[user.id]?.today ?? 0} ραντ.</span>
                      <span>7ημ: {appointmentStats[user.id]?.week ?? 0} ραντ.</span>
                      <span>
                        Έσοδα μήνα:{" "}
                        {(revenueByUser[user.full_name] ?? 0).toLocaleString("el-GR", {
                          style: "currency",
                          currency: "EUR",
                          maximumFractionDigits: 0,
                        })}
                      </span>
                    </div>
                  </div>
                  {canManageMembers && user.id !== currentUser?.id && user.role !== "super_admin" ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Ενέργειες μέλους">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openScheduleDialog(user)}>
                          Ρυθμίσεις ωραρίου & δικαιωμάτων
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleStatus(user)}>
                          <UserX className="mr-2 h-4 w-4" />
                          {user.status === "active" ? "Απενεργοποίηση" : "Ενεργοποίηση"}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteMember(user)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Διαγραφή οριστικά
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Προστέθηκε: {formatDate(user.created_at)}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && team.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <UserCircle className="h-12 w-12 mb-4 opacity-50" />
              <p>Δεν υπάρχουν μέλη ομάδας</p>
              {canAddMember && (
                <Button variant="outline" className="mt-4" onClick={openDialog}>
                  Προσθήκη πρώτου μέλους
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Προσθήκη μέλους ομάδας</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="team-username">Username (σύνδεση με username + κωδικό)</Label>
                <Input
                  id="team-username"
                  type="text"
                  placeholder="π.χ. maria"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-name">Ονοματεπώνυμο</Label>
                <Input
                  id="team-name"
                  type="text"
                  placeholder="Όνομα μέλους"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Ρόλος</Label>
                <Select value={formRole} onValueChange={(v) => setFormRole(v as InviteTeamMemberRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-password">Κωδικός πρόσβασης</Label>
                <Input
                  id="team-password"
                  type="password"
                  placeholder="Ελάχιστο 8 χαρακτήρες"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-password-confirm">Επιβεβαίωση κωδικού</Label>
                <Input
                  id="team-password-confirm"
                  type="password"
                  placeholder="Επαναλάβετε τον κωδικό"
                  value={formPasswordConfirm}
                  onChange={(e) => setFormPasswordConfirm(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                  Ακύρωση
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Δημιουργία..." : "Προσθήκη"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={scheduleDialogOpen} onOpenChange={(open) => {
          setScheduleDialogOpen(open)
          if (!open) setSelectedUser(null)
        }}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Ωράριο & δικαιώματα {selectedUser ? `– ${selectedUser.full_name}` : ""}</DialogTitle>
            </DialogHeader>
            {scheduleLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">Ωράριο εργασίας ανά ημέρα</p>
                  <div className="grid grid-cols-1 gap-2">
                    {Object.keys(dayLabels).map((key) => (
                      <div key={key} className="flex items-center gap-3 rounded-md border border-border/60 bg-card/60 px-3 py-2">
                        <div className="w-24 text-[11px] font-medium">{dayLabels[key]}</div>
                        <label className="flex items-center gap-1 text-[11px]">
                          <input
                            type="checkbox"
                            className="h-3 w-3"
                            checked={scheduleForm.schedule[key]?.enabled ?? false}
                            onChange={(e) =>
                              setScheduleForm((prev) => ({
                                ...prev,
                                schedule: {
                                  ...prev.schedule,
                                  [key]: {
                                    ...(prev.schedule[key] ?? { from: "09:00", to: "17:00" }),
                                    enabled: e.target.checked,
                                  },
                                },
                              }))
                            }
                          />
                          <span>Ενεργή</span>
                        </label>
                        <div className="flex items-center gap-1">
                          <span>Από</span>
                          <Input
                            type="time"
                            className="h-7 w-24 px-2"
                            value={scheduleForm.schedule[key]?.from ?? "09:00"}
                            onChange={(e) =>
                              setScheduleForm((prev) => ({
                                ...prev,
                                schedule: {
                                  ...prev.schedule,
                                  [key]: {
                                    ...(prev.schedule[key] ?? { enabled: true, to: "17:00" }),
                                    from: e.target.value,
                                  },
                                },
                              }))
                            }
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span>Έως</span>
                          <Input
                            type="time"
                            className="h-7 w-24 px-2"
                            value={scheduleForm.schedule[key]?.to ?? "17:00"}
                            onChange={(e) =>
                              setScheduleForm((prev) => ({
                                ...prev,
                                schedule: {
                                  ...prev.schedule,
                                  [key]: {
                                    ...(prev.schedule[key] ?? { enabled: true, from: "09:00" }),
                                    to: e.target.value,
                                  },
                                },
                              }))
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-medium">Δικαιώματα</p>
                  <div className="grid grid-cols-1 gap-1">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-3 w-3"
                        checked={scheduleForm.permissions.canViewReports}
                        onChange={(e) =>
                          setScheduleForm((prev) => ({
                            ...prev,
                            permissions: { ...prev.permissions, canViewReports: e.target.checked },
                          }))
                        }
                      />
                      <span>Μπορεί να βλέπει reports</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-3 w-3"
                        checked={scheduleForm.permissions.canEditPrices}
                        onChange={(e) =>
                          setScheduleForm((prev) => ({
                            ...prev,
                            permissions: { ...prev.permissions, canEditPrices: e.target.checked },
                          }))
                        }
                      />
                      <span>Μπορεί να αλλάζει τιμές</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-3 w-3"
                        checked={scheduleForm.permissions.canDeleteAppointments}
                        onChange={(e) =>
                          setScheduleForm((prev) => ({
                            ...prev,
                            permissions: { ...prev.permissions, canDeleteAppointments: e.target.checked },
                          }))
                        }
                      />
                      <span>Μπορεί να διαγράφει ραντεβού</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setScheduleDialogOpen(false)
                      setSelectedUser(null)
                    }}
                  >
                    Ακύρωση
                  </Button>
                  <Button type="button" onClick={handleSaveSchedule}>
                    Αποθήκευση
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
      )}
    </ErrorBoundary>
  )
}
