/** Πακέτα που αγοράζει ο πελάτης από τη σελίδα «Αγορά προγράμματος». */
export type PurchasablePlan = "starter" | "pro" | "premium"
export type PurchaseDurationMonths = 1 | 3 | 6 | 12

export const PURCHASABLE_PLANS: PurchasablePlan[] = ["starter", "pro", "premium"]

export const PLAN_DISPLAY: Record<PurchasablePlan, { title: string; description: string }> = {
  starter: { title: "Starter", description: "Ιδανικό για μικρές ομάδες" },
  pro: { title: "Pro", description: "Για αναπτυσσόμενες επιχειρήσεις" },
  premium: { title: "Premium", description: "Μέγιστη κλιμάκωση" },
}

/** Τιμές σε € ανά διάρκεια */
export const PLAN_PRICES: Record<PurchasablePlan, Record<PurchaseDurationMonths, number>> = {
  starter: { 1: 19, 3: 54, 6: 102, 12: 180 },
  pro: { 1: 39, 3: 110, 6: 210, 12: 390 },
  premium: { 1: 79, 3: 225, 6: 450, 12: 790 },
}

export const DURATION_LABELS: Record<PurchaseDurationMonths, string> = {
  1: "1 μήνας",
  3: "3 μήνες",
  6: "6 μήνες",
  12: "12 μήνες (ετήσιο)",
}
