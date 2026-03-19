import { useAuth } from "@/contexts/AuthContext"

/**
 * Subscription lock is disabled; keep component as pass-through.
 */
export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { user, tenantSubscriptionLoaded } = useAuth()

  if (user?.role === "super_admin") return <>{children}</>
  if (!user?.business_id) return <>{children}</>

  if (!tenantSubscriptionLoaded) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return <>{children}</>
}
