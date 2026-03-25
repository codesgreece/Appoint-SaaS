import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"
import { fetchShiftsForRange, fetchTeam, upsertShift } from "@/services/api"
import type { Shift, User } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

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

export default function Shifts() {
  const { businessId } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [team, setTeam] = useState<User[]>([])
  const [shiftsByKey, setShiftsByKey] = useState<Record<string, Shift>>({})
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))

  const days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      return d
    })
  }, [weekStart])

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
      toast({ title: "Σφάλμα", description: "Αποτυχία φόρτωσης βαρδιών.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [businessId, weekStart])

  async function saveShift(userId: string, date: string, patch: { status?: "active" | "off"; start_time?: string; end_time?: string }) {
    if (!businessId) return
    const key = `${userId}_${date}`
    const current = shiftsByKey[key]
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
      toast({ title: "Σφάλμα", description: "Δεν αποθηκεύτηκε η βάρδια.", variant: "destructive" })
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Shift Management</h1>
          <p className="text-sm text-muted-foreground">Εβδομαδιαία διαχείριση βαρδιών ανά μέλος ομάδας.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekStart((prev) => {
              const d = new Date(prev)
              d.setDate(prev.getDate() - 7)
              return d
            })}
          >
            Προηγούμενη εβδομάδα
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekStart((prev) => {
              const d = new Date(prev)
              d.setDate(prev.getDate() + 7)
              return d
            })}
          >
            Επόμενη εβδομάδα
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Εβδομάδα {toIsoLocal(days[0])} - {toIsoLocal(days[6])}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Φόρτωση...</p>
          ) : (
            <div className="space-y-4">
              {team.map((member) => (
                <div key={member.id} className="rounded-lg border border-border/70 p-3">
                  <p className="mb-2 text-sm font-medium">{member.full_name}</p>
                  <div className="grid gap-2 md:grid-cols-7">
                    {days.map((day) => {
                      const date = toIsoLocal(day)
                      const key = `${member.id}_${date}`
                      const shift = shiftsByKey[key]
                      const isOff = (shift?.status ?? "active") === "off"
                      return (
                        <div key={key} className="rounded-md border border-border/60 p-2">
                          <p className="text-[11px] text-muted-foreground">{day.toLocaleDateString("el-GR", { weekday: "short", day: "2-digit", month: "2-digit" })}</p>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-xs">OFF</span>
                            <Switch
                              checked={isOff}
                              onCheckedChange={(checked) => void saveShift(member.id, date, { status: checked ? "off" : "active" })}
                            />
                          </div>
                          {!isOff && (
                            <div className="mt-2 space-y-2">
                              <Input
                                type="time"
                                value={(shift?.start_time ?? "09:00").slice(0, 5)}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setShiftsByKey((prev) => ({
                                    ...prev,
                                    [key]: {
                                      ...(prev[key] ?? {
                                        id: `tmp_${key}`,
                                        business_id: businessId ?? "",
                                        user_id: member.id,
                                        date,
                                        created_at: new Date().toISOString(),
                                        updated_at: new Date().toISOString(),
                                      }),
                                      status: "active",
                                      start_time: v,
                                      end_time: prev[key]?.end_time ?? "17:00",
                                    } as Shift,
                                  }))
                                }}
                              />
                              <Input
                                type="time"
                                value={(shift?.end_time ?? "17:00").slice(0, 5)}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setShiftsByKey((prev) => ({
                                    ...prev,
                                    [key]: {
                                      ...(prev[key] ?? {
                                        id: `tmp_${key}`,
                                        business_id: businessId ?? "",
                                        user_id: member.id,
                                        date,
                                        created_at: new Date().toISOString(),
                                        updated_at: new Date().toISOString(),
                                      }),
                                      status: "active",
                                      start_time: prev[key]?.start_time ?? "09:00",
                                      end_time: v,
                                    } as Shift,
                                  }))
                                }}
                              />
                              <Button
                                size="sm"
                                className="w-full"
                                disabled={savingKey === key}
                                onClick={() =>
                                  void saveShift(member.id, date, {
                                    status: "active",
                                    start_time: shiftsByKey[key]?.start_time ?? "09:00",
                                    end_time: shiftsByKey[key]?.end_time ?? "17:00",
                                  })
                                }
                              >
                                {savingKey === key ? "..." : "Αποθήκευση"}
                              </Button>
                            </div>
                          )}
                        </div>
                      )
                    })}
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
