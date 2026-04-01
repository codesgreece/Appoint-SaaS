/** Visual tier for customer list based on no-show count vs completed visits. */
export type CustomerReliabilityTier = "neutral" | "good" | "warn1" | "warn2" | "bad"

/**
 * - 3+ no-shows → red
 * - 2 no-shows → orange
 * - 1 no-show → amber
 * - 0 no-shows and at least one completed → green
 * - otherwise → neutral (no history or only pending/cancelled/rescheduled)
 */
export function computeReliabilityTier(noShowCount: number, completedCount: number): CustomerReliabilityTier {
  if (noShowCount >= 3) return "bad"
  if (noShowCount === 2) return "warn2"
  if (noShowCount === 1) return "warn1"
  if (completedCount >= 1 && noShowCount === 0) return "good"
  return "neutral"
}

export function tierDotClass(tier: CustomerReliabilityTier): string {
  switch (tier) {
    case "good":
      return "bg-emerald-500 shadow-[0_0_0_2px_hsl(var(--background))]"
    case "warn1":
      return "bg-amber-400 shadow-[0_0_0_2px_hsl(var(--background))]"
    case "warn2":
      return "bg-orange-500 shadow-[0_0_0_2px_hsl(var(--background))]"
    case "bad":
      return "bg-red-600 shadow-[0_0_0_2px_hsl(var(--background))]"
    default:
      return "bg-muted-foreground/35 shadow-[0_0_0_2px_hsl(var(--background))]"
  }
}
