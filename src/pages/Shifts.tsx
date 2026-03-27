import { useEffect, useMemo, useRef, useState } from "react"
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

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase() || "?"
}

const copy = {
  el: {
    title: "Διαχείριση βαρδιών",
    subtitle: "Εβδομαδιαίο ωράριο ανά μέλος — τα ραντεβού σέβονται τις ώρες βάρδιας.",
    prev: "Προηγούμενη",
    next: "Επόμενη",
    today: "Σήμερα",
    weekLabel: "Εβδομάδα",
    loading: "Φόρτωση…",
    off: "Ρεπό",
    saveError: "Δεν αποθηκεύτηκε η βάρδια.",
    loadError: "Αποτυχία φόρτωσης βαρδιών.",
  },
  en: {
    title: "Shift management",
    subtitle: "Weekly schedule per team member — appointments respect shift hours.",
    prev: "Previous",
    next: "Next",
    today: "Today",
    weekLabel: "Week",
    loading: "Loading…",
    off: "Off",
    saveError: "Could not save shift.",
    loadError: "Failed to load shifts.",
  },
} as const

type ShiftsProps = {
  /** When true, hides the page hero — use inside Team & Shifts. */
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
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const shiftsRef = useRef(shiftsByKey)
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  shiftsRef.current = shiftsByKey

  const days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      return d
    })
  }, [weekStart])

  const locale = language === "el" ? "el-GR" : "en-GB"

  async function load() {
    if (!businessId) return
    setLoading(true)
    try {
      const from = toIsoLocal(days[0])
      const to = toIsoLocal(days[6])
      const [teamRows, shiftRows] = await Promise.all([
        fetchTeam(businessId),
        fetchShiftsForRange(businessId, from, to),
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
  }, [businessId, weekStart])

  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout)
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

  const thisWeekMonday = mondayOf(new Date())
  const isCurrentWeek = toIsoLocal(weekStart) === toIsoLocal(thisWeekMonday)

  return (
    <div className={cn("space-y-3", !embedded && "space-y-4")}>
      {!embedded && (
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
      )}

      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2",
          embedded && "rounded-xl border border-border/50 bg-muted/20 px-3 py-2 backdrop-blur-sm"
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">
            <span className="text-foreground/90">{t.weekLabel}</span>{" "}
            <span className="tabular-nums">{toIsoLocal(days[0])}</span>
            <span className="mx-1 text-muted-foreground/70">→</span>
            <span className="tabular-nums">{toIsoLocal(days[6])}</span>
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

      <Card className={cn("border-border/50 bg-card/50 shadow-sm", embedded && "border-border/40")}>
        {!embedded && (
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t.weekLabel} {toIsoLocal(days[0])} — {toIsoLocal(days[6])}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className={cn(embedded ? "p-3 pt-3" : "pt-0")}>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t.loading}</p>
          ) : (
            <div className="space-y-2.5">
              {team.map((member) => (
                <div
                  key={member.id}
                  className="overflow-hidden rounded-xl border border-border/40 bg-gradient-to-br from-card via-card to-muted/15 ring-1 ring-black/[0.03] dark:ring-white/[0.04]"
                >
                  <div className="flex items-center gap-2.5 border-b border-border/30 bg-muted/10 px-3 py-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[11px] font-semibold text-primary">
                      {initialsFromName(member.full_name)}
                    </div>
                    <p className="min-w-0 truncate text-sm font-medium tracking-tight">{member.full_name}</p>
                  </div>
                  <div className="overflow-x-auto p-2">
                    <div className="flex min-w-[640px] gap-1.5 md:min-w-0 md:grid md:grid-cols-7 md:gap-1.5">
                      {days.map((day) => {
                        const date = toIsoLocal(day)
                        const key = `${member.id}_${date}`
                        const shift = shiftsByKey[key]
                        const isOff = (shift?.status ?? "active") === "off"
                        const saving = savingKey === key
                        return (
                          <div
                            key={key}
                            className={cn(
                              "flex min-w-[88px] flex-col rounded-lg border px-2 py-1.5 transition-colors md:min-w-0",
                              isOff
                                ? "border-border/30 bg-muted/25"
                                : "border-border/45 bg-background/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
                            )}
                          >
                            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                              {day.toLocaleDateString(locale, { weekday: "short" })}
                            </p>
                            <p className="text-[11px] tabular-nums text-muted-foreground/90">
                              {day.toLocaleDateString(locale, { day: "2-digit", month: "2-digit" })}
                            </p>
                            <div className="mt-1.5 flex items-center justify-between gap-1 border-t border-border/20 pt-1.5">
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
                              <div className="mt-1.5 flex items-center gap-0.5">
                                <Input
                                  type="time"
                                  disabled={saving}
                                  className="h-7 flex-1 min-w-0 px-1 text-[11px] tabular-nums"
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
                                  className="h-7 flex-1 min-w-0 px-1 text-[11px] tabular-nums"
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
                          </div>
                        )
                      })}
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
