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
  starter: { 1: 19.9, 3: 53.9, 6: 101.9, 12: 179.9 },
  pro: { 1: 28.9, 3: 78.9, 6: 148.9, 12: 289.9 },
  premium: { 1: 58.9, 3: 157.9, 6: 298.9, 12: 589.9 },
}

export const DURATION_LABELS: Record<PurchaseDurationMonths, string> = {
  1: "1 μήνας",
  3: "3 μήνες",
  6: "6 μήνες",
  12: "12 μήνες (ετήσιο)",
}
