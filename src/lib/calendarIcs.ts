/** Build iCalendar (.ics) files for import into Google Calendar, Apple Calendar, etc. */

export type IcsExportEvent = {
  id: string
  title: string
  scheduled_date: string
  start_time: string
  end_time: string
  description: string
  /** Hex crew color → RFC 7986 COLOR on VEVENT where supported */
  color?: string | null
  location?: string | null
}

export function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "")
}

function pushFolded(lines: string[], name: string, value: string) {
  const line = `${name}:${value}`
  if (line.length <= 75) {
    lines.push(line)
    return
  }
  let rest = line
  let first = true
  while (rest.length > 0) {
    if (first) {
      lines.push(rest.slice(0, 75))
      rest = rest.slice(75)
    } else {
      lines.push(` ${rest.slice(0, 74)}`)
      rest = rest.slice(74)
    }
    first = false
  }
}

function formatIcsUtc(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

function formatIcsLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function parseLocalDateTime(dateYmd: string, timeStr: string): Date {
  const [y, m, d] = dateYmd.split("-").map((x) => parseInt(x, 10))
  const parts = timeStr.split(":").map((x) => parseInt(x, 10))
  const hh = Number.isFinite(parts[0]) ? parts[0] : 0
  const mm = Number.isFinite(parts[1]) ? parts[1] : 0
  const ss = Number.isFinite(parts[2]) ? parts[2] : 0
  return new Date(y, m - 1, d, hh, mm, ss)
}

function hexToRgbColor(hex: string | null | undefined): string | null {
  if (!hex) return null
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgb(${r},${g},${b})`
}

export function buildIcsCalendar(events: IcsExportEvent[], calendarName: string): string {
  const now = new Date()
  const lines: string[] = []
  lines.push("BEGIN:VCALENDAR")
  lines.push("VERSION:2.0")
  lines.push("PRODID:-//App//Appointment Export//EL")
  lines.push("CALSCALE:GREGORIAN")
  lines.push("METHOD:PUBLISH")
  pushFolded(lines, "X-WR-CALNAME", escapeIcsText(calendarName))

  for (const ev of events) {
    const start = parseLocalDateTime(ev.scheduled_date, ev.start_time)
    let end = parseLocalDateTime(ev.scheduled_date, ev.end_time)
    if (end.getTime() <= start.getTime()) {
      end = new Date(start.getTime() + 60 * 60 * 1000)
    }
    const uid = `${ev.id.replace(/[^a-zA-Z0-9-@.]/g, "")}@appointment-export`
    const rgb = hexToRgbColor(ev.color)

    lines.push("BEGIN:VEVENT")
    pushFolded(lines, "UID", uid)
    pushFolded(lines, "DTSTAMP", formatIcsUtc(now))
    pushFolded(lines, "DTSTART", formatIcsLocal(start))
    pushFolded(lines, "DTEND", formatIcsLocal(end))
    pushFolded(lines, "SUMMARY", escapeIcsText(ev.title))
    pushFolded(lines, "DESCRIPTION", escapeIcsText(ev.description))
    if (ev.location?.trim()) {
      pushFolded(lines, "LOCATION", escapeIcsText(ev.location.trim()))
    }
    if (rgb) {
      pushFolded(lines, "COLOR", rgb)
    }
    lines.push("END:VEVENT")
  }
  lines.push("END:VCALENDAR")
  return `${lines.join("\r\n")}\r\n`
}

export function downloadIcsString(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
