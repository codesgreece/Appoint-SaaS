import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { fetchBusiness, fetchCustomers, resetDemoBusiness } from "@/services/api"
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

export default function Settings() {
  const { businessId } = useAuth()
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
  const [savingBooking, setSavingBooking] = useState(false)

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
      setIsDemoPlan((b.subscription_plan ?? "").toLowerCase() === "demo")
      setBookingEnabled(Boolean((b as any).booking_enabled))
      setBookingSlug(((b as any).booking_slug ?? "").toString())
      setBookingRequiresApproval(Boolean((b as any).booking_requires_approval ?? true))
      setBookingWindowDays(Number((b as any).booking_window_days ?? 30))
      setBookingTheme(((b as any).booking_theme ?? "default").toString())
    })
  }, [businessId])

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

  async function handleSaveBookingSettings() {
    if (!businessId) return
    const normalizedSlug = bookingSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "")
    if (bookingEnabled && !normalizedSlug) {
      toast({ title: "Σφάλμα", description: "Συμπλήρωσε έγκυρο booking slug.", variant: "destructive" })
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
        })
        .eq("id", businessId)
      if (error) throw error
      setBookingSlug(normalizedSlug)
      toast({ title: "Αποθηκεύτηκε", description: "Οι ρυθμίσεις public booking ενημερώθηκαν." })
    } catch (e) {
      toast({
        title: "Σφάλμα",
        description: e instanceof Error ? e.message : "Αποτυχία αποθήκευσης booking settings",
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
          Εφαρμογή • Ρυθμίσεις
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Ρυθμίσεις</h1>
        <p className="text-muted-foreground">Μόνο ρυθμίσεις εμφάνισης και εμπειρίας εφαρμογής.</p>
        <div className="mt-3 h-px w-full max-w-xl bg-gradient-to-r from-primary/40 via-purple-500/20 to-transparent" />
      </div>

      <Tabs defaultValue="appearance" className="space-y-4">
        <TabsList className="bg-card/60 border border-border/60 backdrop-blur text-[11px]">
          <TabsTrigger value="appearance">Εμφάνιση</TabsTrigger>
          <TabsTrigger value="booking">Public Booking</TabsTrigger>
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

        <TabsContent value="booking">
          <Card className="border-border/60 bg-card/60 backdrop-blur-xl shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <LinkIcon className="h-4 w-4 text-primary" />
                Public booking page
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/40 px-3 py-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Enable online booking</p>
                  <p className="text-xs text-muted-foreground">
                    Δημόσια σελίδα κρατήσεων χωρίς login για τους πελάτες σου.
                  </p>
                </div>
                <Switch checked={bookingEnabled} onCheckedChange={setBookingEnabled} />
              </div>
              <div className="space-y-1">
                <Label>Booking slug</Label>
                <Input
                  value={bookingSlug}
                  onChange={(e) => setBookingSlug(e.target.value)}
                  placeholder="π.χ. nansy-nails"
                  className="max-w-md bg-background/40 border-border/60"
                />
                {bookingSlug.trim() ? (
                  <p className="text-xs text-muted-foreground">
                    Link: {window.location.origin}/book/{bookingSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "")}
                  </p>
                ) : null}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Booking window (ημέρες)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={bookingWindowDays}
                    onChange={(e) => setBookingWindowDays(Math.max(1, Number(e.target.value) || 1))}
                    className="max-w-md bg-background/40 border-border/60"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Theme</Label>
                  <Select value={bookingTheme} onValueChange={setBookingTheme}>
                    <SelectTrigger className="max-w-md bg-background/40 border-border/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default (ουδέτερο)</SelectItem>
                      <SelectItem value="beauty">Beauty Pink (νύχια/αισθητική)</SelectItem>
                      <SelectItem value="salon_luxe">Salon Luxe (κομμωτήριο/spa)</SelectItem>
                      <SelectItem value="craftsman">Craftsman Pro (μάστορες/τεχνίτες)</SelectItem>
                      <SelectItem value="medical">Medical Clean (ιατροί/κλινικές)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/40 px-3 py-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Require approval</p>
                  <p className="text-xs text-muted-foreground">Νέες κρατήσεις ως pending για χειροκίνητη έγκριση.</p>
                </div>
                <Switch checked={bookingRequiresApproval} onCheckedChange={setBookingRequiresApproval} />
              </div>
              <div className="flex justify-end">
                <Button type="button" onClick={handleSaveBookingSettings} disabled={savingBooking}>
                  {savingBooking ? "Αποθήκευση..." : "Αποθήκευση booking settings"}
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
