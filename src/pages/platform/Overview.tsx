import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { formatDate } from "@/lib/utils"

interface PlatformOverviewStats {
  totalBusinesses: number
  activeBusinesses: number
  totalUsers: number
  totalAppointments: number
  totalPayments: number
  recentBusinesses: { id: string; name: string; created_at: string; subscription_status: string | null }[]
}

export default function PlatformOverview() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<PlatformOverviewStats | null>(null)

  useEffect(() => {
    if (!user || user.role !== "super_admin") return
    async function load() {
      try {
        setLoading(true)
        const [
          { count: businessesCount },
          { data: businessesRows },
          { count: usersCount },
          { count: appointmentsCount },
          { count: paymentsCount },
        ] = await Promise.all([
          supabase.from("businesses").select("id", { count: "exact", head: true }),
          supabase
            .from("businesses")
            .select("id, name, created_at, subscription_status")
            .order("created_at", { ascending: false })
            .limit(5),
          supabase.from("users").select("id", { count: "exact", head: true }),
          supabase.from("appointments_jobs").select("id", { count: "exact", head: true }),
          supabase.from("payments").select("id", { count: "exact", head: true }),
        ])

        const activeBusinesses =
          (businessesRows as { subscription_status: string | null }[] | null)?.filter(
            (b) => b.subscription_status === "active" || b.subscription_status === "trialing",
          ).length ?? 0

        setStats({
          totalBusinesses: businessesCount ?? 0,
          activeBusinesses,
          totalUsers: usersCount ?? 0,
          totalAppointments: appointmentsCount ?? 0,
          totalPayments: paymentsCount ?? 0,
          recentBusinesses:
            (businessesRows as { id: string; name: string; created_at: string; subscription_status: string | null }[] | null) ??
            [],
        })
      } catch (err) {
        console.error("Platform overview load error:", err)
        setStats(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Πλατφόρμα</h1>
        <p className="text-muted-foreground">Επισκόπηση SaaS πλατφόρμας</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Σύνολο επιχειρήσεων</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !stats ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold">{stats.totalBusinesses}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Ενεργές επιχειρήσεις</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !stats ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold">{stats.activeBusinesses}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Χρήστες πλατφόρμας</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !stats ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold">{stats.totalUsers}</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Σύνολο ραντεβού / εργασιών</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !stats ? <Skeleton className="h-8 w-20" /> : <p className="text-2xl font-bold">{stats.totalAppointments}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Σύνολο πληρωμών</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !stats ? <Skeleton className="h-8 w-20" /> : <p className="text-2xl font-bold">{stats.totalPayments}</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Πρόσφατες επιχειρήσεις</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : !stats || stats.recentBusinesses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Δεν υπάρχουν επιχειρήσεις ακόμα.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {stats.recentBusinesses.map((b) => (
                <div key={b.id} className="flex items-center justify-between border-b last:border-0 py-2">
                  <div>
                    <p className="font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Δημιουργία: {formatDate(b.created_at)}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {b.subscription_status ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

