import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "@/contexts/AuthContext"
import { WorkspaceProvider } from "@/contexts/WorkspaceContext"
import { ThemeProvider } from "@/components/theme-provider"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { SubscriptionGate } from "@/components/SubscriptionGate"
import { AppLayout } from "@/components/layout/AppLayout"
import { PublicLegalShell } from "@/components/layout/PublicLegalShell"
import { Toaster } from "@/components/ui/sonner"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { useAuth } from "@/contexts/AuthContext"

import Login from "@/pages/Login"
import ResetPassword from "@/pages/ResetPassword"
import Subscribe from "@/pages/Subscribe"
import Dashboard from "@/pages/Dashboard"
import Customers from "@/pages/Customers"
import Services from "@/pages/Services"
import Appointments from "@/pages/Appointments"
import Calendar from "@/pages/Calendar"
import Team from "@/pages/Team"
import Payments from "@/pages/Payments"
import Reports from "@/pages/Reports"
import Settings from "@/pages/Settings"
import Details from "@/pages/Details"
import Support from "@/pages/Support"
import ServiceReminders from "@/pages/ServiceReminders"
import FAQ from "@/pages/FAQ"
import Terms from "@/pages/Terms"
import PrivacyPolicy from "@/pages/PrivacyPolicy"
import PlatformOverview from "@/pages/platform/Overview"
import PlatformBusinesses from "@/pages/platform/Businesses"
import PlatformPlans from "@/pages/platform/Plans"
import PlatformUsers from "@/pages/platform/Users"
import PlatformTools from "@/pages/platform/Tools"
import PublicBooking from "@/pages/PublicBooking"
import PublicSite from "@/pages/PublicSite"
import RouteOrder from "@/pages/RouteOrder"

function TenantApp({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <SubscriptionGate>
        <AppLayout>{children}</AppLayout>
      </SubscriptionGate>
    </ProtectedRoute>
  )
}

function Home() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return null
  if (user.role === "super_admin") return <Navigate to="/platform/overview" replace />
  return <Dashboard />
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system" storageKey="appoint-saas-theme">
        <BrowserRouter>
          <AuthProvider>
            <WorkspaceProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/book/:slug" element={<PublicBooking />} />
                {/* Δημόσια παρουσίαση — ξεχωριστό URL, χωρίς panel (όπως /book/...) */}
                <Route path="/site" element={<PublicSite />} />
                <Route
                  path="/"
                  element={
                    <TenantApp>
                      <Home />
                    </TenantApp>
                  }
                />
                <Route
                  path="/subscribe"
                  element={
                    <ProtectedRoute>
                      <Subscribe />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/terms"
                  element={
                    <PublicLegalShell>
                      <Terms />
                    </PublicLegalShell>
                  }
                />
                <Route
                  path="/privacy"
                  element={
                    <PublicLegalShell>
                      <PrivacyPolicy />
                    </PublicLegalShell>
                  }
                />
                <Route path="/dashboard" element={<Navigate to="/" replace />} />
                <Route
                  path="/customers"
                  element={
                    <TenantApp>
                      <Customers />
                    </TenantApp>
                  }
                />
                <Route
                  path="/services"
                  element={
                    <TenantApp>
                      <Services />
                    </TenantApp>
                  }
                />
                <Route
                  path="/appointments"
                  element={
                    <TenantApp>
                      <Appointments />
                    </TenantApp>
                  }
                />
                <Route
                  path="/route-order"
                  element={
                    <TenantApp>
                      <RouteOrder />
                    </TenantApp>
                  }
                />
                <Route
                  path="/calendar"
                  element={
                    <TenantApp>
                      <Calendar />
                    </TenantApp>
                  }
                />
                <Route
                  path="/team"
                  element={
                    <TenantApp>
                      <Team />
                    </TenantApp>
                  }
                />
                <Route
                  path="/payments"
                  element={
                    <TenantApp>
                      <Payments />
                    </TenantApp>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <TenantApp>
                      <Reports />
                    </TenantApp>
                  }
                />
                <Route
                  path="/details"
                  element={
                    <TenantApp>
                      <Details />
                    </TenantApp>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <TenantApp>
                      <Settings />
                    </TenantApp>
                  }
                />
                <Route
                  path="/support"
                  element={
                    <TenantApp>
                      <Support />
                    </TenantApp>
                  }
                />
                <Route
                  path="/service-reminders"
                  element={
                    <TenantApp>
                      <ServiceReminders />
                    </TenantApp>
                  }
                />
                <Route
                  path="/faq"
                  element={
                    <TenantApp>
                      <FAQ />
                    </TenantApp>
                  }
                />
                <Route
                  path="/platform/overview"
                  element={
                    <ProtectedRoute requiredRole="super_admin">
                      <AppLayout>
                        <PlatformOverview />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/platform/businesses"
                  element={
                    <ProtectedRoute requiredRole="super_admin">
                      <AppLayout>
                        <PlatformBusinesses />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/platform/plans"
                  element={
                    <ProtectedRoute requiredRole="super_admin">
                      <AppLayout>
                        <PlatformPlans />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/platform/users"
                  element={
                    <ProtectedRoute requiredRole="super_admin">
                      <AppLayout>
                        <PlatformUsers />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/platform/tools"
                  element={
                    <ProtectedRoute requiredRole="super_admin">
                      <AppLayout>
                        <PlatformTools />
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <Toaster />
            </WorkspaceProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
