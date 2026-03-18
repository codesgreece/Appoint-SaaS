import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"

/**
 * Κλειδώνει το panel όταν το πλάνο είναι unsubscribed· επιτρέπει μόνο /settings (κωδικός κ.λπ.).
 */
export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { user, tenantSubscriptionPlan, tenantSubscriptionLoaded } = useAuth()
  const { pathname } = useLocation()

  if (user?.role === "super_admin") return <>{children}</>
  if (!user?.business_id) return <>{children}</>

  if (!tenantSubscriptionLoaded) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const locked = tenantSubscriptionPlan === "unsubscribed"
  const allowedWhenLocked = ["/settings"]

  if (locked && !allowedWhenLocked.includes(pathname)) {
    return <Navigate to="/subscribe" replace />
  }

  return <>{children}</>
}
