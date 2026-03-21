import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type BookingService = {
  id: string
  name: string
  duration_minutes: number | null
  price: number | null
  billing_type: string
  hourly_rate: number | null
}

export default function PublicBooking() {
  const { slug = "" } = useParams()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [services, setServices] = useState<BookingService[]>([])
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [slots, setSlots] = useState<string[]>([])
  const [startTime, setStartTime] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [notes, setNotes] = useState("")
  const [theme, setTheme] = useState("default")

  const selectedServices = useMemo(
    () => services.filter((s) => selectedServiceIds.includes(s.id)),
    [services, selectedServiceIds],
  )

  const totalEstimate = useMemo(() => {
    return selectedServices.reduce((sum, s) => {
      if (s.billing_type === "hourly" && s.hourly_rate != null && s.duration_minutes != null) {
        return sum + (Number(s.hourly_rate) * Number(s.duration_minutes)) / 60
      }
      return sum + Number(s.price ?? 0)
    }, 0)
  }, [selectedServices])

  async function callPublicBooking(action: string, body: Record<string, unknown>) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
    const res = await fetch(`${supabaseUrl}/functions/v1/public-booking`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
      },
      body: JSON.stringify({ action, slug, ...body }),
    })
    const data = await res.json()
    if (!res.ok || !data?.success) throw new Error(data?.error || "Request failed")
    return data
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    callPublicBooking("get_config", {})
      .then((data) => {
        if (!active) return
        setBusinessName(data.business?.name ?? "")
        setServices(data.services ?? [])
        setTheme(String(data.business?.booking_theme ?? "default"))
      })
      .catch((e) => {
        if (!active) return
        setError(e instanceof Error ? e.message : "Αποτυχία φόρτωσης")
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [slug])

  useEffect(() => {
    if (!date || selectedServiceIds.length === 0) {
      setSlots([])
      setStartTime("")
      return
    }
    callPublicBooking("get_slots", { date, service_id: selectedServiceIds[0] })
      .then((data) => setSlots(data.slots ?? []))
      .catch(() => setSlots([]))
  }, [date, selectedServiceIds, slug])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSuccess("")
    try {
      setSubmitting(true)
      const data = await callPublicBooking("create_booking", {
        date,
        start_time: startTime,
        customer_first_name: firstName,
        customer_last_name: lastName,
        customer_phone: phone,
        notes,
        service_ids: selectedServiceIds,
      })
      setSuccess(
        data.status === "pending"
          ? "Το αίτημα καταχωρήθηκε επιτυχώς και περιμένει έγκριση."
          : "Η κράτηση ολοκληρώθηκε επιτυχώς.",
      )
      setFirstName("")
      setLastName("")
      setPhone("")
      setNotes("")
      setStartTime("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Αποτυχία κράτησης")
    } finally {
      setSubmitting(false)
    }
  }

  const themeClasses = useMemo(() => {
    switch (theme) {
      case "beauty":
        return {
          page: "from-pink-50 via-rose-50 to-fuchsia-100",
          card: "border-pink-200 bg-white/90",
          title: "text-pink-700",
          button: "bg-pink-600 hover:bg-pink-700 text-white",
        }
      case "salon_luxe":
        return {
          page: "from-violet-50 via-purple-50 to-indigo-100",
          card: "border-violet-200 bg-white/90",
          title: "text-violet-700",
          button: "bg-violet-600 hover:bg-violet-700 text-white",
        }
      case "craftsman":
        return {
          page: "from-amber-50 via-orange-50 to-yellow-100",
          card: "border-amber-300 bg-white/95",
          title: "text-amber-800",
          button: "bg-amber-600 hover:bg-amber-700 text-white",
        }
      case "medical":
        return {
          page: "from-cyan-50 via-sky-50 to-blue-100",
          card: "border-sky-200 bg-white/95",
          title: "text-sky-700",
          button: "bg-sky-600 hover:bg-sky-700 text-white",
        }
      default:
        return {
          page: "from-background to-muted/40",
          card: "border-border bg-card",
          title: "text-foreground",
          button: "",
        }
    }
  }, [theme])

  return (
    <div className={`min-h-screen bg-gradient-to-b ${themeClasses.page} p-4`}>
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="text-center">
          <h1 className={`text-2xl font-semibold ${themeClasses.title}`}>{businessName || "Online Booking"}</h1>
          <p className="text-sm text-muted-foreground">Κλείσε το ραντεβού σου online</p>
        </div>
        <Card className={themeClasses.card}>
          <CardHeader>
            <CardTitle>Νέα κράτηση</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Φόρτωση...</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Υπηρεσίες</Label>
                  <div className="flex flex-wrap gap-2">
                    {services.map((s) => {
                      const selected = selectedServiceIds.includes(s.id)
                      return (
                        <Button
                          key={s.id}
                          type="button"
                          size="sm"
                          variant={selected ? "default" : "outline"}
                          onClick={() =>
                            setSelectedServiceIds((prev) =>
                              prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id],
                            )
                          }
                        >
                          {s.name}
                        </Button>
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">Εκτίμηση συνόλου: €{totalEstimate.toFixed(2)}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Ημερομηνία</Label>
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Διαθέσιμες ώρες</Label>
                    <select
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    >
                      <option value="">Επιλογή ώρας</option>
                      {slots.map((s) => (
                        <option key={s} value={s}>
                          {s.slice(0, 5)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Όνομα</Label>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Επώνυμο</Label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Τηλέφωνο</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Σημειώσεις</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    className={themeClasses.button}
                    disabled={submitting || !startTime || selectedServiceIds.length === 0}
                  >
                    {submitting ? "Καταχώρηση..." : "Κλείσιμο ραντεβού"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
