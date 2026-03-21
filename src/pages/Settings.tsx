import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { fetchBusiness, fetchCustomers, resetDemoBusiness } from "@/services/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useTheme } from "@/components/theme-provider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sparkles, Palette, FileSpreadsheet, Bell, Database } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import * as XLSX from "xlsx"

type TelegramNotificationPreferences = {
  appointment_created: boolean
  appointment_cancelled_or_no_show: boolean
  appointment_rescheduled: boolean
  payment_recorded: boolean
  support_incident_new: boolean
  support_reply: boolean
  daily_summary: boolean
  morning_briefing: boolean
  plan_limits: boolean
  subscription_alerts: boolean
  reminder_30m: boolean
}

const defaultTelegramPreferences: TelegramNotificationPreferences = {
  appointment_created: true,
  appointment_cancelled_or_no_show: true,
  appointment_rescheduled: true,
  payment_recorded: true,
  support_incident_new: true,
  support_reply: true,
  daily_summary: true,
  morning_briefing: true,
  plan_limits: true,
  subscription_alerts: true,
  reminder_30m: true,
}

export default function Settings() {
  const { businessId } = useAuth()
  const { theme, setTheme, palette, setPalette } = useTheme()
  const { toast } = useToast()
  const [telegramEnabled, setTelegramEnabled] = useState(false)
  const [telegramChatId, setTelegramChatId] = useState("")
  const [telegramBotToken, setTelegramBotToken] = useState("")
  const [telegramPreferences, setTelegramPreferences] = useState<TelegramNotificationPreferences>(
    defaultTelegramPreferences,
  )
  const [savingNotifications, setSavingNotifications] = useState(false)
  const [isDemoPlan, setIsDemoPlan] = useState(false)
  const [resettingDemo, setResettingDemo] = useState(false)
  const [exportingCustomers, setExportingCustomers] = useState(false)

  const selectedThemePreset = useMemo(() => `${theme}:${palette}`, [theme, palette])

  function handleThemePresetChange(value: string) {
    const [nextTheme, nextPalette] = value.split(":")
    if (nextTheme === "light" || nextTheme === "dark" || nextTheme === "system") {
      setTheme(nextTheme)
    }
    if (nextPalette === "default" || nextPalette === "beauty") {
      setPalette(nextPalette)
    }
  }

  useEffect(() => {
    if (!businessId) return
    fetchBusiness(businessId).then((b) => {
      if (!b) return
      setTelegramEnabled(Boolean(b.telegram_enabled))
      setTelegramChatId(b.telegram_chat_id ?? "")
      setTelegramBotToken(b.telegram_bot_token ?? "")
      const loaded = (b.telegram_notification_preferences ?? {}) as Partial<TelegramNotificationPreferences>
      setTelegramPreferences({ ...defaultTelegramPreferences, ...loaded })
      setIsDemoPlan((b.subscription_plan ?? "").toLowerCase() === "demo")
    })
  }, [businessId])

  async function handleSaveNotifications() {
    if (!businessId) return
    try {
      setSavingNotifications(true)
      const { error } = await supabase
        .from("businesses")
        .update({
          telegram_enabled: telegramEnabled,
          telegram_chat_id: telegramChatId.trim() || null,
          telegram_bot_token: telegramBotToken.trim() || null,
          telegram_notification_preferences: telegramPreferences,
        })
        .eq("id", businessId)
      if (error) throw error
      toast({ title: "Αποθηκεύτηκε", description: "Οι ρυθμίσεις Telegram ενημερώθηκαν." })
    } catch (e) {
      toast({
        title: "Σφάλμα",
        description: e instanceof Error ? e.message : "Αποτυχία αποθήκευσης ρυθμίσεων Telegram",
        variant: "destructive",
      })
    } finally {
      setSavingNotifications(false)
    }
  }

  async function handleResetDemoData() {
    if (!businessId) return
    const ok = window.confirm(
      "Θέλεις σίγουρα να γίνει επαναφορά demo; Θα διαγραφούν ραντεβού, πληρωμές, πελάτες, υπηρεσίες και αιτήματα support.",
    )
    if (!ok) return
    try {
      setResettingDemo(true)
      await resetDemoBusiness(businessId)
      toast({
        title: "Έγινε επαναφορά",
        description: "Τα δεδομένα demo διαγράφηκαν και ο λογαριασμός είναι έτοιμος για νέα δοκιμή.",
      })
    } catch (e) {
      toast({
        title: "Σφάλμα",
        description: e instanceof Error ? e.message : "Αποτυχία επαναφοράς demo δεδομένων",
        variant: "destructive",
      })
    } finally {
      setResettingDemo(false)
    }
  }

  async function handleExportCustomersExcel() {
    if (!businessId) return
    try {
      setExportingCustomers(true)
      const customers = await fetchCustomers(businessId)
      if (!customers.length) {
        toast({ title: "Δεν υπάρχουν δεδομένα", description: "Δεν βρέθηκαν πελάτες για εξαγωγή." })
        return
      }

      const rows = customers.map((c) => ({
        ID: c.id,
        "Όνομα": c.first_name ?? "",
        "Επώνυμο": c.last_name ?? "",
        "Τηλέφωνο": c.phone ?? "",
        Email: c.email ?? "",
        "Διεύθυνση": c.address ?? "",
        "Περιοχή": c.area ?? "",
        "Τ.Κ.": c.postal_code ?? "",
        "Εταιρεία": c.company ?? "",
        ΑΦΜ: c.vat_number ?? "",
        Tags: Array.isArray(c.tags) ? c.tags.join(", ") : "",
        "Ημ/νία Δημιουργίας": c.created_at ?? "",
      }))

      const worksheet = XLSX.utils.json_to_sheet(rows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Customers")
      const today = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(workbook, `customers-export-${today}.xlsx`)
      toast({ title: "Ολοκληρώθηκε", description: "Το Excel αρχείο πελατών δημιουργήθηκε επιτυχώς." })
    } catch (e) {
      toast({
        title: "Σφάλμα",
        description: e instanceof Error ? e.message : "Αποτυχία εξαγωγής αρχείου Excel",
        variant: "destructive",
      })
    } finally {
      setExportingCustomers(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <div className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-r from-primary/20 via-purple-500/10 to-transparent blur-2xl" />
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur">
          <Sparkles className="h-4 w-4 text-primary" />
          Εφαρμογή • Ρυθμίσεις
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Ρυθμίσεις</h1>
        <p className="text-muted-foreground">Μόνο ρυθμίσεις εμφάνισης και εμπειρίας εφαρμογής.</p>
        <div className="mt-3 h-px w-full max-w-xl bg-gradient-to-r from-primary/40 via-purple-500/20 to-transparent" />
      </div>

      <Tabs defaultValue="appearance" className="space-y-4">
        <TabsList className="bg-card/60 border border-border/60 backdrop-blur text-[11px]">
          <TabsTrigger value="appearance">Εμφάνιση</TabsTrigger>
          <TabsTrigger value="notifications">Telegram</TabsTrigger>
          <TabsTrigger value="exports">Exports</TabsTrigger>
          {isDemoPlan && <TabsTrigger value="demo">Demo Panel</TabsTrigger>}
        </TabsList>

        <TabsContent value="appearance">
          <Card className="border-border/60 bg-card/60 backdrop-blur-xl shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="h-4 w-4 text-primary" />
                Premium εμφάνιση εφαρμογής
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Theme preset</Label>
                <Select value={selectedThemePreset} onValueChange={handleThemePresetChange}>
                  <SelectTrigger className="w-full max-w-sm bg-background/40 border-border/60">
                    <SelectValue placeholder="Επίλεξε θέμα" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light:default">Κλασικό - Φωτεινό</SelectItem>
                    <SelectItem value="dark:default">Κλασικό - Σκούρο</SelectItem>
                    <SelectItem value="system:default">Κλασικό - Σύστημα</SelectItem>
                    <SelectItem value="light:beauty">Beauty Pink - Φωτεινό</SelectItem>
                    <SelectItem value="dark:beauty">Beauty Pink - Σκούρο</SelectItem>
                    <SelectItem value="system:beauty">Beauty Pink - Σύστημα</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Το “Beauty Pink” είναι πιο premium επιλογή για beauty/wellness επιχειρήσεις.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="border-border/60 bg-card/60 backdrop-blur-xl shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-4 w-4 text-primary" />
                Ρυθμίσεις Telegram ειδοποιήσεων
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/40 px-3 py-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Enable Telegram Notifications</p>
                  <p className="text-xs text-muted-foreground">
                    Ενεργοποίηση αποστολής ειδοποιήσεων στο Telegram.
                  </p>
                </div>
                <Switch checked={telegramEnabled} onCheckedChange={setTelegramEnabled} />
              </div>

              <div className="space-y-1">
                <Label>Telegram Chat ID</Label>
                <Input
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="π.χ. -1001234567890"
                  className="max-w-md bg-background/40 border-border/60"
                />
              </div>

              <div className="space-y-1">
                <Label>Telegram Bot Token</Label>
                <Input
                  type="password"
                  value={telegramBotToken}
                  onChange={(e) => setTelegramBotToken(e.target.value)}
                  placeholder="π.χ. 123456789:AA..."
                  className="max-w-md bg-background/40 border-border/60"
                />
              </div>

              <div className="space-y-3 rounded-xl border border-border/60 bg-background/40 p-3">
                <p className="text-sm font-medium">Επιλογή ειδοποιήσεων Telegram</p>
                {[
                  { key: "appointment_created", label: "Νέο ραντεβού" },
                  { key: "appointment_cancelled_or_no_show", label: "Ακύρωση / no-show" },
                  { key: "appointment_rescheduled", label: "Επαναπρογραμματισμός" },
                  { key: "payment_recorded", label: "Πληρωμές (νέα/μερική)" },
                  { key: "support_incident_new", label: "Νέο support incident" },
                  { key: "support_reply", label: "Απάντηση support" },
                  { key: "daily_summary", label: "Καθημερινό summary" },
                  { key: "morning_briefing", label: "Πρωινό briefing" },
                  { key: "plan_limits", label: "Όρια πλάνου" },
                  { key: "subscription_alerts", label: "Λήξη συνδρομής" },
                  { key: "reminder_30m", label: "Υπενθύμιση 30 λεπτά πριν" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <p className="text-sm">{item.label}</p>
                    <Switch
                      checked={telegramPreferences[item.key as keyof TelegramNotificationPreferences]}
                      onCheckedChange={(checked) =>
                        setTelegramPreferences((prev) => ({
                          ...prev,
                          [item.key]: checked,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button type="button" onClick={handleSaveNotifications} disabled={savingNotifications}>
                  {savingNotifications ? "Αποθήκευση..." : "Αποθήκευση ειδοποιήσεων"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exports">
          <Card className="border-border/60 bg-card/60 backdrop-blur-xl shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4 text-primary" />
                Data export
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Εξαγωγή λίστας πελατών σε αρχείο Excel για backup ή μεταφορά σε άλλο σύστημα.
              </p>
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={handleExportCustomersExcel} disabled={exportingCustomers}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  {exportingCustomers ? "Εξαγωγή..." : "Export πελατών σε Excel"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isDemoPlan && (
          <TabsContent value="demo">
            <Card className="border-destructive/40 bg-card/60 backdrop-blur-xl shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
              <CardHeader>
                <CardTitle className="text-base text-destructive">Demo Panel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Επαναφορά όλων των δεδομένων δοκιμής για να είναι ο λογαριασμός έτοιμος για την επόμενη χρήση.
                </p>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleResetDemoData}
                    disabled={resettingDemo}
                  >
                    {resettingDemo ? "Επαναφορά..." : "Επαναφορά όλων (Demo)"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
