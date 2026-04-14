/** Whether current time falls inside a shift window (PostgreSQL `time` as "HH:MM:SS"). */
export function isOnShiftNow(now: Date, startTime: string | null, endTime: string | null): boolean {
  function toMinutes(t: string | null): number | null {
    if (!t || !String(t).trim()) return null
    const parts = String(t).split(":")
    const h = parseInt(parts[0] ?? "", 10)
    const m = parseInt(parts[1] ?? "", 10)
    if (Number.isNaN(h) || Number.isNaN(m)) return null
    return h * 60 + m
  }

  const cur = now.getHours() * 60 + now.getMinutes()
  const s = toMinutes(startTime)
  const e = toMinutes(endTime)

  if (s === null && e === null) return true
  if (s === null || e === null) return true

  if (e < s) return cur >= s || cur < e
  return cur >= s && cur < e
}

export function countStaffOnShiftNow(
  rows: Array<{ start_time: string | null; end_time: string | null }>,
  now: Date,
): number {
  return rows.filter((r) => isOnShiftNow(now, r.start_time, r.end_time)).length
}
