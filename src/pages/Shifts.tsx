import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useLanguage } from "@/contexts/LanguageContext"
import { useToast } from "@/hooks/use-toast"
import { fetchShiftsForRange, fetchTeam, upsertShift } from "@/services/api"
import type { Shift, User } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

function toIsoLocal(d: Date) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function mondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function firstOfMonth(d: Date): Date {
  const x = new Date(d)
  x.setDate(1)
  x.setHours(0, 0, 0, 0)
  return x
}

function datesInMonth(year: number, month: number): Date[] {
  const last = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: last }, (_, i) => {
    const x = new Date(year, month, i + 1)
    x.setHours(0, 0, 0, 0)
    return x
  })
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase() || "?"
}

const copy = {
  el: {
    title: "Διαχείριση βαρδιών",
    subtitleWeek: "Εβδομαδιαίο ωράριο ανά μέλος — τα ραντεβού σέβονται τις ώρες βάρδιας.",
    subtitleMonth: "Πλήρες μηνιαίο πρόγραμμα ανά μέλος.",
    prev: "Προηγούμενη",
    next: "Επόμενη",
    today: "Σήμερα",
    thisMonth: "Τρέχων μήνας",
    weekLabel: "Εβδομάδα",
    monthLabel: "Μήνας",
    periodWeek: "Εβδομάδα",
    periodMonth: "Μήνας",
    loading: "Φόρτωση…",
    off: "Ρεπό",
    saveError: "Δεν αποθηκεύτηκε η βάρδια.",
    loadError: "Αποτυχία φόρτωσης βαρδιών.",
  },
  en: {
    title: "Shift management",
    subtitleWeek: "Weekly schedule per team member — appointments respect shift hours.",
    subtitleMonth: "Full monthly schedule per team member.",
    prev: "Previous",
    next: "Next",
    today: "Today",
    thisMonth: "This month",
    weekLabel: "Week",
    monthLabel: "Month",
    periodWeek: "Week",
    periodMonth: "Month",
    loading: "Loading…",
    off: "Off",
    saveError: "Could not save shift.",
    loadError: "Failed to load shifts.",
  },
} as const

type Period = "week" | "month"

type ShiftsProps = {
  embedded?: boolean
}

export default function Shifts({ embedded = false }: ShiftsProps) {
  const { businessId } = useAuth()
  const { language } = useLanguage()
  const t = copy[language]
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [team, setTeam] = useState<User[]>([])
  const [shiftsByKey, setShiftsByKey] = useState<Record<string, Shift>>({})
  const [period, setPeriod] = useState<Period>("week")
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [monthCursor, setMonthCursor] = useState(() => firstOfMonth(new Date()))
  const shiftsRef = useRef(shiftsByKey)
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  shiftsRef.current = shiftsByKey

  const displayDays = useMemo(() => {
    if (period === "week") {
      return Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(weekStart)
        d.setDate(weekStart.getDate() + i)
        return d
      })
    }
    const y = monthCursor.getFullYear()
    const m = monthCursor.getMonth()
    return datesInMonth(y, m)
  }, [period, weekStart, monthCursor])

  const locale = language === "el" ? "el-GR" : "en-GB"

  const rangeFromTo = useMemo(() => {
    const first = displayDays[0]
    const last = displayDays[displayDays.length - 1]
    if (!first || !last) return { from: "", to: "" }
    return { from: toIsoLocal(first), to: toIsoLocal(last) }
  }, [displayDays])

  const clearDebounceTimers = useCallback(() => {
    Object.values(debounceTimers.current).forEach(clearTimeout)
    debounceTimers.current = {}
  }, [])

  async function load() {
    if (!businessId || !rangeFromTo.from) return
    setLoading(true)
    clearDebounceTimers()
    try {
      const [teamRows, shiftRows] = await Promise.all([
        fetchTeam(businessId),
        fetchShiftsForRange(businessId, rangeFromTo.from, rangeFromTo.to),
      ])
      const map: Record<string, Shift> = {}
      shiftRows.forEach((s) => {
        map[`${s.user_id}_${s.date}`] = s
      })
      setTeam(teamRows)
      setShiftsByKey(map)
    } catch {
      toast({ title: language === "el" ? "Σφάλμα" : "Error", description: t.loadError, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [businessId, rangeFromTo.from, rangeFromTo.to])

  useEffect(() => {
    return () => {
      clearDebounceTimers()
    }
  }, [])

  async function saveShift(userId: string, date: string, patch: { status?: "active" | "off"; start_time?: string; end_time?: string }) {
    if (!businessId) return
    const key = `${userId}_${date}`
    const current = shiftsRef.current[key]
    const status = patch.status ?? current?.status ?? "active"
    const start_time = patch.start_time ?? current?.start_time ?? "09:00"
    const end_time = patch.end_time ?? current?.end_time ?? "17:00"
    setSavingKey(key)
    try {
      const row = await upsertShift({
        business_id: businessId,
        user_id: userId,
        date,
        status,
        start_time,
        end_time,
      })
      setShiftsByKey((prev) => ({ ...prev, [key]: row }))
    } catch {
      toast({ title: language === "el" ? "Σφάλμα" : "Error", description: t.saveError, variant: "destructive" })
    } finally {
      setSavingKey(null)
    }
  }

  function scheduleTimeSave(userId: string, date: string, key: string) {
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key])
    debounceTimers.current[key] = setTimeout(() => {
      const s = shiftsRef.current[key]
      if (!s || s.status === "off") return
      void saveShift(userId, date, {
        status: "active",
        start_time: (s.start_time ?? "09:00").slice(0, 5),
        end_time: (s.end_time ?? "17:00").slice(0, 5),
      })
    }, 550)
  }

  function goWeek(delta: number) {
    setWeekStart((prev) => {
      const d = new Date(prev)
      d.setDate(prev.getDate() + delta * 7)
      return d
    })
  }

  function goMonth(delta: number) {
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  }

  const thisWeekMonday = mondayOf(new Date())
  const isCurrentWeek = toIsoLocal(weekStart) === toIsoLocal(thisWeekMonday)

  const now = new Date()
  const isThisMonth =
    monthCursor.getFullYear() === now.getFullYear() && monthCursor.getMonth() === now.getMonth()

  const monthTitle = monthCursor.toLocaleDateString(locale, { month: "long", year: "numeric" })

  function onPeriodChange(next: Period) {
    if (next === period) return
    if (next === "month") {
      setMonthCursor(firstOfMonth(weekStart))
    } else {
      setWeekStart(mondayOf(monthCursor))
    }
    setPeriod(next)
  }

  return (
    <div className={cn("space-y-3", !embedded && "space-y-4")}>
      {!embedded && (
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground">
            {period === "week" ? t.subtitleWeek : t.subtitleMonth}
          </p>
        </div>
      )}

      <div
        className={cn(
          "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
          embedded && "rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 backdrop-blur-sm"
        )}
      >
        <Tabs value={period} onValueChange={(v) => onPeriodChange(v as Period)} className="w-full sm:w-auto">
          <TabsList className="grid h-9 w-full grid-cols-2 sm:inline-flex sm:w-auto">
            <TabsTrigger value="week" className="text-xs sm:text-[11px]">
              {t.periodWeek}
            </TabsTrigger>
            <TabsTrigger value="month" className="text-xs sm:text-[11px]">
              {t.periodMonth}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {period === "week" ? (
          <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial">
              <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">
                <span className="text-foreground/90">{t.weekLabel}</span>{" "}
                <span className="tabular-nums">{rangeFromTo.from}</span>
                <span className="mx-1 text-muted-foreground/70">→</span>
                <span className="tabular-nums">{rangeFromTo.to}</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goWeek(-1)} aria-label={t.prev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant={isCurrentWeek ? "secondary" : "outline"}
                size="sm"
                className="h-8 px-2.5 text-xs"
                onClick={() => setWeekStart(thisWeekMonday)}
              >
                {t.today}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goWeek(1)} aria-label={t.next}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial">
              <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <p className="truncate text-xs font-medium capitalize text-muted-foreground sm:text-sm">
                <span className="text-foreground/90">{t.monthLabel}</span> · {monthTitle}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goMonth(-1)} aria-label={t.prev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant={isThisMonth ? "secondary" : "outline"}
                size="sm"
                className="h-8 px-2.5 text-xs"
                onClick={() => setMonthCursor(firstOfMonth(new Date()))}
              >
                {t.thisMonth}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goMonth(1)} aria-label={t.next}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Card className={cn("border-border/50 bg-card/50 shadow-sm", embedded && "border-border/40")}>
        {!embedded && period === "week" && (
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t.weekLabel} {rangeFromTo.from} — {rangeFromTo.to}
            </CardTitle>
          </CardHeader>
        )}
        {!embedded && period === "month" && (
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium capitalize text-muted-foreground">{monthTitle}</CardTitle>
          </CardHeader>
        )}
        <CardContent className={cn(embedded ? "p-3" : "p-4 pt-0")}>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t.loading}</p>
          ) : (
            <div className="space-y-2.5">
              {team.map((member) => (
                <MemberScheduleBlock
                  key={member.id}
                  member={member}
                  displayDays={displayDays}
                  period={period}
                  shiftsByKey={shiftsByKey}
                  setShiftsByKey={setShiftsByKey}
                  shiftsRef={shiftsRef}
                  debounceTimers={debounceTimers}
                  savingKey={savingKey}
                  businessId={businessId}
                  locale={locale}
                  t={t}
                  saveShift={saveShift}
                  scheduleTimeSave={scheduleTimeSave}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

type MemberScheduleBlockProps = {
  member: User
  displayDays: Date[]
  period: Period
  shiftsByKey: Record<string, Shift>
  setShiftsByKey: React.Dispatch<React.SetStateAction<Record<string, Shift>>>
  shiftsRef: React.MutableRefObject<Record<string, Shift>>
  debounceTimers: React.MutableRefObject<Record<string, ReturnType<typeof setTimeout>>>
  savingKey: string | null
  businessId: string | null
  locale: string
  t: typeof copy.el
  saveShift: (userId: string, date: string, patch: { status?: "active" | "off"; start_time?: string; end_time?: string }) => void
  scheduleTimeSave: (userId: string, date: string, key: string) => void
}

function MemberScheduleBlock({
  member,
  displayDays,
  period,
  shiftsByKey,
  setShiftsByKey,
  shiftsRef,
  debounceTimers,
  savingKey,
  businessId,
  locale,
  t,
  saveShift,
  scheduleTimeSave,
}: MemberScheduleBlockProps) {
  const renderDay = (day: Date, variant: "row" | "card") => {
    const date = toIsoLocal(day)
    const key = `${member.id}_${date}`
    const shift = shiftsByKey[key]
    const isOff = (shift?.status ?? "active") === "off"
    const saving = savingKey === key

    const labelWeekday = day.toLocaleDateString(locale, { weekday: "short" })
    const labelDate = day.toLocaleDateString(locale, { day: "2-digit", month: "2-digit" })

    const controls = (
      <>
        <div
          className={cn(
            "flex items-center justify-between gap-1",
            variant === "card" && "border-t border-border/20 pt-1.5 mt-1.5"
          )}
        >
          <span className="text-[10px] font-medium text-muted-foreground">{t.off}</span>
          <Switch
            className="scale-90"
            checked={isOff}
            onCheckedChange={(checked) => {
              if (debounceTimers.current[key]) {
                clearTimeout(debounceTimers.current[key])
                delete debounceTimers.current[key]
              }
              void saveShift(member.id, date, { status: checked ? "off" : "active" })
            }}
          />
        </div>
        {!isOff && (
          <div className={cn("flex items-center gap-0.5", variant === "row" && "flex-wrap justify-end sm:justify-start")}>
            <Input
              type="time"
              disabled={saving}
              className={cn(
                "h-7 px-1 text-[11px] tabular-nums",
                variant === "row" ? "w-[5.25rem] min-w-0" : "min-w-0 flex-1"
              )}
              value={(shift?.start_time ?? "09:00").slice(0, 5)}
              onChange={(e) => {
                const v = e.target.value
                setShiftsByKey((prev) => {
                  const next = {
                    ...(prev[key] ?? {
                      id: `tmp_${key}`,
                      business_id: businessId ?? "",
                      user_id: member.id,
                      date,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    }),
                    status: "active" as const,
                    start_time: v,
                    end_time: prev[key]?.end_time ?? "17:00",
                  } as Shift
                  const merged = { ...prev, [key]: next }
                  shiftsRef.current = merged
                  return merged
                })
                scheduleTimeSave(member.id, date, key)
              }}
            />
            <span className="shrink-0 text-[10px] text-muted-foreground">–</span>
            <Input
              type="time"
              disabled={saving}
              className={cn(
                "h-7 px-1 text-[11px] tabular-nums",
                variant === "row" ? "w-[5.25rem] min-w-0" : "min-w-0 flex-1"
              )}
              value={(shift?.end_time ?? "17:00").slice(0, 5)}
              onChange={(e) => {
                const v = e.target.value
                setShiftsByKey((prev) => {
                  const next = {
                    ...(prev[key] ?? {
                      id: `tmp_${key}`,
                      business_id: businessId ?? "",
                      user_id: member.id,
                      date,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    }),
                    status: "active" as const,
                    start_time: prev[key]?.start_time ?? "09:00",
                    end_time: v,
                  } as Shift
                  const merged = { ...prev, [key]: next }
                  shiftsRef.current = merged
                  return merged
                })
                scheduleTimeSave(member.id, date, key)
              }}
            />
            {saving && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />}
          </div>
        )}
      </>
    )

    if (variant === "row") {
      return (
        <div
          key={key}
          className={cn(
            "flex w-full max-w-full flex-row items-center gap-2 rounded-lg border px-2.5 py-2",
            isOff ? "border-border/30 bg-muted/25" : "border-border/45 bg-background/60"
          )}
        >
          <div className="flex w-[3.25rem] shrink-0 flex-col leading-tight">
            <span className="text-xs font-medium capitalize">{labelWeekday}</span>
            <span className="text-[10px] tabular-nums text-muted-foreground">{labelDate}</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            {controls}
          </div>
        </div>
      )
    }

    return (
      <div
        key={key}
        className={cn(
          "flex min-w-0 flex-col rounded-lg border px-2 py-1.5 transition-colors",
          isOff ? "border-border/30 bg-muted/25" : "border-border/45 bg-background/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
        )}
      >
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{labelWeekday}</p>
        <p className="text-[11px] tabular-nums text-muted-foreground/90">{labelDate}</p>
        {controls}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/40 bg-gradient-to-br from-card via-card to-muted/15 ring-1 ring-black/[0.03] dark:ring-white/[0.04]">
      <div className="flex items-center gap-2.5 border-b border-border/30 bg-muted/10 px-3 py-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[11px] font-semibold text-primary">
          {initialsFromName(member.full_name)}
        </div>
        <p className="min-w-0 truncate text-sm font-medium tracking-tight">{member.full_name}</p>
      </div>

      {period === "month" ? (
        <div className="px-2 pb-2 pt-1">
          <div className="flex flex-col gap-1.5">{displayDays.map((day) => renderDay(day, "row"))}</div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5 p-2 md:hidden">
            {displayDays.map((day) => renderDay(day, "row"))}
          </div>
          <div className="hidden grid-cols-7 gap-1.5 p-2 md:grid">{displayDays.map((day) => renderDay(day, "card"))}</div>
        </>
      )}
    </div>
  )
}
