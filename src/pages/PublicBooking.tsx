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

type BusinessInfo = {
  name?: string
  business_type?: string | null
  phone?: string | null
  logo_url?: string | null
  booking_theme?: string | null
}

type PublicBookingApiOk = {
  success: true
  business?: BusinessInfo & { name?: string }
  services?: BookingService[]
  slots?: string[]
  dates?: string[]
  status?: string
}

export default function PublicBooking() {
  const { slug = "" } = useParams()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({})
  const [services, setServices] = useState<BookingService[]>([])
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [availableDates, setAvailableDates] = useState<string[]>([])
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
    const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "")
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
    if (!supabaseUrl || !anonKey) {
      throw new Error("Λείπει ρύθμιση Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).")
    }
    // Το API των Edge Functions θέλει και τα δύο — χωρίς Authorization συχνά 401 πριν φτάσει ο κώδικας.
    const res = await fetch(`${supabaseUrl}/functions/v1/public-booking`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ action, slug: slug.trim().toLowerCase(), ...body }),
    })
    const raw = await res.text()
    let parsed: { success?: boolean; error?: string } & Record<string, unknown> = { success: false }
    try {
      parsed = raw ? (JSON.parse(raw) as typeof parsed) : { success: false }
    } catch {
      throw new Error(res.ok ? "Άκυρη απάντηση διακομιστή." : `Σφάλμα ${res.status}`)
    }
    if (!res.ok || !parsed?.success) {
      throw new Error(typeof parsed?.error === "string" ? parsed.error : `Αποτυχία (${res.status})`)
    }
    return parsed as PublicBookingApiOk
  }

  useEffect(() => {
    let active = true
    const s = slug.trim()
    if (!s) {
      setError("Λείπει το όνομα σελίδας κράτησης στο URL (π.χ. /book/to-slug-mou).")
      setLoading(false)
      return
    }
    setLoading(true)
    setError("")
    callPublicBooking("get_config", {})
      .then((data) => {
        if (!active) return
        setBusinessName(data.business?.name ?? "")
        setBusinessInfo((data.business ?? {}) as BusinessInfo)
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
    if (!slug.trim() || !date || selectedServiceIds.length === 0) {
      setSlots([])
      setStartTime("")
      return
    }
    callPublicBooking("get_slots", { date, service_ids: selectedServiceIds, service_id: selectedServiceIds[0] })
      .then((data) => setSlots(data.slots ?? []))
      .catch(() => setSlots([]))
  }, [date, selectedServiceIds, slug])

  useEffect(() => {
    if (!slug.trim() || selectedServiceIds.length === 0) {
      setAvailableDates([])
      setDate(new Date().toISOString().slice(0, 10))
      return
    }
    callPublicBooking("get_available_dates", { service_ids: selectedServiceIds, service_id: selectedServiceIds[0] })
      .then((data) => {
        const dates = data.dates ?? []
        setAvailableDates(dates)
        setDate((prev) => (dates.includes(prev) ? prev : (dates[0] ?? prev)))
      })
      .catch(() => setAvailableDates([]))
  }, [selectedServiceIds, slug])

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
          text: "text-fuchsia-950",
          muted: "text-fuchsia-800/80",
          button: "bg-fuchsia-600 hover:bg-fuchsia-700 text-white",
          accent: "text-fuchsia-700",
          selected: "border-fuchsia-300 bg-fuchsia-50",
          neutral: "border-fuchsia-200/70 bg-white/80 hover:bg-fuchsia-50/60",
        }
      case "salon_luxe":
        return {
          page: "from-violet-50 via-purple-50 to-indigo-100",
          card: "border-violet-200/70 bg-white/85 backdrop-blur",
          title: "text-violet-700",
          text: "text-violet-950",
          muted: "text-violet-900/75",
          button: "bg-violet-600 hover:bg-violet-700 text-white",
          accent: "text-violet-700",
          selected: "border-violet-300 bg-violet-50",
          neutral: "border-violet-200/70 bg-white/80 hover:bg-violet-50/60",
        }
      case "craftsman":
        return {
          page: "from-amber-50 via-orange-50 to-yellow-100",
          card: "border-amber-300/70 bg-white/90 backdrop-blur",
          title: "text-amber-800",
          text: "text-amber-950",
          muted: "text-amber-900/80",
          button: "bg-amber-600 hover:bg-amber-700 text-white",
          accent: "text-amber-800",
          selected: "border-amber-300 bg-amber-50",
          neutral: "border-amber-300/70 bg-white/80 hover:bg-amber-50/60",
        }
      case "medical":
        return {
          page: "from-cyan-50 via-sky-50 to-blue-100",
          card: "border-sky-200/70 bg-white/90 backdrop-blur",
          title: "text-sky-700",
          text: "text-sky-950",
          muted: "text-sky-900/75",
          button: "bg-sky-600 hover:bg-sky-700 text-white",
          accent: "text-sky-700",
          selected: "border-sky-300 bg-sky-50",
          neutral: "border-sky-200/70 bg-white/80 hover:bg-sky-50/60",
        }
      default:
        return {
          page: "from-slate-50 via-white to-slate-100",
          card: "border-slate-200/70 bg-white/90 backdrop-blur",
          title: "text-foreground",
          text: "text-slate-900",
          muted: "text-slate-600",
          button: "bg-slate-900 hover:bg-slate-800 text-white",
          accent: "text-slate-700",
          selected: "border-slate-300 bg-slate-50",
          neutral: "border-slate-300/70 bg-white/80 hover:bg-slate-50/60",
        }
    }
  }, [theme])

  return (
    <div className={`min-h-screen bg-gradient-to-b ${themeClasses.page} px-4 py-8`}>
      <div className="mx-auto max-w-5xl space-y-5">
        <Card className={`${themeClasses.card} shadow-[0_20px_60px_rgba(15,23,42,0.12)]`}>
          <CardContent className={`py-6 ${themeClasses.text}`}>
            <div className="text-center space-y-3">
              <h1 className={`text-3xl md:text-4xl font-semibold tracking-tight ${themeClasses.title}`}>
                {businessName || "Online Booking"}
              </h1>
              <p className={`mt-2 text-sm md:text-base ${themeClasses.muted}`}>
                Κλείσε το ραντεβού σου εύκολα online, σε λιγότερο από 1 λεπτό.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                {businessInfo.business_type ? (
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] ${themeClasses.neutral} ${themeClasses.muted}`}>
                    {businessInfo.business_type}
                  </span>
                ) : null}
                {businessInfo.phone ? (
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] ${themeClasses.neutral} ${themeClasses.muted}`}>
                    Τηλ: {businessInfo.phone}
                  </span>
                ) : null}
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] ${themeClasses.neutral} ${themeClasses.muted}`}>
                  SSL ασφαλής κράτηση
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card className={`${themeClasses.card} shadow-[0_16px_40px_rgba(15,23,42,0.10)]`}>
            <CardHeader>
              <CardTitle className={themeClasses.text}>Νέα κράτηση</CardTitle>
            </CardHeader>
            <CardContent className={themeClasses.text}>
              {loading ? (
                <p className={`text-sm ${themeClasses.muted}`}>Φόρτωση...</p>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label className={themeClasses.text}>1) Επιλογή υπηρεσιών</Label>
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
                              selected ? themeClasses.selected : themeClasses.neutral
                            }`}
                          >
                            <p className="text-sm font-medium">{s.name}</p>
                            <p className={`text-xs mt-1 ${themeClasses.muted}`}>
                              {s.duration_minutes ?? 0} λεπτά • €{servicePrice}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className={themeClasses.text}>2) Ημερομηνία</Label>
                      {selectedServiceIds.length === 0 ? (
                        <p className={`text-xs ${themeClasses.muted}`}>Επίλεξε υπηρεσία για να εμφανιστούν διαθέσιμες ημέρες.</p>
                      ) : availableDates.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                          {availableDates.map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setDate(d)}
                              className={`h-9 rounded-md border px-2 text-xs transition-colors ${
                                date === d
                                  ? `${themeClasses.selected} ${themeClasses.accent}`
                                  : themeClasses.neutral
                              }`}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                          <p className={`text-[11px] ${themeClasses.muted}`}>
                            Δεν επέστρεψαν διαθέσιμες ημέρες από τον server. Επίλεξε ημερομηνία χειροκίνητα.
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className={themeClasses.text}>3) Διαθέσιμη ώρα</Label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-32 overflow-y-auto pr-1">
                        {slots.length === 0 ? (
                          <p className={`col-span-full text-xs ${themeClasses.muted}`}>Δεν υπάρχουν διαθέσιμες ώρες.</p>
                        ) : (
                          slots.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setStartTime(s)}
                              className={`h-9 rounded-md border text-xs transition-colors ${
                                startTime === s
                                  ? `${themeClasses.selected} ${themeClasses.accent}`
                                  : themeClasses.neutral
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
                      <Label className={themeClasses.text}>4) Όνομα</Label>
                      <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label className={themeClasses.text}>Επώνυμο</Label>
                      <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className={themeClasses.text}>Τηλέφωνο</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label className={themeClasses.text}>Σημειώσεις (προαιρετικά)</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                  {error ? <p className="text-sm text-destructive">{error}</p> : null}
                  {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      className={`${themeClasses.button} disabled:opacity-60 disabled:saturate-75`}
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
              <CardTitle className={themeClasses.text}>Σύνοψη κράτησης</CardTitle>
            </CardHeader>
            <CardContent className={`space-y-3 text-sm ${themeClasses.text}`}>
              <div>
                <p className={`text-xs ${themeClasses.muted}`}>Υπηρεσίες</p>
                <p className="font-medium">
                  {selectedServices.length > 0 ? selectedServices.map((s) => s.name).join(", ") : "—"}
                </p>
              </div>
              <div>
                <p className={`text-xs ${themeClasses.muted}`}>Ημερομηνία / Ώρα</p>
                <p className="font-medium">{date || "—"} {startTime ? `• ${startTime.slice(0, 5)}` : ""}</p>
              </div>
              <div className={`rounded-lg border p-3 ${themeClasses.neutral}`}>
                <p className={`text-xs ${themeClasses.muted}`}>Εκτίμηση κόστους</p>
                <p className={`text-xl font-semibold ${themeClasses.title}`}>€{totalEstimate.toFixed(2)}</p>
              </div>
              <p className={`text-xs ${themeClasses.muted}`}>
                Η τελική επιβεβαίωση και το ποσό μπορεί να διαμορφωθούν από την επιχείρηση.
              </p>
              <div className={`rounded-lg border p-3 space-y-1 ${themeClasses.neutral}`}>
                <p className="text-[11px] font-medium">Πολιτική κράτησης</p>
                <p className={`text-[11px] ${themeClasses.muted}`}>
                  Σε περίπτωση αδυναμίας, ενημέρωσε έγκαιρα για αλλαγή/ακύρωση ραντεβού.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
