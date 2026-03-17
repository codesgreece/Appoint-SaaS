import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { fetchDashboardStats, fetchReportsSummary } from "@/services/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCurrency, formatDate } from "@/lib/utils"
import { BarChart2, TrendingUp, Users, ListChecks } from "lucide-react"

export default function Reports() {
  const { businessId } = useAuth()
  const [from, setFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [dashboard, setDashboard] = useState<Awaited<ReturnType<typeof fetchDashboardStats>> | null>(null)
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof fetchReportsSummary>> | null>(null)

  useEffect(() => {
    if (!businessId) return
    setLoading(true)
    fetchDashboardStats(businessId)
      .then(setDashboard)
      .finally(() => setLoading(false))
  }, [businessId])

  useEffect(() => {
    if (!businessId || !from || !to) return
    setSummaryLoading(true)
    fetchReportsSummary(businessId, { from, to })
      .then(setSummary)
      .finally(() => setSummaryLoading(false))
  }, [businessId, from, to])

  const statusChips = useMemo(
    () => [
      { key: "pending", label: "Εκκρεμή", value: summary?.statusCounts.pending ?? 0 },
      { key: "confirmed", label: "Επιβεβαιωμένα", value: summary?.statusCounts.confirmed ?? 0 },
      { key: "in_progress", label: "Σε εξέλιξη", value: summary?.statusCounts.in_progress ?? 0 },
      { key: "completed", label: "Ολοκληρωμένα", value: summary?.statusCounts.completed ?? 0 },
      { key: "cancelled", label: "Ακυρωμένα", value: summary?.statusCounts.cancelled ?? 0 },
      { key: "no_show", label: "Δεν εμφανίστηκαν", value: summary?.statusCounts.no_show ?? 0 },
      { key: "rescheduled", label: "Επαναπρογραμματισμένα", value: summary?.statusCounts.rescheduled ?? 0 },
    ],
    [summary?.statusCounts],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Αναφορές</h1>
          <p className="text-muted-foreground">Έσοδα, ραντεβού και πληρωμές</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <div className="space-y-1">
            <Label className="text-xs">Από</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Έως</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Έσοδα σήμερα</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading || !dashboard ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(dashboard.revenueToday)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Από πληρωμές που καταχωρήθηκαν σήμερα.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Έσοδα μήνα</CardTitle>
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading || !dashboard ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(dashboard.revenueMonth)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Σύνολο πληρωμών για τον τρέχοντα μήνα.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Υπόλοιπα</CardTitle>
            <ListChecks className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading || !dashboard ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(dashboard.outstandingBalances)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Ανεξόφλητα υπόλοιπα από όλες τις πληρωμές.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Κατάσταση ραντεβού</CardTitle>
              <p className="text-xs text-muted-foreground">
                Από {from && formatDate(from)} έως {to && formatDate(to)}.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : !summary ? (
              <p className="text-sm text-muted-foreground">Δεν υπάρχουν διαθέσιμα δεδομένα.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {statusChips.map((chip) => (
                  <Badge key={chip.key} variant="outline" className="flex items-center gap-2 px-3 py-1">
                    <span className="text-xs">{chip.label}</span>
                    <span className="text-sm font-semibold">{chip.value}</span>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Κορυφαίοι πελάτες</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : !summary || summary.topCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Δεν υπάρχουν ακόμα έσοδα ανά πελάτη.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {summary.topCustomers.map((c) => (
                  <li key={c.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{c.name}</span>
                    </div>
                    <span className="font-semibold">{formatCurrency(c.value)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Έσοδα ανά υπηρεσία</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !summary || summary.revenueByService.length === 0 ? (
              <p className="text-sm text-muted-foreground">Δεν υπάρχουν έσοδα ανά υπηρεσία για το εύρος ημερομηνιών.</p>
            ) : (
              <div className="space-y-2">
                {summary.revenueByService.map((row) => (
                  <div key={row.name} className="flex items-center justify-between text-sm">
                    <span className="truncate pr-2">{row.name}</span>
                    <span className="font-semibold">{formatCurrency(row.value)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Έσοδα ανά υπεύθυνο</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !summary || summary.revenueByUser.length === 0 ? (
              <p className="text-sm text-muted-foreground">Δεν υπάρχουν έσοδα ανά υπεύθυνο για το εύρος ημερομηνιών.</p>
            ) : (
              <div className="space-y-2">
                {summary.revenueByUser.map((row) => (
                  <div key={row.name} className="flex items-center justify-between text-sm">
                    <span className="truncate pr-2">{row.name}</span>
                    <span className="font-semibold">{formatCurrency(row.value)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Πρόσφατες πληρωμές</CardTitle>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !summary || summary.recentPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Δεν υπάρχουν πρόσφατες πληρωμές στο επιλεγμένο εύρος.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {summary.recentPayments.map((p: any) => (
                <div
                  key={p.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between border-b last:border-0 py-2 gap-1"
                >
                  <div>
                    <p className="font-medium">
                      {p.appointment_job?.title ?? "Πληρωμή"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.appointment_job?.customer
                        ? `${p.appointment_job.customer.first_name} ${p.appointment_job.customer.last_name}`
                        : "—"}{" "}
                      • {formatDate(p.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 sm:text-right">
                    <div>
                      <p className="text-xs text-muted-foreground">Πληρωμένο</p>
                      <p className="font-semibold">
                        {formatCurrency(Number(p.paid_amount ?? 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Υπόλοιπο</p>
                      <p className="font-semibold">
                        {formatCurrency(Number(p.remaining_balance ?? 0))}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
