import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: "super_admin" | "admin" | "employee" | "reception"
}

function NoBusinessAccess() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Δεν υπάρχει πρόσβαση</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ο λογαριασμός σας δεν είναι συνδεδεμένος με επιχείρηση. Επικοινωνήστε με τον διαχειριστή.
        </p>
      </div>
    </div>
  )
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, supabaseUser, loading, bootstrapError, retryBootstrap } = useAuth()
  const location = useLocation()

  if (loading) {
    console.log("[ProtectedRoute] loading", { path: location.pathname })
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!supabaseUser) {
    console.log("[ProtectedRoute] redirect login", { path: location.pathname })
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (bootstrapError) {
    console.log("[ProtectedRoute] bootstrap error", { path: location.pathname, bootstrapError })
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md rounded-lg border bg-card p-6 shadow-sm space-y-3">
          <h2 className="text-lg font-semibold">Αποτυχία αρχικοποίησης εφαρμογής</h2>
          <p className="text-sm text-muted-foreground">{bootstrapError}</p>
          <Button onClick={() => retryBootstrap()}>Δοκιμάστε ξανά</Button>
        </div>
      </div>
    )
  }

  // If we have an auth session but the profile is missing, show explicit error UI (never spin forever).
  if (!user) {
    console.log("[ProtectedRoute] invalid profile state", { path: location.pathname })
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md rounded-lg border bg-card p-6 shadow-sm space-y-3">
          <h2 className="text-lg font-semibold">Αποτυχία αρχικοποίησης εφαρμογής</h2>
          <p className="text-sm text-muted-foreground">
            Δεν βρέθηκε προφίλ χρήστη στο σύστημα. Επικοινωνήστε με τον διαχειριστή.
          </p>
          <Button onClick={() => retryBootstrap()}>Δοκιμάστε ξανά</Button>
        </div>
      </div>
    )
  }

  // Exact rule: super_admin is never blocked by business_id requirements.
  if (user.role === "super_admin") {
    if (requiredRole && user.role !== requiredRole) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center max-w-md rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Μη εξουσιοδοτημένη πρόσβαση</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Δεν έχετε δικαιώματα πρόσβασης σε αυτή τη σελίδα.
            </p>
          </div>
        </div>
      )
    }
    console.log("[ProtectedRoute] render children (super_admin)", { path: location.pathname })
    return <>{children}</>
  }

  // Only non-super-admin roles are blocked when business_id is missing.
  if (!user.business_id) {
    console.log("[ProtectedRoute] no business (non-super_admin)", { path: location.pathname })
    return <NoBusinessAccess />
  }

  if (requiredRole && user.role !== requiredRole) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Μη εξουσιοδοτημένη πρόσβαση</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Δεν έχετε δικαιώματα πρόσβασης σε αυτή τη σελίδα.
          </p>
        </div>
      </div>
    )
  }

  console.log("[ProtectedRoute] render children", { path: location.pathname })
  return <>{children}</>
}
