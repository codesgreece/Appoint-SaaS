import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useLanguage } from "@/contexts/LanguageContext"
import type { AppLanguage } from "@/contexts/LanguageContext"
import { fetchDashboardStats, fetchReportsSummary } from "@/services/api"
import { ManualPaymentButton } from "@/components/payments/ManualPaymentButton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BarChart2, TrendingUp, ListChecks, Sparkles, ReceiptText } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const reportsI18n = {
  el: {
    premiumBadge: "Αναφορές • Premium",
    pageTitle: "Αναφορές",
    pageSubtitle: "Έσοδα, ραντεβού και πληρωμές",
    fromLabel: "Από",
    toLabel: "Έως",
    revenueToday: "Έσοδα σήμερα",
    revenueTodayDesc: "Από πληρωμές που καταχωρήθηκαν σήμερα.",
    revenueMonth: "Έσοδα μήνα",
    revenueMonthDesc: "Σύνολο πληρωμών για τον τρέχοντα μήνα.",
    outstanding: "Υπόλοιπα",
    outstandingDesc: "Ανεξόφλητα υπόλοιπα από όλες τις πληρωμές.",
    appointmentStatus: "Κατάσταση ραντεβού",
    appointmentRange: (from: string, to: string) => `Από ${from} έως ${to}.`,
    noData: "Δεν υπάρχουν διαθέσιμα δεδομένα.",
    statusPending: "Εκκρεμή",
    statusConfirmed: "Επιβεβαιωμένα",
    statusInProgress: "Σε εξέλιξη",
    statusCompleted: "Ολοκληρωμένα",
    statusCancelled: "Ακυρωμένα",
    statusNoShow: "Δεν προσήλθαν",
    statusRescheduled: "Επαναπρογραμματισμένα",
    topCustomers: "Κορυφαίοι πελάτες",
    topCustomersEmpty: "Δεν υπάρχουν ακόμα έσοδα ανά πελάτη.",
    revenueWord: "Έσοδα",
    revenueByService: "Έσοδα ανά υπηρεσία",
    revenueByServiceEmpty: "Δεν υπάρχουν έσοδα ανά υπηρεσία για το εύρος ημερομηνιών.",
    revenueByStaff: "Έσοδα ανά υπεύθυνο",
    revenueByStaffEmpty: "Δεν υπάρχουν έσοδα ανά υπεύθυνο για το εύρος ημερομηνιών.",
    pctOfMax: (pct: number) => `${pct}% του μέγιστου`,
    recentPayments: "Πρόσφατες πληρωμές",
    recentPaymentsEmpty: "Δεν υπάρχουν πρόσφατες πληρωμές στο επιλεγμένο εύρος.",
    colAppointment: "Ραντεβού",
    colCustomer: "Πελάτης",
    colDate: "Ημ/νία",
    colPaid: "Πληρωμένο",
    colBalance: "Υπόλοιπο",
    mobilePaid: "Πληρωμένο",
    mobileBalance: "Υπόλοιπο",
    paymentFallback: "Πληρωμή",
  },
  en: {
    premiumBadge: "Reports • Premium",
    pageTitle: "Reports",
    pageSubtitle: "Revenue, appointments, and payments",
    fromLabel: "From",
    toLabel: "To",
    revenueToday: "Revenue today",
    revenueTodayDesc: "From payments recorded today.",
    revenueMonth: "Monthly revenue",
    revenueMonthDesc: "Total payments for the current month.",
    outstanding: "Outstanding",
    outstandingDesc: "Unpaid balances across all payments.",
    appointmentStatus: "Appointment status",
    appointmentRange: (from: string, to: string) => `From ${from} to ${to}.`,
    noData: "No data available.",
    statusPending: "Pending",
    statusConfirmed: "Confirmed",
    statusInProgress: "In progress",
    statusCompleted: "Completed",
    statusCancelled: "Cancelled",
    statusNoShow: "No-show",
    statusRescheduled: "Rescheduled",
    topCustomers: "Top customers",
    topCustomersEmpty: "No per-customer revenue yet.",
    revenueWord: "Revenue",
    revenueByService: "Revenue by service",
    revenueByServiceEmpty: "No revenue by service for this date range.",
    revenueByStaff: "Revenue by staff",
    revenueByStaffEmpty: "No revenue by staff for this date range.",
    pctOfMax: (pct: number) => `${pct}% of maximum`,
    recentPayments: "Recent payments",
    recentPaymentsEmpty: "No recent payments in the selected range.",
    colAppointment: "Appointment",
    colCustomer: "Customer",
    colDate: "Date",
    colPaid: "Paid",
    colBalance: "Balance",
    mobilePaid: "Paid",
    mobileBalance: "Balance",
    paymentFallback: "Payment",
  },
}

function formatReportDate(iso: string | Date, lang: AppLanguage) {
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "el-GR", { dateStyle: "short" }).format(
    typeof iso === "string" ? new Date(iso) : iso,
  )
}

function formatReportMoney(amount: number, lang: AppLanguage) {
  return new Intl.NumberFormat(lang === "en" ? "en-GB" : "el-GR", {
    style: "currency",
    currency: "EUR",
  }).format(amount)
}

export default function Reports() {
  const { businessId } = useAuth()
  const { language } = useLanguage()
  const t = reportsI18n[language]
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
      { key: "pending", label: t.statusPending, value: summary?.statusCounts.pending ?? 0 },
      { key: "confirmed", label: t.statusConfirmed, value: summary?.statusCounts.confirmed ?? 0 },
      { key: "in_progress", label: t.statusInProgress, value: summary?.statusCounts.in_progress ?? 0 },
      { key: "completed", label: t.statusCompleted, value: summary?.statusCounts.completed ?? 0 },
      { key: "cancelled", label: t.statusCancelled, value: summary?.statusCounts.cancelled ?? 0 },
      { key: "no_show", label: t.statusNoShow, value: summary?.statusCounts.no_show ?? 0 },
      { key: "rescheduled", label: t.statusRescheduled, value: summary?.statusCounts.rescheduled ?? 0 },
    ],
    [summary?.statusCounts, language],
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

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/40 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <Sparkles className="h-4 w-4 text-primary" />
              {t.premiumBadge}
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{t.pageTitle}</h1>
            <p className="text-muted-foreground">{t.pageSubtitle}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end w-full lg:w-auto shrink-0">
            <ManualPaymentButton
              businessId={businessId}
              fullWidthMobile={false}
              onSuccess={async () => {
                if (!businessId || !from || !to) return
                const [dash, sum] = await Promise.all([
                  fetchDashboardStats(businessId),
                  fetchReportsSummary(businessId, { from, to }),
                ])
                setDashboard(dash)
                setSummary(sum)
              }}
            />
            <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end">
              <div className="space-y-1">
                <Label className="text-xs">{t.fromLabel}</Label>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-9 bg-background/40 border-border/50 focus-visible:ring-primary/30"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.toLabel}</Label>
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
                  {from && to ? `(${formatReportDate(from, language)} → ${formatReportDate(to, language)})` : "—"}
                </span>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <Card className="border-border/60 bg-card/60 backdrop-blur-xl shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.revenueToday}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading || !dashboard ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatReportMoney(dashboard.revenueToday, language)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">{t.revenueTodayDesc}</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-xl shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.revenueMonth}</CardTitle>
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading || !dashboard ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatReportMoney(dashboard.revenueMonth, language)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">{t.revenueMonthDesc}</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-xl shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.outstanding}</CardTitle>
            <ListChecks className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading || !dashboard ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatReportMoney(dashboard.outstandingBalances, language)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">{t.outstandingDesc}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2 border-border/60 bg-card/60 backdrop-blur-xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">{t.appointmentStatus}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {from && to ? t.appointmentRange(formatReportDate(from, language), formatReportDate(to, language)) : ""}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : !summary ? (
              <p className="text-sm text-muted-foreground">{t.noData}</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
            <CardTitle className="text-base">{t.topCustomers}</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : !summary || summary.topCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.topCustomersEmpty}</p>
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
                        <p className="text-xs text-muted-foreground">{t.revenueWord}</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold tabular-nums">{formatReportMoney(c.value, language)}</p>
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
            <CardTitle className="text-base">{t.revenueByService}</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !summary || summary.revenueByService.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.revenueByServiceEmpty}</p>
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
                          <span className="font-semibold tabular-nums">{formatReportMoney(row.value, language)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                          <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[11px] text-muted-foreground">{t.pctOfMax(pct)}</p>
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
            <CardTitle className="text-base">{t.revenueByStaff}</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !summary || summary.revenueByUser.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.revenueByStaffEmpty}</p>
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
                          <span className="font-semibold tabular-nums">{formatReportMoney(row.value, language)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500/60" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[11px] text-muted-foreground">{t.pctOfMax(pct)}</p>
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
          <CardTitle className="text-base">{t.recentPayments}</CardTitle>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !summary || summary.recentPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.recentPaymentsEmpty}</p>
          ) : (
            <>
            <div className="space-y-2 md:hidden">
              {summary.recentPayments.map((p: any) => (
                <div key={`mobile-${p.id}`} className="rounded-lg border border-border/60 bg-background/30 p-3">
                  <p className="text-sm font-medium">{p.appointment_job?.title ?? t.paymentFallback}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.appointment_job?.customer
                      ? `${p.appointment_job.customer.first_name} ${p.appointment_job.customer.last_name}`
                      : "—"}{" "}
                    • {formatReportDate(p.created_at, language)}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span>
                      {t.mobilePaid}: {formatReportMoney(Number(p.paid_amount ?? 0), language)}
                    </span>
                    <span>
                      {t.mobileBalance}: {formatReportMoney(Number(p.remaining_balance ?? 0), language)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-background/30">
                  <TableHead>{t.colAppointment}</TableHead>
                  <TableHead>{t.colCustomer}</TableHead>
                  <TableHead>{t.colDate}</TableHead>
                  <TableHead className="text-right">{t.colPaid}</TableHead>
                  <TableHead className="text-right">{t.colBalance}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.recentPayments.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.appointment_job?.title ?? t.paymentFallback}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.appointment_job?.customer
                        ? `${p.appointment_job.customer.first_name} ${p.appointment_job.customer.last_name}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatReportDate(p.created_at, language)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatReportMoney(Number(p.paid_amount ?? 0), language)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatReportMoney(Number(p.remaining_balance ?? 0), language)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
