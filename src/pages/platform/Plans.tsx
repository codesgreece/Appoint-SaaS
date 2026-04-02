import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type FixedPlanKey = "unsubscribed" | "demo" | "starter" | "pro" | "premium" | "lifetime" | "premium_plus"

const FIXED_PLANS: Record<
  FixedPlanKey,
  { label: string; max_users?: number | null; max_customers?: number | null; max_appointments?: number | null; note: string }
> = {
  unsubscribed: {
    label: "Χωρίς συνδρομή",
    max_users: 1,
    max_customers: 0,
    max_appointments: 0,
    note: "Νέα επιχείρηση· ο πελάτης ενεργοποιεί Starter, Pro ή Premium από το panel.",
  },
  demo: {
    label: "Demo",
    max_users: 1,
    max_customers: 20,
    max_appointments: 50,
    note: "Πλάνο δοκιμής για να γνωρίσεις την πλατφόρμα πριν την αγορά.",
  },
  starter: {
    label: "Starter",
    max_users: 3,
    max_customers: 300,
    max_appointments: 1000,
    note: "Ιδανικό για μικρές ομάδες που ξεκινούν τώρα.",
  },
  pro: {
    label: "Pro",
    max_users: 10,
    max_customers: 2000,
    max_appointments: 10000,
    note: "Για αναπτυσσόμενες επιχειρήσεις με σταθερό ρυθμό.",
  },
  premium: {
    label: "Premium",
    max_users: 30,
    max_customers: 10000,
    max_appointments: 50000,
    note: "Για ώριμες επιχειρήσεις με μεγάλο όγκο πελατών.",
  },
  lifetime: {
    label: "Εφάπαξ",
    max_users: null,
    max_customers: null,
    max_appointments: null,
    note: "Μία πληρωμή· χωρίς ημερομηνία λήξης· απεριόριστοι χρήστες, πελάτες και ραντεβού (όρια null στη βάση).",
  },
  premium_plus: {
    label: "Premium+ (custom)",
    note: "Custom όρια ανά επιχείρηση. Ορίζονται μόνο κατά τη δημιουργία της εκάστοτε επιχείρησης από super admin.",
  },
}

export default function PlatformPlans() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl md:text-[26px] font-semibold tracking-tight">Πλάνα & Όρια</h1>
        <p className="text-sm text-muted-foreground">
          Τα παρακάτω πλάνα είναι σταθερά. Μόνο το Premium+ επιτρέπει custom όρια ανά επιχείρηση.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {(Object.keys(FIXED_PLANS) as FixedPlanKey[]).map((key) => {
          const cfg = FIXED_PLANS[key]
          const isCustom = key === "premium_plus"
          const isUnlimited = key === "lifetime"
          return (
            <Card key={key} className={isCustom ? "border-primary/50 bg-primary/5" : isUnlimited ? "border-violet-300/50 bg-violet-500/5" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between gap-2">
                  <span>{cfg.label}</span>
                  {isCustom && (
                    <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                      Custom
                    </span>
                  )}
                  {isUnlimited && (
                    <span className="rounded-full border border-violet-400/40 bg-violet-500/10 px-2 py-0.5 text-[11px] text-violet-700 dark:text-violet-300">
                      Εφάπαξ
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs md:text-sm">
                {key !== "premium_plus" ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Μέγιστοι χρήστες</span>
                      <span className="font-medium">{isUnlimited ? "Απεριόριστοι" : cfg.max_users}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Μέγιστοι πελάτες</span>
                      <span className="font-medium">{isUnlimited ? "Απεριόριστοι" : cfg.max_customers}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Μέγιστα ραντεβού</span>
                      <span className="font-medium">{isUnlimited ? "Απεριόριστα" : cfg.max_appointments}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground leading-snug">
                    Τα όρια (χρήστες, πελάτες, ραντεβού) ορίζονται εξατομικευμένα σε κάθε νέα επιχείρηση από super
                    admin και δεν τροποποιούνται από το panel πλάνων.
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground pt-1">{cfg.note}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

