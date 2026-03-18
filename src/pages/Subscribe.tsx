import { useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { Sparkles, Check, LogOut, Star } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { activateSubscriptionPurchase } from "@/services/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  PURCHASABLE_PLANS,
  PLAN_DISPLAY,
  PLAN_PRICES,
  DURATION_LABELS,
  STARTER_TEST_PACKAGE,
  type PurchasablePlan,
  type PurchaseDurationMonths,
} from "@/lib/subscription-catalog"

const DURATIONS: PurchaseDurationMonths[] = [1, 3, 6, 12]

export default function Subscribe() {
  const { user, businessId, businessName, tenantSubscriptionPlan, tenantSubscriptionLoaded, signOut, refreshTenantBusiness } =
    useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [plan, setPlan] = useState<PurchasablePlan>("pro")
  const [months, setMonths] = useState<PurchaseDurationMonths>(12)
  const [starterTestPack, setStarterTestPack] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (user?.role === "super_admin") {
    return <Navigate to="/platform/overview" replace />
  }

  if (!tenantSubscriptionLoaded || !businessId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (tenantSubscriptionPlan !== "unsubscribed") {
    return <Navigate to="/" replace />
  }

  async function handlePurchase() {
    if (!businessId) return
    try {
      setSubmitting(true)
      const duration_months =
        plan === "starter" && starterTestPack ? STARTER_TEST_PACKAGE.durationMonths : months
      await activateSubscriptionPurchase({
        business_id: businessId,
        plan,
        duration_months,
      })
      await refreshTenantBusiness()
      toast({
        title: "Συνδρομή ενεργή",
        description: "Όλες οι λειτουργίες ξεκλειδώθηκαν. Καλή συνέχεια!",
      })
      navigate("/", { replace: true })
    } catch (e) {
      toast({
        title: "Σφάλμα",
        description: e instanceof Error ? e.message : "Αποτυχία",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const price =
    plan === "starter" && starterTestPack ? STARTER_TEST_PACKAGE.priceEuro : PLAN_PRICES[plan][months]

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <div>
              <p className="text-sm font-semibold">{businessName ?? "Επιχείρηση"}</p>
              <p className="text-xs text-muted-foreground">Ενεργοποίηση συνδρομής</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Αποσύνδεση
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <div className="mx-auto max-w-2xl text-center mb-10">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Αγορά προγράμματος</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Επίλεξε πακέτο και διάρκεια. Με την ολοκλήρωση η συνδρομή ενεργοποιείται αμέσως και ξεκλειδώνει όλο το panel.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-10">
          {PURCHASABLE_PLANS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPlan(p)
                if (p !== "starter") setStarterTestPack(false)
              }}
              className={cn(
                "relative rounded-2xl border-2 p-5 text-left transition-all",
                plan === p
                  ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                  : "border-border/60 bg-card/60 hover:border-primary/40"
              )}
            >
              {p === "pro" && (
                <span className="absolute -top-2.5 right-3 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  <Star className="h-3 w-3 fill-current" />
                  Πιο δημοφιλές
                </span>
              )}
              <h3 className="text-lg font-bold">{PLAN_DISPLAY[p].title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{PLAN_DISPLAY[p].description}</p>
              <ul className="mt-4 space-y-1.5 text-xs">
                {p === "starter" && (
                  <>
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-500" />3 χρήστες
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      300 πελάτες · 1.000 ραντεβού
                    </li>
                  </>
                )}
                {p === "pro" && (
                  <>
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      10 χρήστες
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      2.000 πελάτες · 10.000 ραντεβού
                    </li>
                  </>
                )}
                {p === "premium" && (
                  <>
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      30 χρήστες
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      10.000 πελάτες · 50.000 ραντεβού
                    </li>
                  </>
                )}
              </ul>
            </button>
          ))}
        </div>

        {plan === "starter" && (
          <Card className="mx-auto max-w-3xl mb-6 border-primary/40 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{STARTER_TEST_PACKAGE.label}</CardTitle>
              <p className="text-xs text-muted-foreground font-normal">{STARTER_TEST_PACKAGE.subtitle}</p>
            </CardHeader>
            <CardContent>
              <button
                type="button"
                onClick={() => {
                  setStarterTestPack(true)
                  setMonths(1)
                }}
                className={cn(
                  "w-full rounded-xl border-2 p-4 text-left transition-all",
                  starterTestPack
                    ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                    : "border-border/60 bg-card hover:border-primary/40"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">0,10 €</span>
                  <span className="text-xs text-muted-foreground">Ίδιο πλάνο Starter · για έλεγχο πληρωμής</span>
                </div>
              </button>
            </CardContent>
          </Card>
        )}

        <Card className="mx-auto max-w-3xl border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">Διάρκεια συνδρομής</CardTitle>
            <p className="text-xs text-muted-foreground font-normal">
              Στο ετήσιο πακέτο (12 μήνες): <strong>2 μήνες δώρο</strong> (14 μήνες συνολικά) ·{" "}
              <strong>Εξοικονόμησε έως 20%</strong> σε σχέση με μηνιαία χρέωση.
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {DURATIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMonths(m)
                  setStarterTestPack(false)
                }}
                className={cn(
                  "relative rounded-xl border p-4 text-center transition-all",
                  months === m ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "border-border/60 hover:bg-muted/50"
                )}
              >
                {m === 12 && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-400">
                    2 μήνες δώρο
                  </span>
                )}
                <div className="text-xs font-medium text-muted-foreground mt-1">{DURATION_LABELS[m]}</div>
                <div className="mt-2 text-xl font-bold">{PLAN_PRICES[plan][m]}€</div>
                {m === 12 && <div className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400">Έως 20% εξοικονόμηση</div>}
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="mx-auto max-w-md mt-10 text-center space-y-4">
          <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Επιλογή: </span>
            <strong>{PLAN_DISPLAY[plan].title}</strong>
            <span className="text-muted-foreground"> · </span>
            <strong>{starterTestPack && plan === "starter" ? DURATION_LABELS[1] : DURATION_LABELS[months]}</strong>
            <span className="text-muted-foreground"> · </span>
            <strong className="text-primary text-lg">
              {price < 1 ? price.toFixed(2).replace(".", ",") : price}€
            </strong>
            {months === 12 && !starterTestPack && (
              <p className="text-xs text-muted-foreground mt-1">Ισχύς 14 μήνες (συμπεριλαμβάνονται 2 δώρο)</p>
            )}
          </div>
          <Button size="lg" className="w-full sm:w-auto min-w-[240px]" onClick={handlePurchase} disabled={submitting}>
            {submitting ? "Ενεργοποίηση..." : "Ολοκλήρωση αγοράς & ενεργοποίηση"}
          </Button>
          <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
            Μετά την ενεργοποίηση μπορείτε να χρησιμοποιήσετε πλήρως το panel. Για πραγματική πληρωμή με κάρτα θα συνδεθεί εξωτερική πύλη πληρωμών.
          </p>
        </div>
      </main>
    </div>
  )
}
