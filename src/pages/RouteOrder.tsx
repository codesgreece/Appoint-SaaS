import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"
import { fetchAppointments, updateAppointment } from "@/services/api"
import type { AppointmentJob, Customer } from "@/types"
import { formatDate } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type RouteAppointment = AppointmentJob & {
  customer?: Customer | null
}

function formatTime(t: string | null | undefined): string {
  if (!t) return "--:--"
  return String(t).slice(0, 5)
}

function sortForRoute(list: RouteAppointment[]): RouteAppointment[] {
  return [...list].sort((a, b) => {
    const ai = a.order_index
    const bi = b.order_index
    const aHas = ai != null
    const bHas = bi != null
    if (aHas && bHas) return Number(ai) - Number(bi)
    if (aHas && !bHas) return -1
    if (!aHas && bHas) return 1
    return String(a.start_time ?? "").localeCompare(String(b.start_time ?? ""))
  })
}

export default function RouteOrder() {
  const { businessId } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<RouteAppointment[]>([])
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  async function loadTodayAppointments() {
    if (!businessId) return
    setLoading(true)
    try {
      const data = await fetchAppointments(businessId, { from: today, to: today })
      setItems(sortForRoute(data as RouteAppointment[]))
    } catch {
      toast({ title: "Σφάλμα", description: "Αποτυχία φόρτωσης ημερήσιας διαδρομής.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTodayAppointments()
  }, [businessId, today])

  function handleDragStart(id: string) {
    setDraggedId(id)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
  }

  function handleDrop(targetId: string) {
    if (!draggedId || draggedId === targetId) return
    setItems((prev) => {
      const next = [...prev]
      const from = next.findIndex((x) => x.id === draggedId)
      const to = next.findIndex((x) => x.id === targetId)
      if (from < 0 || to < 0) return prev
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    setDraggedId(null)
  }

  async function persistOrder() {
    if (!businessId || items.length === 0) return
    setSaving(true)
    try {
      await Promise.all(
        items.map((item, index) =>
          updateAppointment(item.id, { order_index: index + 1 }),
        ),
      )
      setItems((prev) => prev.map((x, i) => ({ ...x, order_index: i + 1 })))
      toast({ title: "Αποθηκεύτηκε", description: "Η σειρά εργασιών ενημερώθηκε." })
    } catch {
      toast({ title: "Σφάλμα", description: "Δεν αποθηκεύτηκε η σειρά.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  function openRouteInMaps() {
    const ordered = sortForRoute(items)
    const addresses = ordered
      .map((x) => (x.location_address ?? "").trim())
      .filter(Boolean)
    if (addresses.length < 2) {
      toast({
        title: "Άνοιγμα διαδρομής",
        description: "Χρειάζονται τουλάχιστον 2 έγκυρες διευθύνσεις.",
        variant: "destructive",
      })
      return
    }
    const path = addresses.map((a) => encodeURIComponent(a)).join("/")
    const url = `https://www.google.com/maps/dir/${path}`
    window.open(url, "_blank", "noopener,noreferrer")
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ημερήσια Διαδρομή</h1>
          <p className="text-sm text-muted-foreground">
            Σειρά Εργασιών για {formatDate(today)}.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openRouteInMaps}>
            Άνοιγμα διαδρομής
          </Button>
          <Button onClick={() => void persistOrder()} disabled={saving || items.length === 0}>
            {saving ? "Αποθήκευση..." : "Αποθήκευση σειράς"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Σημερινά ραντεβού</CardTitle>
          <CardDescription>Κάνε drag-and-drop για να ορίσεις τη σειρά εκτέλεσης.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Φόρτωση...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Δεν υπάρχουν ραντεβού για σήμερα.</p>
          ) : (
            items.map((item, idx) => {
              const customerName = item.customer
                ? `${item.customer.first_name} ${item.customer.last_name}`.trim()
                : "Πελάτης"
              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => handleDragStart(item.id)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(item.id)}
                  className="rounded-lg border border-border/70 bg-card/60 p-3 cursor-move"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="font-medium">{customerName}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.title} • {formatTime(item.start_time)} - {formatTime(item.end_time)}
                      </p>
                      <p className="text-sm">{item.location_address?.trim() || "Χωρίς διεύθυνση"}</p>
                    </div>
                    <Badge variant="outline">#{idx + 1}</Badge>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
