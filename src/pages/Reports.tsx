import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { fetchDashboardStats, fetchReportsSummary } from "@/services/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCurrency, formatDate } from "@/lib/utils"
import { BarChart2, TrendingUp, ListChecks, Sparkles, ReceiptText } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

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

  function statusBadgeVariant(key: string): string {
    switch (key) {
      case "pending":
        return "pending"
      case "confirmed":
        return "confirmed"
      case "in_progress":
        return "inProgress"
      case "completed":
        return "completed"
      case "cancelled":
        return "cancelled"
      case "rescheduled":
        return "rescheduled"
      default:
        return "outline"
    }
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <div className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-r from-primary/25 via-purple-500/10 to-transparent blur-2xl" />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/40 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <Sparkles className="h-4 w-4 text-primary" />
              Reports • Premium
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Αναφορές</h1>
            <p className="text-muted-foreground">Έσοδα, ραντεβού και πληρωμές</p>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end">
              <div className="space-y-1">
                <Label className="text-xs">Από</Label>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-9 bg-background/40 border-border/50 focus-visible:ring-primary/30"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Έως</Label>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-9 bg-background/40 border-border/50 focus-visible:ring-primary/30"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ReceiptText className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {from && to ? `(${formatDate(from)} → ${formatDate(to)})` : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/60 bg-card/60 backdrop-blur-xl shadow-sm hover:shadow-md transition-shadow">
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

        <Card className="border-border/60 bg-card/60 backdrop-blur-xl shadow-sm hover:shadow-md transition-shadow">
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

        <Card className="border-border/60 bg-card/60 backdrop-blur-xl shadow-sm hover:shadow-md transition-shadow">
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
        <Card className="md:col-span-2 border-border/60 bg-card/60 backdrop-blur-xl shadow-sm">
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {statusChips.map((chip) => (
                  <div key={chip.key} className="rounded-xl border border-border/60 bg-background/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant={statusBadgeVariant(chip.key) as any}
                        className="px-2 py-1 whitespace-nowrap"
                      >
                        <span className="text-[11px]">{chip.label}</span>
                      </Badge>
                      <span className="text-sm font-semibold tabular-nums">{chip.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Κορυφαίοι πελάτες</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : !summary || summary.topCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Δεν υπάρχουν ακόμα έσοδα ανά πελάτη.</p>
            ) : (
              <div className="space-y-2">
                {summary.topCustomers.map((c, idx) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/25 p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <span className="text-xs font-semibold">{idx + 1}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">Έσοδα</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold tabular-nums">{formatCurrency(c.value)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/60 bg-card/60 backdrop-blur-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Έσοδα ανά υπηρεσία</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !summary || summary.revenueByService.length === 0 ? (
              <p className="text-sm text-muted-foreground">Δεν υπάρχουν έσοδα ανά υπηρεσία για το εύρος ημερομηνιών.</p>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const max = Math.max(...summary.revenueByService.map((r) => r.value), 0)
                  return summary.revenueByService.map((row) => {
                    const pct = max > 0 ? Math.round((row.value / max) * 100) : 0
                    return (
                      <div key={row.name} className="rounded-xl border border-border/60 bg-background/25 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate pr-2">{row.name}</span>
                          <span className="font-semibold tabular-nums">{formatCurrency(row.value)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                          <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[11px] text-muted-foreground">{pct}% του μέγιστου</p>
                      </div>
                    )
                  })
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Έσοδα ανά υπεύθυνο</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !summary || summary.revenueByUser.length === 0 ? (
              <p className="text-sm text-muted-foreground">Δεν υπάρχουν έσοδα ανά υπεύθυνο για το εύρος ημερομηνιών.</p>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const max = Math.max(...summary.revenueByUser.map((r) => r.value), 0)
                  return summary.revenueByUser.map((row) => {
                    const pct = max > 0 ? Math.round((row.value / max) * 100) : 0
                    return (
                      <div key={row.name} className="rounded-xl border border-border/60 bg-background/25 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate pr-2">{row.name}</span>
                          <span className="font-semibold tabular-nums">{formatCurrency(row.value)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500/60" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[11px] text-muted-foreground">{pct}% του μέγιστου</p>
                      </div>
                    )
                  })
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/60 backdrop-blur-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Πρόσφατες πληρωμές</CardTitle>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !summary || summary.recentPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Δεν υπάρχουν πρόσφατες πληρωμές στο επιλεγμένο εύρος.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-background/30">
                  <TableHead>Ραντεβού</TableHead>
                  <TableHead>Πελάτης</TableHead>
                  <TableHead>Ημ/νία</TableHead>
                  <TableHead className="text-right">Πληρωμένο</TableHead>
                  <TableHead className="text-right">Υπόλοιπο</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.recentPayments.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.appointment_job?.title ?? "Πληρωμή"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.appointment_job?.customer
                        ? `${p.appointment_job.customer.first_name} ${p.appointment_job.customer.last_name}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(p.created_at)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(Number(p.paid_amount ?? 0))}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(Number(p.remaining_balance ?? 0))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
