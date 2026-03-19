import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { fetchBusiness } from "@/services/api"
import type { Business } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Building2, Mail, Phone, MapPin, Shield } from "lucide-react"

function pretty(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : "—"
}

export default function Details() {
  const { businessId, user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [business, setBusiness] = useState<Business | null>(null)

  useEffect(() => {
    if (!businessId) return
    setLoading(true)
    fetchBusiness(businessId)
      .then(setBusiness)
      .finally(() => setLoading(false))
  }, [businessId])

  return (
    <div className="space-y-6">
      <div className="relative">
        <div className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-r from-primary/20 via-purple-500/10 to-transparent blur-2xl" />
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur">
          <Building2 className="h-4 w-4 text-primary" />
          Επιχείρηση • Στοιχεία
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Στοιχεία επιχείρησης</h1>
        <p className="text-muted-foreground">Προβολή πληροφοριών επιχείρησης (read-only).</p>
      </div>

      {loading ? (
        <Skeleton className="h-56 w-full" />
      ) : (
        <Card className="border-border/60 bg-card/60 backdrop-blur-xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span>{pretty(business?.name)}</span>
              <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/5">
                Read-only
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                <p className="text-[11px] text-muted-foreground">Τύπος επιχείρησης</p>
                <p className="text-sm font-medium">{pretty(business?.business_type)}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                <p className="text-[11px] text-muted-foreground">Πλάνο</p>
                <p className="text-sm font-medium">{pretty(business?.subscription_plan)}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </p>
                <p className="text-sm font-medium">{pretty(business?.email)}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  Τηλέφωνο
                </p>
                <p className="text-sm font-medium">{pretty(business?.phone)}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5" />
                  Ρόλος χρήστη
                </p>
                <p className="text-sm font-medium">{pretty(user?.role)}</p>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/40 p-3">
              <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                Διεύθυνση
              </p>
              <p className="text-sm font-medium">{pretty(business?.address)}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
