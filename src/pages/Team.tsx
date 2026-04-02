import { useEffect, useState } from "react"
import { UserCircle, Plus, Shield, UserCheck, Headphones, AtSign, MoreHorizontal, UserX, Trash2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useLanguage } from "@/contexts/LanguageContext"
import {
  fetchTeam,
  fetchCrews,
  createCrew,
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
import type { AppointmentJob, StaffProfile, User, Crew } from "@/types"
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
import Shifts from "@/pages/Shifts"

const teamI18n = {
  el: {
    errorTitle: "Σφάλμα",
    okTitle: "Έγινε",
    loadTeamError: "Αποτυχία φόρτωσης ομάδας",
    fillUsernameName: "Συμπληρώστε username και όνομα.",
    usernamePattern: "Το username επιτρέπει μόνο μικρά γράμματα, αριθμούς, παύλα και underscore.",
    passwordMin8: "Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.",
    passwordsMismatch: "Οι κωδικοί δεν ταιριάζουν.",
    missingBusinessId: "Λείπει αναγνωριστικό επιχείρησης.",
    planUserLimitTitle: "Όριο χρηστών πλάνου",
    planUserLimitDesc: "Έχεις φτάσει το μέγιστο πλήθος χρηστών για το τρέχον πλάνο επιχείρησης.",
    inviteSuccessTitle: "Προστέθηκε στη team",
    inviteNotify: (name: string, role: string, username: string) =>
      `Νέο μέλος ομάδας: ${name} (${role}) · σύνδεση ${username}`,
    inviteDescTemp: (username: string, temp: string) =>
      `Σύνδεση: ${username}  •  Κωδικός πρώτης σύνδεσης: ${temp}`,
    inviteDescCustom: (username: string) =>
      `Σύνδεση: ${username}  •  Ο χρήστης μπορεί να συνδεθεί με τον κωδικό που ορίσατε.`,
    userCreateFailed: "Αποτυχία δημιουργίας χρήστη",
    edgeFunctionHint:
      "Δεν υπάρχει επικοινωνία με το Supabase Edge Function (CORS/Deploy). Κάντε deploy την invite-team-member και δοκιμάστε ξανά.",
    usernameTaken: "Το username υπάρχει ήδη. Δοκιμάστε άλλο.",
    cannotToggleSelf: "Δεν μπορείτε να αλλάξετε την κατάσταση του δικού σας λογαριασμού.",
    confirmDeactivate: (name: string) => `Απενεργοποίηση χρήστη ${name}; (δεν θα μπορεί να συνδεθεί)`,
    confirmActivate: (name: string) => `Ενεργοποίηση χρήστη ${name};`,
    accountDeactivated: "Ο λογαριασμός απενεργοποιήθηκε.",
    accountActivated: "Ο λογαριασμός ενεργοποιήθηκε.",
    updateFailed: "Αποτυχία ενημέρωσης",
    cannotDeleteSelf: "Δεν μπορείτε να διαγράψετε τον δικό σας λογαριασμό.",
    confirmDelete: (name: string) => `Οριστική διαγραφή χρήστη ${name}; (δεν γίνεται αναίρεση)`,
    deletedTitle: "Διαγράφηκε",
    deletedDesc: "Ο λογαριασμός διαγράφηκε οριστικά.",
    deleteFailed: "Αποτυχία διαγραφής",
    scheduleLoadError: "Αποτυχία φόρτωσης ωραρίου μέλους.",
    scheduleSavedTitle: "Αποθηκεύτηκε",
    scheduleSavedDesc: "Οι ρυθμίσεις ωραρίου & δικαιωμάτων ενημερώθηκαν.",
    scheduleSaveFailed: "Αποτυχία αποθήκευσης ρυθμίσεων.",
    teamTab: "Ομάδα",
    shiftsTab: "Βάρδιες",
    pageTitle: "Ομάδα",
    pageSubtitle: "Μέλη και ρόλοι",
    addMember: "Προσθήκη μέλους",
    summaryTitle: "Σύνοψη ομάδας",
    summaryHint: "Γρήγορη εικόνα ενεργών μελών.",
    total: "Σύνολο",
    active: "Ενεργά",
    inactive: "Ανενεργά",
    statusActive: "Ενεργό",
    statusInactive: "Ανενεργό",
    membersSuffix: "μέλη",
    rolesTitle: "Ρόλοι & Δικαιώματα",
    rolesHint: "Σύντομη περιγραφή για το τι μπορεί να κάνει κάθε ρόλος.",
    roleAdmin: "Διαχειριστής",
    roleEmployee: "Υπάλληλος",
    roleReception: "Ρεσεψιόν",
    superAdmin: "Super Admin",
    adminBullets: [
      "- Διαχειρίζεται ρυθμίσεις επιχείρησης",
      "- Προσθέτει μέλη ομάδας",
      "- Πλήρης πρόσβαση σε πελάτες/ραντεβού/πληρωμές",
    ],
    employeeBullets: [
      "- Διαχειρίζεται ραντεβού/εργασίες",
      "- Βλέπει πελάτες και στοιχεία ραντεβού",
      "- Δεν αλλάζει κρίσιμες ρυθμίσεις",
    ],
    receptionBullets: [
      "- Διαχειρίζεται κρατήσεις/ημερολόγιο",
      "- Δημιουργεί πελάτες και ραντεβού",
      "- Περιορισμένη πρόσβαση σε ρυθμίσεις",
    ],
    activeToday: "Ενεργά σήμερα",
    todayAppts: "Σήμερα",
    weekAppts: "7ημ",
    monthlyRevenue: "Έσοδα μήνα",
    apptsShort: "ραντ.",
    memberActionsAria: "Ενέργειες μέλους",
    scheduleSettings: "Ρυθμίσεις ωραρίου & δικαιωμάτων",
    deactivate: "Απενεργοποίηση",
    activate: "Ενεργοποίηση",
    deletePermanent: "Διαγραφή οριστικά",
    addedOn: "Προστέθηκε",
    emptyTeam: "Δεν υπάρχουν μέλη ομάδας",
    addFirstMember: "Προσθήκη πρώτου μέλους",
    dialogAddTitle: "Προσθήκη μέλους ομάδας",
    labelUsername: "Username (σύνδεση με username + κωδικό)",
    placeholderUsername: "π.χ. maria",
    labelFullName: "Ονοματεπώνυμο",
    placeholderName: "Όνομα μέλους",
    labelRole: "Ρόλος",
    labelPassword: "Κωδικός πρόσβασης",
    placeholderPassword: "Ελάχιστο 8 χαρακτήρες",
    labelPasswordConfirm: "Επιβεβαίωση κωδικού",
    placeholderPasswordConfirm: "Επαναλάβετε τον κωδικό",
    cancel: "Ακύρωση",
    creating: "Δημιουργία...",
    add: "Προσθήκη",
    scheduleDialogHeading: "Ωράριο & δικαιώματα",
    scheduleDialogTitle: (name: string) => `Ωράριο & δικαιώματα – ${name}`,
    schedulePerDay: "Ωράριο εργασίας ανά ημέρα",
    dayEnabled: "Ενεργή",
    from: "Από",
    to: "Έως",
    permissionsTitle: "Δικαιώματα",
    permReports: "Μπορεί να βλέπει reports",
    permPrices: "Μπορεί να αλλάζει τιμές",
    permDeleteAppts: "Μπορεί να διαγράφει ραντεβού",
    save: "Αποθήκευση",
    days: {
      mon: "Δευτέρα",
      tue: "Τρίτη",
      wed: "Τετάρτη",
      thu: "Πέμπτη",
      fri: "Παρασκευή",
      sat: "Σάββατο",
      sun: "Κυριακή",
    },
  },
  en: {
    errorTitle: "Error",
    okTitle: "Done",
    loadTeamError: "Failed to load team.",
    fillUsernameName: "Enter username and name.",
    usernamePattern: "Username may only contain lowercase letters, numbers, hyphen and underscore.",
    passwordMin8: "Password must be at least 8 characters.",
    passwordsMismatch: "Passwords do not match.",
    missingBusinessId: "Business id is missing.",
    planUserLimitTitle: "Plan user limit",
    planUserLimitDesc: "You reached the maximum users for the current business plan.",
    inviteSuccessTitle: "Added to team",
    inviteNotify: (name: string, role: string, username: string) =>
      `New team member: ${name} (${role}) · login ${username}`,
    inviteDescTemp: (username: string, temp: string) =>
      `Login: ${username}  •  First-login password: ${temp}`,
    inviteDescCustom: (username: string) =>
      `Login: ${username}  •  The user can sign in with the password you set.`,
    userCreateFailed: "Failed to create user",
    edgeFunctionHint:
      "Cannot reach the Supabase Edge Function (CORS/deploy). Deploy invite-team-member and try again.",
    usernameTaken: "That username is already taken. Try another.",
    cannotToggleSelf: "You cannot change your own account status.",
    confirmDeactivate: (name: string) => `Deactivate user ${name}? (they won’t be able to sign in)`,
    confirmActivate: (name: string) => `Activate user ${name}?`,
    accountDeactivated: "Account deactivated.",
    accountActivated: "Account activated.",
    updateFailed: "Update failed",
    cannotDeleteSelf: "You cannot delete your own account.",
    confirmDelete: (name: string) => `Permanently delete user ${name}? (cannot be undone)`,
    deletedTitle: "Deleted",
    deletedDesc: "Account permanently deleted.",
    deleteFailed: "Delete failed",
    scheduleLoadError: "Failed to load member schedule.",
    scheduleSavedTitle: "Saved",
    scheduleSavedDesc: "Schedule & permissions updated.",
    scheduleSaveFailed: "Failed to save settings.",
    teamTab: "Team",
    shiftsTab: "Shifts",
    pageTitle: "Team",
    pageSubtitle: "Members and roles",
    addMember: "Add member",
    summaryTitle: "Team summary",
    summaryHint: "Quick view of active members.",
    total: "Total",
    active: "Active",
    inactive: "Inactive",
    statusActive: "Active",
    statusInactive: "Inactive",
    membersSuffix: "members",
    rolesTitle: "Roles & permissions",
    rolesHint: "Short description of what each role can do.",
    roleAdmin: "Administrator",
    roleEmployee: "Employee",
    roleReception: "Reception",
    superAdmin: "Super Admin",
    adminBullets: [
      "- Manages business settings",
      "- Adds team members",
      "- Full access to customers/appointments/payments",
    ],
    employeeBullets: [
      "- Manages appointments/tasks",
      "- Views customers and appointment details",
      "- Cannot change critical settings",
    ],
    receptionBullets: [
      "- Manages bookings/calendar",
      "- Creates customers and appointments",
      "- Limited access to settings",
    ],
    activeToday: "Active today",
    todayAppts: "Today",
    weekAppts: "7d",
    monthlyRevenue: "Monthly revenue",
    apptsShort: "appts",
    memberActionsAria: "Member actions",
    scheduleSettings: "Schedule & permissions",
    deactivate: "Deactivate",
    activate: "Activate",
    deletePermanent: "Delete permanently",
    addedOn: "Added",
    emptyTeam: "No team members yet",
    addFirstMember: "Add first member",
    dialogAddTitle: "Add team member",
    labelUsername: "Username (sign in with username + password)",
    placeholderUsername: "e.g. maria",
    labelFullName: "Full name",
    placeholderName: "Member name",
    labelRole: "Role",
    labelPassword: "Password",
    placeholderPassword: "At least 8 characters",
    labelPasswordConfirm: "Confirm password",
    placeholderPasswordConfirm: "Repeat password",
    cancel: "Cancel",
    creating: "Creating...",
    add: "Add",
    scheduleDialogHeading: "Schedule & permissions",
    scheduleDialogTitle: (name: string) => `Schedule & permissions – ${name}`,
    schedulePerDay: "Work hours per day",
    dayEnabled: "On",
    from: "From",
    to: "To",
    permissionsTitle: "Permissions",
    permReports: "Can view reports",
    permPrices: "Can edit prices",
    permDeleteAppts: "Can delete appointments",
    save: "Save",
    days: {
      mon: "Monday",
      tue: "Tuesday",
      wed: "Wednesday",
      thu: "Thursday",
      fri: "Friday",
      sat: "Saturday",
      sun: "Sunday",
    },
  },
}

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const

type TeamStrings = (typeof teamI18n)[keyof typeof teamI18n]

function roleLabel(role: string, t: TeamStrings): string {
  switch (role) {
    case "super_admin":
      return t.superAdmin
    case "admin":
      return t.roleAdmin
    case "employee":
      return t.roleEmployee
    case "reception":
      return t.roleReception
    default:
      return role
  }
}

function roleOptions(lang: "el" | "en"): { value: InviteTeamMemberRole; label: string }[] {
  const t = teamI18n[lang]
  return [
    { value: "admin", label: t.roleAdmin },
    { value: "employee", label: t.roleEmployee },
    { value: "reception", label: t.roleReception },
  ]
}

export default function Team() {
  const { businessId, user: currentUser } = useAuth()
  const { language } = useLanguage()
  const t = teamI18n[language]
  const { toast } = useToast()
  const [team, setTeam] = useState<User[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
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
  const [newCrewName, setNewCrewName] = useState("")
  const [newCrewColor, setNewCrewColor] = useState("#3b82f6")
  const [creatingCrew, setCreatingCrew] = useState(false)

  useEffect(() => {
    if (!businessId) return
    Promise.all([fetchTeam(businessId), fetchCrews(businessId)])
      .then(async ([members, crewsRows]) => {
        setTeam(members)
        setCrews(crewsRows)
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
      .catch(() =>
        toast({
          title: teamI18n[language].errorTitle,
          description: teamI18n[language].loadTeamError,
          variant: "destructive",
        }),
      )
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid refetch when only UI language changes
  }, [businessId, toast])

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
      toast({ title: t.errorTitle, description: t.fillUsernameName, variant: "destructive" })
      return
    }
    if (!/^[a-z0-9_-]+$/.test(usernameTrimmed)) {
      toast({ title: t.errorTitle, description: t.usernamePattern, variant: "destructive" })
      return
    }
    if (formPassword && formPassword.length < 8) {
      toast({ title: t.errorTitle, description: t.passwordMin8, variant: "destructive" })
      return
    }
    if (formPassword !== formPasswordConfirm) {
      toast({ title: t.errorTitle, description: t.passwordsMismatch, variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      if (!businessId) {
        toast({ title: t.errorTitle, description: t.missingBusinessId, variant: "destructive" })
        return
      }
      const biz = await fetchBusiness(businessId)
      if (biz?.max_users != null && team.length >= biz.max_users) {
        toast({
          title: t.planUserLimitTitle,
          description: t.planUserLimitDesc,
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
        t.inviteNotify(formName.trim(), roleLabel(formRole, t), usernameTrimmed),
        { notificationType: "team_invite", metadata: { username: usernameTrimmed, role: formRole } },
      )
      toast({
        title: t.inviteSuccessTitle,
        description: temporary_password
          ? t.inviteDescTemp(usernameTrimmed, temporary_password)
          : t.inviteDescCustom(usernameTrimmed),
      })
      if (auth_email) {
        console.log("[team] created member auth email:", auth_email)
      }
    } catch (err) {
      let message: string = t.userCreateFailed
      if (err instanceof Error) {
        if (err.message.includes("Failed to fetch") || err.message.includes("send request to edge function")) {
          message = t.edgeFunctionHint
        } else {
          message =
            err.message.includes("User already registered") || err.message.includes("already been registered")
              ? t.usernameTaken
              : err.message
        }
      }
      toast({ title: t.errorTitle, description: message, variant: "destructive" })
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
      toast({ title: t.errorTitle, description: t.cannotToggleSelf, variant: "destructive" })
      return
    }
    const next = target.status === "active" ? "inactive" : "active"
    const confirmText =
      next === "inactive" ? t.confirmDeactivate(target.full_name) : t.confirmActivate(target.full_name)
    if (!confirm(confirmText)) return
    try {
      await setTeamMemberStatus({ user_id: target.id, status: next })
      await refreshTeam()
      toast({
        title: t.okTitle,
        description: next === "inactive" ? t.accountDeactivated : t.accountActivated,
      })
    } catch (e) {
      toast({
        title: t.errorTitle,
        description: e instanceof Error ? e.message : t.updateFailed,
        variant: "destructive",
      })
    }
  }

  async function handleDeleteMember(target: User) {
    if (!canManageMembers) return
    if (!target?.id) return
    if (target.id === currentUser?.id) {
      toast({ title: t.errorTitle, description: t.cannotDeleteSelf, variant: "destructive" })
      return
    }
    if (!confirm(t.confirmDelete(target.full_name))) return
    try {
      await deleteTeamMember({ user_id: target.id })
      await refreshTeam()
      toast({ title: t.deletedTitle, description: t.deletedDesc })
    } catch (e) {
      toast({
        title: t.errorTitle,
        description: e instanceof Error ? e.message : t.deleteFailed,
        variant: "destructive",
      })
    }
  }

  const total = team.length
  const activeCount = team.filter((u) => u.status === "active").length
  const inactiveCount = team.filter((u) => u.status === "inactive").length

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
        title: t.errorTitle,
        description: e instanceof Error ? e.message : t.scheduleLoadError,
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
      toast({ title: t.scheduleSavedTitle, description: t.scheduleSavedDesc })
      setScheduleDialogOpen(false)
      setSelectedUser(null)
    } catch (e) {
      toast({
        title: t.errorTitle,
        description: e instanceof Error ? e.message : t.scheduleSaveFailed,
        variant: "destructive",
      })
    }
  }

  async function handleCreateCrew() {
    if (!businessId || !canManageMembers) return
    if (!newCrewName.trim()) {
      toast({ title: t.errorTitle, description: language === "en" ? "Crew name is required." : "Το όνομα συνεργείου είναι υποχρεωτικό.", variant: "destructive" })
      return
    }
    try {
      setCreatingCrew(true)
      await createCrew({ business_id: businessId, name: newCrewName.trim(), color: newCrewColor })
      const refreshed = await fetchCrews(businessId)
      setCrews(refreshed)
      setNewCrewName("")
      setNewCrewColor("#3b82f6")
      toast({ title: t.okTitle, description: language === "en" ? "Crew created." : "Το συνεργείο δημιουργήθηκε." })
    } catch (e) {
      toast({
        title: t.errorTitle,
        description: e instanceof Error ? e.message : language === "en" ? "Failed to create crew." : "Αποτυχία δημιουργίας συνεργείου.",
        variant: "destructive",
      })
    } finally {
      setCreatingCrew(false)
    }
  }

  return (
    <ErrorBoundary>
      {subSection === "shifts" ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSubSection("team")}>
              {t.teamTab}
            </Button>
            <Button size="sm" onClick={() => setSubSection("shifts")}>
              {t.shiftsTab}
            </Button>
          </div>
          <Shifts embedded />
        </div>
      ) : (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{t.pageTitle}</h1>
            <p className="text-sm text-muted-foreground">{t.pageSubtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSubSection("team")}>
              {t.teamTab}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSubSection("shifts")}>
              {t.shiftsTab}
            </Button>
            {canAddMember && (
              <Button onClick={openDialog}>
                <Plus className="h-4 w-4 mr-2" />
                {t.addMember}
              </Button>
            )}
          </div>
        </div>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base">{t.summaryTitle}</CardTitle>
              <p className="text-xs text-muted-foreground">{t.summaryHint}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs items-center">
              <Badge variant="outline">
                {t.total}: {total}
              </Badge>
              <Badge variant="outline">
                {t.active}: {activeCount}
              </Badge>
              <Badge variant="outline">
                {t.inactive}: {inactiveCount}
              </Badge>
              {currentUser?.business_limits?.max_users != null && (
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/40">
                  {total}/{currentUser.business_limits.max_users} {t.membersSuffix}
                </Badge>
              )}
            </div>
          </CardHeader>
        </Card>

        <Card className="border-border/50 bg-card/50 mt-2">
          <CardHeader className="space-y-1">
            <CardTitle className="text-base">{t.rolesTitle}</CardTitle>
            <p className="text-sm text-muted-foreground">{t.rolesHint}</p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2 font-medium">
                <Shield className="h-4 w-4 text-primary" />
                {t.roleAdmin}
              </div>
              <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                {t.adminBullets.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2 font-medium">
                <UserCheck className="h-4 w-4 text-primary" />
                {t.roleEmployee}
              </div>
              <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                {t.employeeBullets.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2 font-medium">
                <Headphones className="h-4 w-4 text-primary" />
                {t.roleReception}
              </div>
              <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                {t.receptionBullets.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 mt-2">
          <CardHeader className="space-y-1">
            <CardTitle className="text-base">{language === "en" ? "Crews" : "Συνεργεία"}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {language === "en"
                ? "Create team groups and define their color for calendar visibility."
                : "Δημιούργησε ομάδες συνεργείων και όρισε χρώμα για εμφάνιση στο ημερολόγιο."}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {canManageMembers ? (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto]">
                <Input
                  value={newCrewName}
                  onChange={(e) => setNewCrewName(e.target.value)}
                  placeholder={language === "en" ? "Crew name" : "Όνομα συνεργείου"}
                />
                <Input type="color" value={newCrewColor} onChange={(e) => setNewCrewColor(e.target.value)} className="h-10 w-full md:w-20" />
                <Button type="button" onClick={handleCreateCrew} disabled={creatingCrew}>
                  {creatingCrew ? (language === "en" ? "Creating..." : "Δημιουργία...") : (language === "en" ? "Add crew" : "Προσθήκη συνεργείου")}
                </Button>
              </div>
            ) : null}
            {crews.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {language === "en" ? "No crews yet." : "Δεν υπάρχουν συνεργεία ακόμα."}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {crews.map((crew) => (
                  <div key={crew.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-sm">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: crew.color }} />
                    <span className="font-medium">{crew.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{crew.color}</span>
                  </div>
                ))}
              </div>
            )}
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
                        {user.status === "active" ? t.statusActive : t.statusInactive}
                      </Badge>
                      <Badge variant="outline">{roleLabel(user.role, t)}</Badge>
                      <Badge variant="outline" className="text-[11px]">
                        {t.activeToday}: {appointmentStats[user.id]?.activeToday ?? 0}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span>
                        {t.todayAppts}: {appointmentStats[user.id]?.today ?? 0} {t.apptsShort}
                      </span>
                      <span>
                        {t.weekAppts}: {appointmentStats[user.id]?.week ?? 0} {t.apptsShort}
                      </span>
                      <span>
                        {t.monthlyRevenue}:{" "}
                        {(revenueByUser[user.full_name] ?? 0).toLocaleString(
                          language === "en" ? "en-GB" : "el-GR",
                          {
                            style: "currency",
                            currency: "EUR",
                            maximumFractionDigits: 0,
                          },
                        )}
                      </span>
                    </div>
                  </div>
                  {canManageMembers && user.id !== currentUser?.id && user.role !== "super_admin" ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={t.memberActionsAria}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openScheduleDialog(user)}>
                          {t.scheduleSettings}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleStatus(user)}>
                          <UserX className="mr-2 h-4 w-4" />
                          {user.status === "active" ? t.deactivate : t.activate}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteMember(user)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t.deletePermanent}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {t.addedOn}:{" "}
                  {new Intl.DateTimeFormat(language === "en" ? "en-GB" : "el-GR", {
                    dateStyle: "short",
                  }).format(new Date(user.created_at))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && team.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <UserCircle className="h-12 w-12 mb-4 opacity-50" />
              <p>{t.emptyTeam}</p>
              {canAddMember && (
                <Button variant="outline" className="mt-4" onClick={openDialog}>
                  {t.addFirstMember}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t.dialogAddTitle}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="team-username">{t.labelUsername}</Label>
                <Input
                  id="team-username"
                  type="text"
                  placeholder={t.placeholderUsername}
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-name">{t.labelFullName}</Label>
                <Input
                  id="team-name"
                  type="text"
                  placeholder={t.placeholderName}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.labelRole}</Label>
                <Select value={formRole} onValueChange={(v) => setFormRole(v as InviteTeamMemberRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roleOptions(language).map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-password">{t.labelPassword}</Label>
                <Input
                  id="team-password"
                  type="password"
                  placeholder={t.placeholderPassword}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-password-confirm">{t.labelPasswordConfirm}</Label>
                <Input
                  id="team-password-confirm"
                  type="password"
                  placeholder={t.placeholderPasswordConfirm}
                  value={formPasswordConfirm}
                  onChange={(e) => setFormPasswordConfirm(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                  {t.cancel}
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? t.creating : t.add}
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
              <DialogTitle>
                {selectedUser ? t.scheduleDialogTitle(selectedUser.full_name) : t.scheduleDialogHeading}
              </DialogTitle>
            </DialogHeader>
            {scheduleLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">{t.schedulePerDay}</p>
                  <div className="grid grid-cols-1 gap-2">
                    {DAY_KEYS.map((key) => (
                      <div key={key} className="flex items-center gap-3 rounded-md border border-border/60 bg-card/60 px-3 py-2">
                        <div className="w-24 text-[11px] font-medium">{t.days[key]}</div>
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
                          <span>{t.dayEnabled}</span>
                        </label>
                        <div className="flex items-center gap-1">
                          <span>{t.from}</span>
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
                          <span>{t.to}</span>
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
                  <p className="text-[11px] font-medium">{t.permissionsTitle}</p>
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
                      <span>{t.permReports}</span>
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
                      <span>{t.permPrices}</span>
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
                      <span>{t.permDeleteAppts}</span>
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
                    {t.cancel}
                  </Button>
                  <Button type="button" onClick={handleSaveSchedule}>
                    {t.save}
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
