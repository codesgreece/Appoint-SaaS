import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { SupportRequest, SupportRequestMessage } from "@/types"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/AuthContext"
import { createInAppNotification } from "@/services/api"

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
  const { user } = useAuth()
  const [businessQuery, setBusinessQuery] = useState("")
  const [userQuery, setUserQuery] = useState("")
  const [businessResult, setBusinessResult] = useState<BusinessLite | null>(null)
  const [businessLoading, setBusinessLoading] = useState(false)
  const [userResults, setUserResults] = useState<any[]>([])
  const [userLoading, setUserLoading] = useState(false)
  const [supportRows, setSupportRows] = useState<SupportRequest[]>([])
  const [messagesByRequestId, setMessagesByRequestId] = useState<Record<string, SupportRequestMessage[]>>({})
  const [draftByRequestId, setDraftByRequestId] = useState<Record<string, string>>({})
  const [chatSendingId, setChatSendingId] = useState<string | null>(null)
  const [supportLoading, setSupportLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const openSupportCount = supportRows.filter((r) => r.status === "open").length

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setSupportLoading(true)
        const { data, error } = await supabase
          .from("support_requests")
          .select("*")
          .order("created_at", { ascending: false })
        if (!active) return
        if (error) throw error

        const nextRows = (data ?? []) as SupportRequest[]
        setSupportRows(nextRows)

        const ids = nextRows.map((r) => r.id)
        if (ids.length === 0) {
          setMessagesByRequestId({})
          return
        }

        const { data: msgData, error: msgError } = await supabase
          .from("support_request_messages")
          .select("*")
          .in("support_request_id", ids)
          .order("created_at", { ascending: true })

        if (msgError) throw msgError

        const grouped: Record<string, SupportRequestMessage[]> = {}
        ;(msgData ?? []).forEach((m) => {
          const mm = m as SupportRequestMessage
          if (!grouped[mm.support_request_id]) grouped[mm.support_request_id] = []
          grouped[mm.support_request_id].push(mm)
        })
        setMessagesByRequestId(grouped)
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
    if (!user) return
    const content = reply.trim()
    if (!content) return

    setChatSendingId(id)
    try {
      const req = supportRows.find((r) => r.id === id)
      if (!req) throw new Error("Λείπει το support request στη μνήμη.")

      const payload = {
        support_request_id: id,
        business_id: req.business_id,
        sender_user_id: user.id,
        sender_role: "super_admin" as const,
        content,
      }

      const { error } = await supabase.from("support_request_messages").insert(payload)
      if (error) throw error

      // Incident stays open until super_admin resolves it (status update allowed only by super_admin).
      const nextStatus = req.status === "open" ? "in_progress" : req.status
      const { error: statusErr } = await supabase.from("support_requests").update({ status: nextStatus, has_unread_reply: true }).eq("id", id)
      if (statusErr) throw statusErr

      setSupportRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: nextStatus, has_unread_reply: true } : r)))

      const { data: msgData, error: msgError } = await supabase
        .from("support_request_messages")
        .select("*")
        .eq("support_request_id", id)
        .order("created_at", { ascending: true })
      if (msgError) throw msgError

      setMessagesByRequestId((prev) => ({ ...prev, [id]: (msgData ?? []) as SupportRequestMessage[] }))

      try {
        await createInAppNotification(req.business_id, "Νέα απάντηση από την υποστήριξη πλατφόρμας στο αίτημά σας.", {
          notificationType: "support_reply",
          relatedSupportRequestId: id,
        })
      } catch (e) {
        console.warn("Tools: tenant notification insert failed:", e)
      }
    } finally {
      setChatSendingId((prev) => (prev === id ? null : prev))
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
                      <div className="mt-2 rounded-xl border border-border/60 bg-background/40 p-2">
                        <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                          <div className="flex justify-end">
                            <div className="max-w-[88%] rounded-2xl rounded-br-md border border-border/50 bg-background/70 px-3 py-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Admin</p>
                              <p className="mt-1 whitespace-pre-wrap text-[12px] leading-snug">{r.message}</p>
                            </div>
                          </div>

                          {(messagesByRequestId[r.id] ?? []).map((m) => (
                            <div key={m.id} className={m.sender_role === "super_admin" ? "flex justify-start" : "flex justify-end"}>
                              <div
                                className={
                                  m.sender_role === "super_admin"
                                    ? "max-w-[88%] rounded-2xl rounded-bl-md border border-primary/25 bg-primary/5 px-3 py-2"
                                    : "max-w-[88%] rounded-2xl rounded-br-md border border-border/50 bg-background/70 px-3 py-2"
                                }
                              >
                                <p
                                  className={
                                    m.sender_role === "super_admin"
                                      ? "text-[10px] font-semibold uppercase tracking-wide text-primary"
                                      : "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                                  }
                                >
                                  {m.sender_role === "super_admin" ? "Υποστήριξη" : "Admin"}
                                </p>
                                <p className="mt-1 whitespace-pre-wrap text-[12px] leading-snug">{m.content}</p>
                              </div>
                            </div>
                          ))}

                          {r.internal_notes?.trim() && (messagesByRequestId[r.id] ?? []).length === 0 ? (
                            <div className="flex justify-start">
                              <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-primary/25 bg-primary/5 px-3 py-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Απάντηση από την υποστήριξη</p>
                                <p className="mt-1 whitespace-pre-wrap text-[12px] leading-snug text-foreground">{r.internal_notes.trim()}</p>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {r.status !== "resolved" && (
                        <div className="mt-3 space-y-2">
                          <Textarea
                            value={draftByRequestId[r.id] ?? ""}
                            onChange={(e) => setDraftByRequestId((prev) => ({ ...prev, [r.id]: e.target.value }))}
                            placeholder="Γράψε απάντηση..."
                            className="bg-background/40 border-border/50 focus-visible:ring-primary/30 text-xs min-h-[90px]"
                          />
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              size="sm"
                              onClick={async () => {
                                const txt = (draftByRequestId[r.id] ?? "").trim()
                                if (!txt) return
                                await setSupportReply(r.id, txt)
                                setDraftByRequestId((prev) => ({ ...prev, [r.id]: "" }))
                              }}
                              disabled={chatSendingId === r.id}
                            >
                              {chatSendingId === r.id ? "Αποστολή..." : "Αποστολή"}
                            </Button>
                          </div>
                        </div>
                      )}
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

