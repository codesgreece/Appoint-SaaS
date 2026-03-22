/**
 * Υπολογισμοί χρημάτων ραντεβού όταν τα ποσά είναι στο `payments` και όχι μόνο σε `final_cost`.
 */

export type PaymentEmbed = {
  paid_amount?: number | null
  amount?: number | null
  remaining_balance?: number | null
  payment_status?: string | null
}

export type AppointmentMoneyShape = {
  final_cost?: number | null
  cost_estimate?: number | null
  payments?: PaymentEmbed[] | PaymentEmbed | null
}

function paymentsList(a: AppointmentMoneyShape): PaymentEmbed[] {
  const p = a.payments
  if (p == null) return []
  return Array.isArray(p) ? p : [p]
}

/** Σύνολο καταχωρημένων πληρωμών (paid_amount) για το ραντεβού */
export function sumPaidAmountForAppointment(a: AppointmentMoneyShape): number {
  return paymentsList(a).reduce((s, x) => s + Number(x.paid_amount ?? 0), 0)
}

/** Σύνολο υπολοίπων από γραμμές πληρωμών */
export function sumRemainingForAppointment(a: AppointmentMoneyShape): number {
  return paymentsList(a).reduce((s, x) => s + Number(x.remaining_balance ?? 0), 0)
}

/**
 * Αξία για σύνολα/μέσο όρο: προτεραιότητα σε πραγματικές πληρωμές, μετά τελικό κόστος, μετά εκτίμηση.
 */
export function getAppointmentValueForTotals(a: AppointmentMoneyShape): number {
  const paid = sumPaidAmountForAppointment(a)
  if (paid > 0) return paid
  if (a.final_cost != null) return Number(a.final_cost)
  if (a.cost_estimate != null) return Number(a.cost_estimate)
  return 0
}
