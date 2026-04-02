import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useLanguage } from "@/contexts/LanguageContext"
import { fetchBusiness, fetchCustomers, resetDemoBusiness, notifyInAppQuiet } from "@/services/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useTheme } from "@/components/theme-provider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sparkles, Palette, FileSpreadsheet, Database } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import * as XLSX from "xlsx"
import { Link as LinkIcon } from "lucide-react"

const settingsI18n = {
  el: {
    breadcrumb: "Εφαρμογή • Ρυθμίσεις",
    pageTitle: "Ρυθμίσεις",
    pageSubtitle: "Μόνο ρυθμίσεις εμφάνισης και εμπειρίας εφαρμογής.",
    tabAppearance: "Εμφάνιση",
    tabBooking: "Public Booking",
    tabExports: "Exports",
    tabDemo: "Demo Panel",
    premiumAppearance: "Premium εμφάνιση εφαρμογής",
    themePreset: "Προεπιλογή θέματος",
    selectThemePlaceholder: "Επίλεξε θέμα",
    presetClassicLight: "Κλασικό - Φωτεινό",
    presetClassicDark: "Κλασικό - Σκούρο",
    presetClassicSystem: "Κλασικό - Σύστημα",
    presetBeautyLight: "Beauty Pink - Φωτεινό",
    presetBeautyDark: "Beauty Pink - Σκούρο",
    presetBeautySystem: "Beauty Pink - Σύστημα",
    beautyHint: "Το «Beauty Pink» είναι πιο premium επιλογή για beauty/wellness επιχειρήσεις.",
    dataExportTitle: "Εξαγωγή δεδομένων",
    dataExportDesc:
      "Εξαγωγή λίστας πελατών σε αρχείο Excel για backup ή μεταφορά σε άλλο σύστημα.",
    exportCustomersExcel: "Εξαγωγή πελατών σε Excel",
    exporting: "Εξαγωγή...",
    publicBookingTitle: "Δημόσια σελίδα κρατήσεων",
    enableOnlineBooking: "Ενεργοποίηση online κρατήσεων",
    enableOnlineBookingDesc: "Δημόσια σελίδα κρατήσεων χωρίς login για τους πελάτες σου.",
    bookingSlug: "Slug κρατήσεων",
    slugPlaceholder: "π.χ. nansy-nails",
    linkPrefix: "Link:",
    bookingWindowDays: "Παράθυρο κρατήσεων (ημέρες)",
    theme: "Θέμα",
    bookingThemeDefault: "Default (ουδέτερο)",
    bookingThemeBeauty: "Beauty Pink (νύχια/αισθητική)",
    bookingThemeSalon: "Salon Luxe (κομμωτήριο/spa)",
    bookingThemeCraftsman: "Craftsman Pro (μάστορες/τεχνίτες)",
    bookingThemeMedical: "Medical Clean (ιατροί/κλινικές)",
    startHour: "Έναρξη ωραρίου (0-23)",
    endHour: "Λήξη ωραρίου (1-24)",
    slotStep: "Βήμα slots (λεπτά)",
    minNotice: "Ελάχιστη προειδοποίηση (ώρες)",
    requireApproval: "Απαιτείται έγκριση",
    requireApprovalDesc: "Νέες κρατήσεις ως pending για χειροκίνητη έγκριση.",
    saveBooking: "Αποθήκευση ρυθμίσεων κρατήσεων",
    savingBooking: "Αποθήκευση...",
    demoPanelTitle: "Demo Panel",
    demoPanelDesc:
      "Επαναφορά όλων των δεδομένων δοκιμής για να είναι ο λογαριασμός έτοιμος για την επόμενη χρήση.",
    resetDemoAll: "Επαναφορά όλων (Demo)",
    resettingDemo: "Επαναφορά...",
    error: "Σφάλμα",
    resetDoneTitle: "Έγινε επαναφορά",
    resetDoneDesc: "Τα δεδομένα demo διαγράφηκαν και ο λογαριασμός είναι έτοιμος για νέα δοκιμή.",
    resetFailed: "Αποτυχία επαναφοράς demo δεδομένων",
    confirmResetDemo:
      "Θέλεις σίγουρα να γίνει επαναφορά demo; Θα διαγραφούν ραντεβού, πληρωμές, πελάτες, υπηρεσίες και αιτήματα support.",
    noDataTitle: "Δεν υπάρχουν δεδομένα",
    noCustomersExport: "Δεν βρέθηκαν πελάτες για εξαγωγή.",
    exportDoneTitle: "Ολοκληρώθηκε",
    exportDoneDesc: "Το Excel αρχείο πελατών δημιουργήθηκε επιτυχώς.",
    exportFailed: "Αποτυχία εξαγωγής αρχείου Excel",
    exportNotify: (count: number, date: string) =>
      `Εξαγωγή Excel ολοκληρώθηκε: ${count} πελάτες (${date}).`,
    bookingSlugError: "Συμπλήρωσε έγκυρο slug κρατήσεων.",
    bookingHoursError: "Η ώρα έναρξης πρέπει να είναι πριν τη λήξη.",
    bookingSavedTitle: "Αποθηκεύτηκε",
    bookingSavedDesc: "Οι ρυθμίσεις δημόσιας κράτησης ενημερώθηκαν.",
    bookingSaveFailed: "Αποτυχία αποθήκευσης ρυθμίσεων κρατήσεων",
    excel: {
      id: "ID",
      firstName: "Όνομα",
      lastName: "Επώνυμο",
      phone: "Τηλέφωνο",
      email: "Email",
      address: "Διεύθυνση",
      area: "Περιοχή",
      postal: "Τ.Κ.",
      company: "Εταιρεία",
      vat: "ΑΦΜ",
      tags: "Tags",
      createdAt: "Ημ/νία Δημιουργίας",
    },
  },
  en: {
    breadcrumb: "Application • Settings",
    pageTitle: "Settings",
    pageSubtitle: "Appearance and app experience settings only.",
    tabAppearance: "Appearance",
    tabBooking: "Public Booking",
    tabExports: "Exports",
    tabDemo: "Demo Panel",
    premiumAppearance: "Premium app appearance",
    themePreset: "Theme preset",
    selectThemePlaceholder: "Choose theme",
    presetClassicLight: "Classic - Light",
    presetClassicDark: "Classic - Dark",
    presetClassicSystem: "Classic - System",
    presetBeautyLight: "Beauty Pink - Light",
    presetBeautyDark: "Beauty Pink - Dark",
    presetBeautySystem: "Beauty Pink - System",
    beautyHint: "“Beauty Pink” is a more premium option for beauty/wellness businesses.",
    dataExportTitle: "Data export",
    dataExportDesc: "Export your customer list to an Excel file for backup or migration to another system.",
    exportCustomersExcel: "Export customers to Excel",
    exporting: "Exporting...",
    publicBookingTitle: "Public booking page",
    enableOnlineBooking: "Enable online booking",
    enableOnlineBookingDesc: "Public booking page without login for your customers.",
    bookingSlug: "Booking slug",
    slugPlaceholder: "e.g. my-business",
    linkPrefix: "Link:",
    bookingWindowDays: "Booking window (days)",
    theme: "Theme",
    bookingThemeDefault: "Default (neutral)",
    bookingThemeBeauty: "Beauty Pink (nails/aesthetics)",
    bookingThemeSalon: "Salon Luxe (hair salon/spa)",
    bookingThemeCraftsman: "Craftsman Pro (trades/crafts)",
    bookingThemeMedical: "Medical Clean (doctors/clinics)",
    startHour: "Day start hour (0-23)",
    endHour: "Day end hour (1-24)",
    slotStep: "Slot step (minutes)",
    minNotice: "Minimum notice (hours)",
    requireApproval: "Require approval",
    requireApprovalDesc: "New bookings stay pending until you approve them manually.",
    saveBooking: "Save booking settings",
    savingBooking: "Saving...",
    demoPanelTitle: "Demo Panel",
    demoPanelDesc: "Reset all demo data so the account is ready for the next trial.",
    resetDemoAll: "Reset all (Demo)",
    resettingDemo: "Resetting...",
    error: "Error",
    resetDoneTitle: "Reset complete",
    resetDoneDesc: "Demo data was cleared and the account is ready for a fresh trial.",
    resetFailed: "Failed to reset demo data",
    confirmResetDemo:
      "Reset demo data? This will delete appointments, payments, customers, services, and support requests.",
    noDataTitle: "No data",
    noCustomersExport: "No customers found to export.",
    exportDoneTitle: "Complete",
    exportDoneDesc: "Customer Excel file was created successfully.",
    exportFailed: "Failed to export Excel file",
    exportNotify: (count: number, date: string) => `Excel export complete: ${count} customers (${date}).`,
    bookingSlugError: "Enter a valid booking slug.",
    bookingHoursError: "Start hour must be before end hour.",
    bookingSavedTitle: "Saved",
    bookingSavedDesc: "Public booking settings were updated.",
    bookingSaveFailed: "Failed to save booking settings",
    excel: {
      id: "ID",
      firstName: "First name",
      lastName: "Last name",
      phone: "Phone",
      email: "Email",
      address: "Address",
      area: "Area",
      postal: "Postal code",
      company: "Company",
      vat: "VAT",
      tags: "Tags",
      createdAt: "Created at",
    },
  },
  de: {
    breadcrumb: "Anwendung · Einstellungen",
    pageTitle: "Einstellungen",
    pageSubtitle: "Nur Darstellung und Erlebnis der App.",
    tabAppearance: "Erscheinungsbild",
    tabBooking: "Öffentliche Buchung",
    tabExports: "Exporte",
    tabDemo: "Demo-Panel",
    premiumAppearance: "Premium-Erscheinungsbild",
    themePreset: "Themen-Voreinstellung",
    selectThemePlaceholder: "Thema wählen",
    presetClassicLight: "Klassisch – Hell",
    presetClassicDark: "Klassisch – Dunkel",
    presetClassicSystem: "Klassisch – System",
    presetBeautyLight: "Beauty Pink – Hell",
    presetBeautyDark: "Beauty Pink – Dunkel",
    presetBeautySystem: "Beauty Pink – System",
    beautyHint: "„Beauty Pink“ ist eine anspruchsvollere Option für Beauty-/Wellness-Betriebe.",
    dataExportTitle: "Datenexport",
    dataExportDesc: "Kundenliste als Excel-Datei exportieren – für Backup oder Wechsel.",
    exportCustomersExcel: "Kunden nach Excel exportieren",
    exporting: "Export...",
    publicBookingTitle: "Öffentliche Buchungsseite",
    enableOnlineBooking: "Online-Buchung aktivieren",
    enableOnlineBookingDesc: "Öffentliche Buchungsseite ohne Login für Ihre Kunden.",
    bookingSlug: "Buchungs-Slug",
    slugPlaceholder: "z. B. mein-betrieb",
    linkPrefix: "Link:",
    bookingWindowDays: "Buchungsfenster (Tage)",
    theme: "Thema",
    bookingThemeDefault: "Standard (neutral)",
    bookingThemeBeauty: "Beauty Pink (Nagel/Ästhetik)",
    bookingThemeSalon: "Salon Luxe (Friseur/Spa)",
    bookingThemeCraftsman: "Craftsman Pro (Handwerk)",
    bookingThemeMedical: "Medical Clean (Ärzte/Kliniken)",
    startHour: "Startstunde (0–23)",
    endHour: "Endstunde (1–24)",
    slotStep: "Slot-Abstand (Minuten)",
    minNotice: "Mindestvorlauf (Stunden)",
    requireApproval: "Freigabe erforderlich",
    requireApprovalDesc: "Neue Buchungen bleiben ausstehend, bis Sie sie freigeben.",
    saveBooking: "Buchungseinstellungen speichern",
    savingBooking: "Speichern...",
    demoPanelTitle: "Demo-Panel",
    demoPanelDesc: "Alle Demo-Daten zurücksetzen, damit das Konto bereit für den nächsten Test ist.",
    resetDemoAll: "Alles zurücksetzen (Demo)",
    resettingDemo: "Zurücksetzen...",
    error: "Fehler",
    resetDoneTitle: "Zurücksetzen abgeschlossen",
    resetDoneDesc: "Demo-Daten wurden gelöscht, das Konto ist bereit.",
    resetFailed: "Demo-Daten konnten nicht zurückgesetzt werden",
    confirmResetDemo:
      "Demo wirklich zurücksetzen? Termine, Zahlungen, Kunden, Leistungen und Support-Anfragen werden gelöscht.",
    noDataTitle: "Keine Daten",
    noCustomersExport: "Keine Kunden zum Exportieren.",
    exportDoneTitle: "Fertig",
    exportDoneDesc: "Excel-Datei wurde erstellt.",
    exportFailed: "Excel-Export fehlgeschlagen",
    exportNotify: (count: number, date: string) => `Excel-Export abgeschlossen: ${count} Kunden (${date}).`,
    bookingSlugError: "Bitte einen gültigen Buchungs-Slug eingeben.",
    bookingHoursError: "Startstunde muss vor Endstunde liegen.",
    bookingSavedTitle: "Gespeichert",
    bookingSavedDesc: "Öffentliche Buchungseinstellungen wurden aktualisiert.",
    bookingSaveFailed: "Buchungseinstellungen konnten nicht gespeichert werden",
    excel: {
      id: "ID",
      firstName: "Vorname",
      lastName: "Nachname",
      phone: "Telefon",
      email: "E-Mail",
      address: "Adresse",
      area: "Region",
      postal: "PLZ",
      company: "Firma",
      vat: "USt-IdNr.",
      tags: "Tags",
      createdAt: "Erstellt am",
    },
  },
}

export default function Settings() {
  const { businessId } = useAuth()
  const { language } = useLanguage()
  const t = settingsI18n[language]
  const { theme, setTheme, palette, setPalette } = useTheme()
  const { toast } = useToast()
  const [isDemoPlan, setIsDemoPlan] = useState(false)
  const [resettingDemo, setResettingDemo] = useState(false)
  const [exportingCustomers, setExportingCustomers] = useState(false)
  const [bookingEnabled, setBookingEnabled] = useState(false)
  const [bookingSlug, setBookingSlug] = useState("")
  const [bookingRequiresApproval, setBookingRequiresApproval] = useState(true)
  const [bookingWindowDays, setBookingWindowDays] = useState(30)
  const [bookingTheme, setBookingTheme] = useState("default")
  const [bookingStartHour, setBookingStartHour] = useState(9)
  const [bookingEndHour, setBookingEndHour] = useState(20)
  const [bookingSlotIntervalMinutes, setBookingSlotIntervalMinutes] = useState(15)
  const [bookingMinNoticeHours, setBookingMinNoticeHours] = useState(0)
  const [savingBooking, setSavingBooking] = useState(false)

  const selectedThemePreset = useMemo(() => `${theme}:${palette}`, [theme, palette])

  function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message
    if (typeof error === "object" && error !== null && "message" in error) {
      const msg = (error as { message?: unknown }).message
      if (typeof msg === "string" && msg.trim()) return msg
    }
    return fallback
  }

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
      setIsDemoPlan((b.subscription_plan ?? "").toLowerCase() === "demo")
      setBookingEnabled(Boolean((b as any).booking_enabled))
      setBookingSlug(((b as any).booking_slug ?? "").toString())
      setBookingRequiresApproval(Boolean((b as any).booking_requires_approval ?? true))
      setBookingWindowDays(Number((b as any).booking_window_days ?? 30))
      setBookingTheme(((b as any).booking_theme ?? "default").toString())
      setBookingStartHour(Number((b as any).booking_start_hour ?? 9))
      setBookingEndHour(Number((b as any).booking_end_hour ?? 20))
      setBookingSlotIntervalMinutes(Number((b as any).booking_slot_interval_minutes ?? 15))
      setBookingMinNoticeHours(Number((b as any).booking_min_notice_hours ?? 0))
    })
  }, [businessId])

  async function handleResetDemoData() {
    if (!businessId) return
    const ok = window.confirm(t.confirmResetDemo)
    if (!ok) return
    try {
      setResettingDemo(true)
      await resetDemoBusiness(businessId)
      toast({
        title: t.resetDoneTitle,
        description: t.resetDoneDesc,
      })
    } catch (e) {
      toast({
        title: t.error,
        description: e instanceof Error ? e.message : t.resetFailed,
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
        toast({ title: t.noDataTitle, description: t.noCustomersExport })
        return
      }

      const x = t.excel
      const rows = customers.map((c) => ({
        [x.id]: c.id,
        [x.firstName]: c.first_name ?? "",
        [x.lastName]: c.last_name ?? "",
        [x.phone]: c.phone ?? "",
        [x.email]: c.email ?? "",
        [x.address]: c.address ?? "",
        [x.area]: c.area ?? "",
        [x.postal]: c.postal_code ?? "",
        [x.company]: c.company ?? "",
        [x.vat]: c.vat_number ?? "",
        [x.tags]: Array.isArray(c.tags) ? c.tags.join(", ") : "",
        [x.createdAt]: c.created_at ?? "",
      }))

      const worksheet = XLSX.utils.json_to_sheet(rows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Customers")
      const today = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(workbook, `customers-export-${today}.xlsx`)
      await notifyInAppQuiet(
        businessId,
        t.exportNotify(customers.length, today),
        { notificationType: "data_export", metadata: { format: "xlsx_customers", row_count: customers.length } },
      )
      toast({ title: t.exportDoneTitle, description: t.exportDoneDesc })
    } catch (e) {
      toast({
        title: t.error,
        description: e instanceof Error ? e.message : t.exportFailed,
        variant: "destructive",
      })
    } finally {
      setExportingCustomers(false)
    }
  }

  async function handleSaveBookingSettings() {
    if (!businessId) return
    const normalizedSlug = bookingSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "")
    if (bookingEnabled && !normalizedSlug) {
      toast({ title: t.error, description: t.bookingSlugError, variant: "destructive" })
      return
    }
    if (bookingStartHour >= bookingEndHour) {
      toast({ title: t.error, description: t.bookingHoursError, variant: "destructive" })
      return
    }
    try {
      setSavingBooking(true)
      const { error } = await supabase
        .from("businesses")
        .update({
          booking_enabled: bookingEnabled,
          booking_slug: normalizedSlug || null,
          booking_requires_approval: bookingRequiresApproval,
          booking_window_days: Math.max(1, Number(bookingWindowDays || 1)),
          booking_theme: bookingTheme || "default",
          booking_start_hour: Math.min(23, Math.max(0, Number(bookingStartHour || 0))),
          booking_end_hour: Math.min(24, Math.max(1, Number(bookingEndHour || 1))),
          booking_slot_interval_minutes: [5, 10, 15, 20, 30, 60].includes(Number(bookingSlotIntervalMinutes))
            ? Number(bookingSlotIntervalMinutes)
            : 15,
          booking_min_notice_hours: Math.min(168, Math.max(0, Number(bookingMinNoticeHours || 0))),
        })
        .eq("id", businessId)
      if (error) throw error
      setBookingSlug(normalizedSlug)
      toast({ title: t.bookingSavedTitle, description: t.bookingSavedDesc })
    } catch (e) {
      toast({
        title: t.error,
        description: getErrorMessage(e, t.bookingSaveFailed),
        variant: "destructive",
      })
    } finally {
      setSavingBooking(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <div className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-r from-primary/20 via-purple-500/10 to-transparent blur-2xl" />
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur">
          <Sparkles className="h-4 w-4 text-primary" />
          {t.breadcrumb}
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{t.pageTitle}</h1>
        <p className="text-muted-foreground">{t.pageSubtitle}</p>
        <div className="mt-3 h-px w-full max-w-xl bg-gradient-to-r from-primary/40 via-purple-500/20 to-transparent" />
      </div>

      <Tabs defaultValue="appearance" className="space-y-4">
        <TabsList className="w-full bg-card/60 border border-border/60 backdrop-blur text-[11px]">
          <TabsTrigger value="appearance">{t.tabAppearance}</TabsTrigger>
          <TabsTrigger value="booking">{t.tabBooking}</TabsTrigger>
          <TabsTrigger value="exports">{t.tabExports}</TabsTrigger>
          {isDemoPlan && <TabsTrigger value="demo">{t.tabDemo}</TabsTrigger>}
        </TabsList>

        <TabsContent value="appearance">
          <Card className="border-border/60 bg-card/60 backdrop-blur-xl shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="h-4 w-4 text-primary" />
                {t.premiumAppearance}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>{t.themePreset}</Label>
                <Select value={selectedThemePreset} onValueChange={handleThemePresetChange}>
                  <SelectTrigger className="w-full max-w-sm bg-background/40 border-border/60">
                    <SelectValue placeholder={t.selectThemePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light:default">{t.presetClassicLight}</SelectItem>
                    <SelectItem value="dark:default">{t.presetClassicDark}</SelectItem>
                    <SelectItem value="system:default">{t.presetClassicSystem}</SelectItem>
                    <SelectItem value="light:beauty">{t.presetBeautyLight}</SelectItem>
                    <SelectItem value="dark:beauty">{t.presetBeautyDark}</SelectItem>
                    <SelectItem value="system:beauty">{t.presetBeautySystem}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">{t.beautyHint}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exports">
          <Card className="border-border/60 bg-card/60 backdrop-blur-xl shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4 text-primary" />
                {t.dataExportTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{t.dataExportDesc}</p>
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={handleExportCustomersExcel} disabled={exportingCustomers}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  {exportingCustomers ? t.exporting : t.exportCustomersExcel}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="booking">
          <Card className="border-border/60 bg-card/60 backdrop-blur-xl shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <LinkIcon className="h-4 w-4 text-primary" />
                {t.publicBookingTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/60 bg-background/40 px-3 py-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{t.enableOnlineBooking}</p>
                  <p className="text-xs text-muted-foreground">{t.enableOnlineBookingDesc}</p>
                </div>
                <Switch checked={bookingEnabled} onCheckedChange={setBookingEnabled} />
              </div>
              <div className="space-y-1">
                <Label>{t.bookingSlug}</Label>
                <Input
                  value={bookingSlug}
                  onChange={(e) => setBookingSlug(e.target.value)}
                  placeholder={t.slugPlaceholder}
                  className="w-full sm:max-w-md bg-background/40 border-border/60"
                />
                {bookingSlug.trim() ? (
                  <p className="text-xs text-muted-foreground">
                    {t.linkPrefix} {window.location.origin}/book/{bookingSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "")}
                  </p>
                ) : null}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{t.bookingWindowDays}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={bookingWindowDays}
                    onChange={(e) => setBookingWindowDays(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full sm:max-w-md bg-background/40 border-border/60"
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t.theme}</Label>
                  <Select value={bookingTheme} onValueChange={setBookingTheme}>
                    <SelectTrigger className="w-full sm:max-w-md bg-background/40 border-border/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">{t.bookingThemeDefault}</SelectItem>
                      <SelectItem value="beauty">{t.bookingThemeBeauty}</SelectItem>
                      <SelectItem value="salon_luxe">{t.bookingThemeSalon}</SelectItem>
                      <SelectItem value="craftsman">{t.bookingThemeCraftsman}</SelectItem>
                      <SelectItem value="medical">{t.bookingThemeMedical}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{t.startHour}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={bookingStartHour}
                    onChange={(e) => setBookingStartHour(Math.min(23, Math.max(0, Number(e.target.value) || 0)))}
                    className="w-full sm:max-w-md bg-background/40 border-border/60"
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t.endHour}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={24}
                    value={bookingEndHour}
                    onChange={(e) => setBookingEndHour(Math.min(24, Math.max(1, Number(e.target.value) || 1)))}
                    className="w-full sm:max-w-md bg-background/40 border-border/60"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{t.slotStep}</Label>
                  <Select
                    value={String(bookingSlotIntervalMinutes)}
                    onValueChange={(v) => setBookingSlotIntervalMinutes(Number(v))}
                  >
                    <SelectTrigger className="w-full sm:max-w-md bg-background/40 border-border/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5'</SelectItem>
                      <SelectItem value="10">10'</SelectItem>
                      <SelectItem value="15">15'</SelectItem>
                      <SelectItem value="20">20'</SelectItem>
                      <SelectItem value="30">30'</SelectItem>
                      <SelectItem value="60">60'</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{t.minNotice}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={168}
                    value={bookingMinNoticeHours}
                    onChange={(e) => setBookingMinNoticeHours(Math.min(168, Math.max(0, Number(e.target.value) || 0)))}
                    className="w-full sm:max-w-md bg-background/40 border-border/60"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/60 bg-background/40 px-3 py-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{t.requireApproval}</p>
                  <p className="text-xs text-muted-foreground">{t.requireApprovalDesc}</p>
                </div>
                <Switch checked={bookingRequiresApproval} onCheckedChange={setBookingRequiresApproval} />
              </div>
              <div className="flex justify-end">
                <Button type="button" onClick={handleSaveBookingSettings} disabled={savingBooking}>
                  {savingBooking ? t.savingBooking : t.saveBooking}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isDemoPlan && (
          <TabsContent value="demo">
            <Card className="border-destructive/40 bg-card/60 backdrop-blur-xl shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
              <CardHeader>
                <CardTitle className="text-base text-destructive">{t.demoPanelTitle}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{t.demoPanelDesc}</p>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleResetDemoData}
                    disabled={resettingDemo}
                  >
                    {resettingDemo ? t.resettingDemo : t.resetDemoAll}
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
