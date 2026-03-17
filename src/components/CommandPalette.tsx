import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Search } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type ResultItem =
  | { kind: "customer"; id: string; label: string }
  | { kind: "service"; id: string; label: string }
  | { kind: "appointment"; id: string; label: string }

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const { businessId } = useAuth()
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ResultItem[]>([])
  const q = query.trim()

  useEffect(() => {
    if (!open) {
      setQuery("")
      setResults([])
      setLoading(false)
    }
  }, [open])

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!open) return
      if (!businessId) return
      if (q.length < 2) {
        setResults([])
        return
      }
      try {
        setLoading(true)
        const [customers, services, appointments] = await Promise.all([
          supabase
            .from("customers")
            .select("id, first_name, last_name")
            .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
            .limit(5),
          supabase
            .from("services")
            .select("id, name")
            .ilike("name", `%${q}%`)
            .limit(5),
          supabase
            .from("appointments_jobs")
            .select("id, title, scheduled_date, start_time")
            .ilike("title", `%${q}%`)
            .order("scheduled_date", { ascending: false })
            .limit(5),
        ])

        if (cancelled) return
        const next: ResultItem[] = []
        if (!customers.error) {
          for (const c of (customers.data ?? []) as any[]) {
            next.push({ kind: "customer", id: c.id, label: `${c.first_name} ${c.last_name}`.trim() })
          }
        }
        if (!services.error) {
          for (const s of (services.data ?? []) as any[]) {
            next.push({ kind: "service", id: s.id, label: s.name })
          }
        }
        if (!appointments.error) {
          for (const a of (appointments.data ?? []) as any[]) {
            next.push({ kind: "appointment", id: a.id, label: `${a.scheduled_date} ${a.start_time} — ${a.title}` })
          }
        }
        setResults(next)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    const t = setTimeout(run, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [open, businessId, q])

  const grouped = useMemo(() => {
    const by: Record<string, ResultItem[]> = { customers: [], services: [], appointments: [] }
    for (const r of results) {
      if (r.kind === "customer") by.customers.push(r)
      if (r.kind === "service") by.services.push(r)
      if (r.kind === "appointment") by.appointments.push(r)
    }
    return by
  }, [results])

  function selectResult(r: ResultItem) {
    onOpenChange(false)
    if (r.kind === "customer") navigate(`/customers?q=${encodeURIComponent(q)}`)
    if (r.kind === "service") navigate(`/services?q=${encodeURIComponent(q)}`)
    if (r.kind === "appointment") navigate(`/appointments?q=${encodeURIComponent(q)}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Αναζήτηση</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Ψάξε πελάτη, υπηρεσία ή ραντεβού..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="text-xs text-muted-foreground">
            {loading ? "Αναζήτηση..." : q.length < 2 ? "Γράψε τουλάχιστον 2 χαρακτήρες." : `${results.length} αποτελέσματα`}
          </div>

          <div className="space-y-3">
            {(["customers", "services", "appointments"] as const).map((k) => {
              const items = grouped[k]
              if (!items.length) return null
              const title = k === "customers" ? "Πελάτες" : k === "services" ? "Υπηρεσίες" : "Ραντεβού"
              return (
                <div key={k} className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">{title}</div>
                  <div className="rounded-md border overflow-hidden">
                    {items.map((it) => (
                      <button
                        key={it.kind + it.id}
                        type="button"
                        onClick={() => selectResult(it)}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors",
                        )}
                      >
                        {it.label}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

