import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { fetchBusiness, resetDemoBusiness } from "@/services/api"
import type { Business, User } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useTheme } from "@/components/theme-provider"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export default function Settings() {
  const { businessId, user, supabaseUser } = useAuth()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  const [loadingBusiness, setLoadingBusiness] = useState(true)
  const [savingBusiness, setSavingBusiness] = useState(false)
  const [savingAccount, setSavingAccount] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null)
  const [resettingDemo, setResettingDemo] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const canResetDemo =
    businessId &&
    user &&
    (user.role === "admin" || user.role === "super_admin") &&
    subscriptionPlan === "demo"

  const [businessForm, setBusinessForm] = useState({
    name: "",
    business_type: "",
    phone: "",
    email: "",
    address: "",
    currency: "EUR",
    language: "el",
  })

  const [accountForm, setAccountForm] = useState({
    full_name: "",
    email: "",
  })

  const [passwordForm, setPasswordForm] = useState({
    current: "",
    next: "",
    confirm: "",
  })

  useEffect(() => {
    if (!businessId) return
    setLoadingBusiness(true)
    fetchBusiness(businessId)
      .then((b) => {
        if (b) {
          setSubscriptionPlan(b.subscription_plan ?? null)
          setBusinessForm({
            name: b.name ?? "",
            business_type: b.business_type ?? "",
            phone: b.phone ?? "",
            email: b.email ?? "",
            address: b.address ?? "",
            currency: "EUR",
            language: "el",
          })
        }
      })
      .finally(() => setLoadingBusiness(false))
  }, [businessId])

  useEffect(() => {
    if (user) {
      setAccountForm({
        full_name: user.full_name,
        email: user.email,
      })
    }
  }, [user])

  async function handleSaveBusiness() {
    if (!businessId) return
    try {
      setSavingBusiness(true)
      const updates: Partial<Business> = {
        name: businessForm.name.trim(),
        business_type: businessForm.business_type.trim() || null,
        phone: businessForm.phone.trim() || null,
        email: businessForm.email.trim() || null,
        address: businessForm.address.trim() || null,
      }
      const { data, error } = await supabase
        .from("businesses")
        .update(updates)
        .eq("id", businessId)
        .select()
        .single()
      if (error) throw error
      setBusinessForm({
        name: (data as Business).name ?? businessForm.name,
        business_type: (data as Business).business_type ?? businessForm.business_type,
        phone: (data as Business).phone ?? businessForm.phone,
        email: (data as Business).email ?? businessForm.email,
        address: (data as Business).address ?? businessForm.address,
        currency: businessForm.currency,
        language: businessForm.language,
      })
      toast({ title: "Αποθηκεύτηκε", description: "Τα στοιχεία της επιχείρησης ενημερώθηκαν." })
    } catch (err) {
      console.error("Save business settings error:", err)
      const message = err instanceof Error ? err.message : "Αποτυχία αποθήκευσης"
      toast({ title: "Σφάλμα", description: message, variant: "destructive" })
    } finally {
      setSavingBusiness(false)
    }
  }

  async function handleSaveAccount() {
    if (!user) return
    try {
      setSavingAccount(true)
      const updates: Partial<User> = {
        full_name: accountForm.full_name.trim(),
        email: accountForm.email.trim(),
      }
      const { error } = await supabase
        .from("users")
        .update(updates)
        .eq("id", user.id)
        .select()
        .single()
      if (error) throw error
      toast({ title: "Αποθηκεύτηκε", description: "Τα στοιχεία λογαριασμού ενημερώθηκαν." })
    } catch (err) {
      console.error("Save account settings error:", err)
      const message = err instanceof Error ? err.message : "Αποτυχία αποθήκευσης"
      toast({ title: "Σφάλμα", description: message, variant: "destructive" })
    } finally {
      setSavingAccount(false)
    }
  }

  async function handleChangePassword() {
    if (!supabaseUser) return
    try {
      if (!passwordForm.next || passwordForm.next.length < 8) {
        toast({ title: "Σφάλμα", description: "Ο νέος κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.", variant: "destructive" })
        return
      }
      if (passwordForm.next !== passwordForm.confirm) {
        toast({ title: "Σφάλμα", description: "Οι κωδικοί δεν ταιριάζουν.", variant: "destructive" })
        return
      }
      setChangingPassword(true)
      const { error } = await supabase.auth.updateUser({ password: passwordForm.next })
      if (error) throw error
      setPasswordForm({ current: "", next: "", confirm: "" })
      toast({ title: "Ο κωδικός ενημερώθηκε", description: "Ο κωδικός πρόσβασης άλλαξε με επιτυχία." })
    } catch (err) {
      console.error("Change password error:", err)
      const message = err instanceof Error ? err.message : "Αποτυχία αλλαγής κωδικού"
      toast({ title: "Σφάλμα", description: message, variant: "destructive" })
    } finally {
      setChangingPassword(false)
    }
  }

  async function handleResetDemo() {
    if (!businessId) return
    try {
      setResettingDemo(true)
      await resetDemoBusiness(businessId)
      toast({
        title: "Επαναφορά Demo ολοκληρώθηκε",
        description: "Όλοι οι πελάτες, ραντεβού και υπηρεσίες διαγράφηκαν. Η επιχείρηση είναι έτοιμη για νέα χρήση.",
      })
      window.location.reload()
    } catch (err) {
      console.error("Reset demo error:", err)
      const message = err instanceof Error ? err.message : "Αποτυχία επαναφοράς"
      toast({ title: "Σφάλμα", description: message, variant: "destructive" })
    } finally {
      setResettingDemo(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ρυθμίσεις</h1>
        <p className="text-muted-foreground">Επιχείρηση, λογαριασμός και εμφάνιση</p>
      </div>

      {loadingBusiness ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Επιχείρηση</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="business-name">Όνομα επιχείρησης</Label>
                  <Input
                    id="business-name"
                    value={businessForm.name}
                    onChange={(e) => setBusinessForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="business-type">Τύπος επιχείρησης</Label>
                  <Input
                    id="business-type"
                    value={businessForm.business_type}
                    onChange={(e) => setBusinessForm((f) => ({ ...f, business_type: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="business-phone">Τηλέφωνο</Label>
                  <Input
                    id="business-phone"
                    value={businessForm.phone}
                    onChange={(e) => setBusinessForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="business-email">Email</Label>
                  <Input
                    id="business-email"
                    type="email"
                    value={businessForm.email}
                    onChange={(e) => setBusinessForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="business-address">Διεύθυνση</Label>
                  <Input
                    id="business-address"
                    value={businessForm.address}
                    onChange={(e) => setBusinessForm((f) => ({ ...f, address: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button type="button" onClick={handleSaveBusiness} disabled={savingBusiness}>
                  {savingBusiness ? "Αποθήκευση..." : "Αποθήκευση"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Support moved to /support */}

          <Card>
            <CardHeader>
              <CardTitle>Λογαριασμός</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="account-name">Ονοματεπώνυμο</Label>
                  <Input
                    id="account-name"
                    value={accountForm.full_name}
                    onChange={(e) => setAccountForm((f) => ({ ...f, full_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="account-email">Email</Label>
                  <Input
                    id="account-email"
                    type="email"
                    value={accountForm.email}
                    onChange={(e) => setAccountForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button type="button" onClick={handleSaveAccount} disabled={savingAccount}>
                  {savingAccount ? "Αποθήκευση..." : "Αποθήκευση"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Κωδικός πρόσβασης</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="password-next">Νέος κωδικός</Label>
                  <Input
                    id="password-next"
                    type="password"
                    value={passwordForm.next}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, next: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="password-confirm">Επιβεβαίωση νέου κωδικού</Label>
                  <Input
                    id="password-confirm"
                    type="password"
                    value={passwordForm.confirm}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, confirm: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button type="button" onClick={handleChangePassword} disabled={changingPassword}>
                  {changingPassword ? "Αλλαγή..." : "Αλλαγή κωδικού"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Εμφάνιση</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Θέμα</Label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as "light" | "dark" | "system")}
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="light">Φωτεινό</option>
                  <option value="dark">Σκούρο</option>
                  <option value="system">Σύστημα</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {canResetDemo && (
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardHeader>
                <CardTitle>Επαναφορά Demo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Διαγραφή όλων των πελατών, ραντεβού και υπηρεσιών αυτής της Demo επιχείρησης, ώστε να είναι έτοιμη για επόμενο χρήστη. Μετά την επαναφορά μπορείτε να αλλάξετε κωδικό και να δώσετε πρόσβαση σε άλλον.
                </p>
                <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" disabled={resettingDemo}>
                      {resettingDemo ? "Επαναφορά..." : "Επαναφορά Demo"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent showClose={!resettingDemo}>
                    <DialogHeader>
                      <DialogTitle>Επαναφορά Demo;</DialogTitle>
                      <DialogDescription>
                        Θα διαγραφούν οριστικά όλοι οι πελάτες, τα ραντεβού και οι υπηρεσίες. Αυτή η ενέργεια δεν αναιρείται.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setResetDialogOpen(false)} disabled={resettingDemo}>
                        Ακύρωση
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleResetDemo}
                        disabled={resettingDemo}
                      >
                        {resettingDemo ? "Επαναφορά..." : "Επαναφορά"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
