import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "@/contexts/AuthContext"
import { WorkspaceProvider } from "@/contexts/WorkspaceContext"
import { ThemeProvider } from "@/components/theme-provider"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { AppLayout } from "@/components/layout/AppLayout"
import { Toaster } from "@/components/ui/sonner"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { useAuth } from "@/contexts/AuthContext"

import Login from "@/pages/Login"
import ResetPassword from "@/pages/ResetPassword"
import Dashboard from "@/pages/Dashboard"
import Customers from "@/pages/Customers"
import Services from "@/pages/Services"
import Appointments from "@/pages/Appointments"
import Calendar from "@/pages/Calendar"
import Team from "@/pages/Team"
import Payments from "@/pages/Payments"
import Reports from "@/pages/Reports"
import Settings from "@/pages/Settings"
import Support from "@/pages/Support"
import FAQ from "@/pages/FAQ"
import Terms from "@/pages/Terms"
import PrivacyPolicy from "@/pages/PrivacyPolicy"
import PlatformOverview from "@/pages/platform/Overview"
import PlatformBusinesses from "@/pages/platform/Businesses"
import PlatformPlans from "@/pages/platform/Plans"
import PlatformUsers from "@/pages/platform/Users"
import PlatformTools from "@/pages/platform/Tools"

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
          <Route
            path="/terms"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Terms />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/privacy"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <PrivacyPolicy />
                </AppLayout>
              </ProtectedRoute>
            }
          />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Home />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Customers />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/services"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Services />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/appointments"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Appointments />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Calendar />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/team"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Team />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/payments"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Payments />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Reports />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Settings />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/support"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Support />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/faq"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <FAQ />
                  </AppLayout>
                </ProtectedRoute>
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
