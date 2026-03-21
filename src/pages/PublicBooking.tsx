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
          page: "from-rose-50 via-pink-50 to-fuchsia-100",
          card: "border-pink-200/70 bg-white/85 backdrop-blur",
          title: "text-fuchsia-700",
          button: "bg-fuchsia-600 hover:bg-fuchsia-700 text-white",
          accent: "text-fuchsia-700",
          selected: "border-fuchsia-300 bg-fuchsia-50",
        }
      case "salon_luxe":
        return {
          page: "from-violet-50 via-purple-50 to-indigo-100",
          card: "border-violet-200/70 bg-white/85 backdrop-blur",
          title: "text-violet-700",
          button: "bg-violet-600 hover:bg-violet-700 text-white",
          accent: "text-violet-700",
          selected: "border-violet-300 bg-violet-50",
        }
      case "craftsman":
        return {
          page: "from-amber-50 via-orange-50 to-yellow-100",
          card: "border-amber-300/70 bg-white/90 backdrop-blur",
          title: "text-amber-800",
          button: "bg-amber-600 hover:bg-amber-700 text-white",
          accent: "text-amber-800",
          selected: "border-amber-300 bg-amber-50",
        }
      case "medical":
        return {
          page: "from-cyan-50 via-sky-50 to-blue-100",
          card: "border-sky-200/70 bg-white/90 backdrop-blur",
          title: "text-sky-700",
          button: "bg-sky-600 hover:bg-sky-700 text-white",
          accent: "text-sky-700",
          selected: "border-sky-300 bg-sky-50",
        }
      default:
        return {
          page: "from-slate-50 via-white to-slate-100",
          card: "border-slate-200/70 bg-white/90 backdrop-blur",
          title: "text-foreground",
          button: "bg-slate-900 hover:bg-slate-800 text-white",
          accent: "text-slate-700",
          selected: "border-slate-300 bg-slate-50",
        }
    }
  }, [theme])

  return (
    <div className={`min-h-screen bg-gradient-to-b ${themeClasses.page} px-4 py-8`}>
      <div className="mx-auto max-w-5xl space-y-5">
        <Card className={`${themeClasses.card} shadow-[0_20px_60px_rgba(15,23,42,0.12)]`}>
          <CardContent className="py-6">
            <div className="text-center">
              <h1 className={`text-3xl md:text-4xl font-semibold tracking-tight ${themeClasses.title}`}>
                {businessName || "Online Booking"}
              </h1>
              <p className="mt-2 text-sm md:text-base text-muted-foreground">
                Κλείσε το ραντεβού σου εύκολα online, σε λιγότερο από 1 λεπτό.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card className={`${themeClasses.card} shadow-[0_16px_40px_rgba(15,23,42,0.10)]`}>
            <CardHeader>
              <CardTitle>Νέα κράτηση</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Φόρτωση...</p>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label>1) Επιλογή υπηρεσιών</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {services.map((s) => {
                        const selected = selectedServiceIds.includes(s.id)
                        const servicePrice =
                          s.billing_type === "hourly" && s.hourly_rate != null && s.duration_minutes != null
                            ? ((Number(s.hourly_rate) * Number(s.duration_minutes)) / 60).toFixed(2)
                            : Number(s.price ?? 0).toFixed(2)
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() =>
                              setSelectedServiceIds((prev) =>
                                prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id],
                              )
                            }
                            className={`rounded-xl border p-3 text-left transition-colors ${
                              selected ? themeClasses.selected : "border-border/60 bg-background/70 hover:bg-background"
                            }`}
                          >
                            <p className="text-sm font-medium">{s.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {s.duration_minutes ?? 0} λεπτά • €{servicePrice}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>2) Ημερομηνία</Label>
                      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>3) Διαθέσιμη ώρα</Label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-32 overflow-y-auto pr-1">
                        {slots.length === 0 ? (
                          <p className="col-span-full text-xs text-muted-foreground">Δεν υπάρχουν διαθέσιμες ώρες.</p>
                        ) : (
                          slots.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setStartTime(s)}
                              className={`h-9 rounded-md border text-xs transition-colors ${
                                startTime === s
                                  ? `${themeClasses.selected} ${themeClasses.accent}`
                                  : "border-border/60 bg-background/70 hover:bg-background"
                              }`}
                            >
                              {s.slice(0, 5)}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>4) Όνομα</Label>
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
                    <Label>Σημειώσεις (προαιρετικά)</Label>
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

          <Card className={`${themeClasses.card} h-fit shadow-[0_16px_40px_rgba(15,23,42,0.10)]`}>
            <CardHeader>
              <CardTitle>Σύνοψη κράτησης</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Υπηρεσίες</p>
                <p className="font-medium">
                  {selectedServices.length > 0 ? selectedServices.map((s) => s.name).join(", ") : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ημερομηνία / Ώρα</p>
                <p className="font-medium">{date || "—"} {startTime ? `• ${startTime.slice(0, 5)}` : ""}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                <p className="text-xs text-muted-foreground">Εκτίμηση κόστους</p>
                <p className={`text-xl font-semibold ${themeClasses.title}`}>€{totalEstimate.toFixed(2)}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Η τελική επιβεβαίωση και το ποσό μπορεί να διαμορφωθούν από την επιχείρηση.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
