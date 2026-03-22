/** Πακέτα που αγοράζει ο πελάτης από τη σελίδα «Αγορά προγράμματος». */
export type PurchasablePlan = "starter" | "pro" | "premium"
export type PurchaseDurationMonths = 1 | 3 | 6 | 12

export const PURCHASABLE_PLANS: PurchasablePlan[] = ["starter", "pro", "premium"]

export const PLAN_DISPLAY: Record<PurchasablePlan, { title: string; description: string }> = {
  starter: { title: "Starter", description: "Ιδανικό για μικρές ομάδες" },
  pro: { title: "Pro", description: "Για αναπτυσσόμενες επιχειρήσεις" },
  premium: { title: "Premium", description: "Μέγιστη κλιμάκωση" },
}

/** Τιμές σε € (συνολικό ποσό για την περίοδο) — συγχρονισμένο με δημόσια τιμολόγηση */
export const PLAN_PRICES: Record<PurchasablePlan, Record<PurchaseDurationMonths, number>> = {
  starter: { 1: 9.9, 3: 26.9, 6: 48.9, 12: 88.9 },
  pro: { 1: 14.9, 3: 38.9, 6: 74.9, 12: 138.9 },
  premium: { 1: 19.9, 3: 54.9, 6: 104.9, 12: 199.9 },
}

export const DURATION_LABELS: Record<PurchaseDurationMonths, string> = {
  1: "1 μήνας",
  3: "3 μήνες",
  6: "6 μήνες",
  12: "12 μήνες (ετήσιο)",
}
