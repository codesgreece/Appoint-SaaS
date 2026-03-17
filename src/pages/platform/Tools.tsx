import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { SupportRequest } from "@/types"
import { Badge } from "@/components/ui/badge"

interface BusinessLite {
  id: string
  name: string
  email: string | null
  subscription_plan: string | null
  subscription_status: string | null
  max_users: number | null
  max_customers: number | null
  max_appointments: number | null
}

export default function PlatformTools() {
  const [businessQuery, setBusinessQuery] = useState("")
  const [userQuery, setUserQuery] = useState("")
  const [businessResult, setBusinessResult] = useState<BusinessLite | null>(null)
  const [businessLoading, setBusinessLoading] = useState(false)
  const [userResults, setUserResults] = useState<any[]>([])
  const [userLoading, setUserLoading] = useState(false)
  const [supportRows, setSupportRows] = useState<SupportRequest[]>([])
  const [supportLoading, setSupportLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const openSupportCount = supportRows.filter((r) => r.status === "open").length

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setSupportLoading(true)
        const { data } = await supabase
          .from("support_requests")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(30)
        if (!active) return
        setSupportRows((data ?? []) as SupportRequest[])
      } finally {
        if (active) setSupportLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  async function setSupportStatus(id: string, status: "open" | "in_progress" | "resolved") {
    setUpdatingId(id)
    try {
      const { error } = await supabase.from("support_requests").update({ status }).eq("id", id)
      if (error) throw error
      setSupportRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
    } finally {
      setUpdatingId((prev) => (prev === id ? null : prev))
    }
  }

  async function setSupportReply(id: string, reply: string) {
    setUpdatingId(id)
    try {
      const { error } = await supabase
        .from("support_requests")
        .update({ internal_notes: reply || null, has_unread_reply: Boolean(reply) })
        .eq("id", id)
      if (error) throw error
      setSupportRows((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, internal_notes: reply || null, has_unread_reply: Boolean(reply) } : r
        )
      )
    } finally {
      setUpdatingId((prev) => (prev === id ? null : prev))
    }
  }

  async function handleSearchBusiness() {
    try {
      if (!businessQuery.trim()) return
      setBusinessLoading(true)
      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, email, subscription_plan, subscription_status, max_users, max_customers, max_appointments")
        .or(`name.ilike.%${businessQuery.trim()}%,email.ilike.%${businessQuery.trim()}%`)
        .limit(1)
        .maybeSingle()
      if (error) throw error
      setBusinessResult((data as BusinessLite) ?? null)
    } catch (err) {
      console.error("Search business error:", err)
      setBusinessResult(null)
    } finally {
      setBusinessLoading(false)
    }
  }

  async function handleSearchUsers() {
    try {
      if (!userQuery.trim()) return
      setUserLoading(true)
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, email, role, status, business:businesses(name)")
        .or(`email.ilike.%${userQuery.trim()}%,full_name.ilike.%${userQuery.trim()}%`)
        .limit(20)
      if (error) throw error
      setUserResults(data ?? [])
    } catch (err) {
      console.error("Search users error:", err)
      setUserResults([])
    } finally {
      setUserLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Εργαλεία υποστήριξης</h1>
        <p className="text-muted-foreground">Γρήγορη επισκόπηση tenants και χρηστών</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Αναζήτηση επιχείρησης</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label>Όνομα ή email επιχείρησης</Label>
                <Input
                  placeholder="Business name or email"
                  value={businessQuery}
                  onChange={(e) => setBusinessQuery(e.target.value)}
                />
              </div>
              <Button type="button" onClick={handleSearchBusiness} className="mt-6">
                Αναζήτηση
              </Button>
            </div>
            {businessLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : businessResult ? (
              <div className="rounded-md border p-3 space-y-1">
                <p className="font-medium">{businessResult.name}</p>
                <p className="text-xs text-muted-foreground">{businessResult.email ?? "—"}</p>
                <p className="text-xs text-muted-foreground">
                  Πλάνο: {businessResult.subscription_plan ?? "—"} ({businessResult.subscription_status ?? "—"})
                </p>
                <p className="text-xs text-muted-foreground">
                  Όρια: χρήστες {businessResult.max_users ?? "—"}, πελάτες {businessResult.max_customers ?? "—"},
                  ραντεβού {businessResult.max_appointments ?? "—"}
                </p>
              </div>
            ) : businessQuery ? (
              <p className="text-xs text-muted-foreground">Δεν βρέθηκε επιχείρηση.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Αναζήτηση χρηστών</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label>Όνομα ή email χρήστη</Label>
                <Input
                  placeholder="User name or email"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                />
              </div>
              <Button type="button" onClick={handleSearchUsers} className="mt-6">
                Αναζήτηση
              </Button>
            </div>
            {userLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : userResults.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-auto">
                {userResults.map((u) => (
                  <div key={u.id} className="rounded-md border p-2 flex flex-col gap-1">
                    <p className="font-medium">{u.full_name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Ρόλος {u.role} • {u.status} • {u.business?.name ?? "—"}
                    </p>
                  </div>
                ))}
              </div>
            ) : userQuery ? (
              <p className="text-xs text-muted-foreground">Δεν βρέθηκαν χρήστες.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Αιτήματα υποστήριξης (Προτάσεις / Προβλήματα)
            {openSupportCount > 0 ? (
              <Badge variant="secondary" className="border border-border/50 bg-background/40 backdrop-blur">
                {openSupportCount} ανοιχτά
              </Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {supportLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : supportRows.length === 0 ? (
            <p className="text-xs text-muted-foreground">Δεν υπάρχουν αιτήματα.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-auto">
              {supportRows.map((r) => (
                <div key={r.id} className="rounded-md border border-border/50 bg-background/40 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">
                        {r.type === "issue" ? "Πρόβλημα" : "Πρόταση"} • {r.status}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.business_name ?? r.business_id} • {r.created_by_name ?? "—"} ({r.created_by_username ?? "—"})
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{r.message}</p>
                      <div className="mt-3 space-y-1">
                        <Label className="text-xs">Απάντηση προς την επιχείρηση</Label>
                        <p className="text-[11px] text-muted-foreground">
                          Εμφανίζεται στο μενού Υποστήριξη του admin της επιχείρησης.
                        </p>
                        <Textarea
                          defaultValue={r.internal_notes ?? ""}
                          onBlur={(e) => {
                            const next = e.target.value.trim()
                            if (next !== (r.internal_notes ?? "").trim()) {
                              setSupportReply(r.id, next)
                            }
                          }}
                          placeholder="Π.χ. Προστέθηκε / Διορθώθηκε στην έκδοση Χ"
                          className="bg-background/40 border-border/50 focus-visible:ring-primary/30 text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSupportStatus(r.id, "in_progress")}
                        disabled={updatingId === r.id}
                      >
                        Σε εξέλιξη
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setSupportStatus(r.id, "resolved")}
                        disabled={updatingId === r.id}
                      >
                        Ολοκληρώθηκε
                      </Button>
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

