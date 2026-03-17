import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type FixedPlanKey = "demo" | "starter" | "pro" | "premium" | "premium_plus"

const FIXED_PLANS: Record<FixedPlanKey, { label: string; max_users?: number; max_customers?: number; max_appointments?: number; note: string }> = {
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
          return (
            <Card key={key} className={isCustom ? "border-primary/50 bg-primary/5" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between gap-2">
                  <span>{cfg.label}</span>
                  {isCustom && (
                    <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                      Custom
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs md:text-sm">
                {key !== "premium_plus" ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Μέγιστοι χρήστες</span>
                      <span className="font-medium">{cfg.max_users}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Μέγιστοι πελάτες</span>
                      <span className="font-medium">{cfg.max_customers}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Μέγιστα ραντεβού</span>
                      <span className="font-medium">{cfg.max_appointments}</span>
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

